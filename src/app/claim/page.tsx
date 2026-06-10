'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Loader2, CheckCircle } from 'lucide-react'
import { useWallet } from '@/contexts/WalletContext'
import { StellarWalletsKit, Networks } from '@creit.tech/stellar-wallets-kit'
import { checkIfGhost, fetchVaultData, ASSETS } from '@/lib/stellar'
import Navbar from '@/components/layout/Navbar'

function getPreviewBreakdown(
  amountStroops: number,
  lockedAssetCode: string,
  targetAssetCode: string,
  eurcPrice: number | null
) {
  const lockedPrice = lockedAssetCode === 'USDC' ? 1.0 : (eurcPrice || 1.15)
  const targetPrice = targetAssetCode === 'USDC' ? 1.0 : (eurcPrice || 1.15)

  const rawAmount = amountStroops
  const originalAmountTokens = rawAmount / 10_000_000

  // 1% base fee
  const baseFeeTokens = originalAmountTokens * 0.01
  const feeUsdValue = baseFeeTokens * lockedPrice

  let feeTokens = baseFeeTokens
  // $0.50 minimum fee
  if (feeUsdValue < 0.50) {
    feeTokens = 0.50 / lockedPrice
  }
  // $3.00 maximum fee
  else if (feeUsdValue > 3.00) {
    feeTokens = 3.00 / lockedPrice
  }

  const principalTokens = Math.max(0, originalAmountTokens - feeTokens)
  const exchangeRate = lockedPrice / targetPrice
  const receivedTokens = principalTokens * exchangeRate

  return {
    originalAmountTokens,
    feeTokens,
    feeAsset: lockedAssetCode,
    principalTokens,
    principalAsset: lockedAssetCode,
    exchangeRate,
    receivedTokens,
    receivedAsset: targetAssetCode,
    needsSwap: lockedAssetCode !== targetAssetCode
  }
}

function ClaimPageContent() {
  const searchParams = useSearchParams()
  const vaultId = searchParams.get('vault')
  const router = useRouter()
  const { isConnected, publicKey, connectWallet, setIsGhost, isGhost } = useWallet()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [vaultData, setVaultData] = useState<{ amount: string; claimant: string; assetCode: string; assetAddress: string } | null>(null)
  const [isAuthorized, setIsAuthorized] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
  const [stepMessage, setStepMessage] = useState('Processing Secure Claim...')
  const [success, setSuccess] = useState(false)
  const [targetAsset, setTargetAsset] = useState('USDC')
  const [finalReceivedAmount, setFinalReceivedAmount] = useState<string | null>(null)
  const [eurcPrice, setEurcPrice] = useState<number | null>(null)

  const targetAssetData = ASSETS[targetAsset as keyof typeof ASSETS]

  useEffect(() => {
    let active = true
    fetch('/api/price?asset=EURC')
      .then(res => res.json())
      .then(data => {
        if (active && data.price) {
          setEurcPrice(data.price)
        }
      })
      .catch(err => console.error('Failed to fetch EURC price for preview:', err))
    return () => {
      active = false
    }
  }, [])

  const breakdown = vaultData
    ? getPreviewBreakdown(
        parseFloat(vaultData.amount),
        vaultData.assetCode,
        targetAsset,
        eurcPrice
      )
    : null

  useEffect(() => {
    async function loadVaultData() {
      if (!vaultId) {
        setError('Vault Not Found')
        setLoading(false)
        return
      }

      try {
        const data = await fetchVaultData(vaultId)
        setVaultData(data)
      } catch (err) {
        setError('Vault Not Found')
      } finally {
        setLoading(false)
      }
    }

    loadVaultData()
  }, [vaultId])

  useEffect(() => {
    if (isConnected && publicKey && vaultData) {
      if (publicKey !== vaultData.claimant) {
        setIsAuthorized(false)
      } else {
        setIsAuthorized(true)
        checkIfGhost(publicKey).then(setIsGhost)
      }
    }
  }, [isConnected, publicKey, vaultData, setIsGhost])

  const needsSwap = vaultData ? vaultData.assetCode !== targetAsset : false

  const handleClaim = async () => {
    if (!vaultId || !publicKey || !vaultData) return
    setIsProcessing(true)
    setError(null)
    try {
      const totalSteps = isGhost ? (needsSwap ? 3 : 2) : (needsSwap ? 2 : 1)
      let currentStep = 0

      // ── Phase 1: Activate ghost wallet (if needed) ──────────────────────
      if (isGhost) {
        currentStep++
        setStepMessage(`Building wallet activation (${currentStep}/${totalSteps})...`)
        const activateRes = await fetch('/api/claim/activate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            receiverPublicKey: publicKey,
            targetAsset: targetAssetData.contractId,
            lockedAssetContractId: vaultData.assetAddress,
          }),
        })
        const activateData = await activateRes.json()
        if (!activateRes.ok || activateData.error) {
          throw new Error(activateData.error || 'Failed to build activation tx')
        }

        setStepMessage(`Sign wallet activation (${currentStep}/${totalSteps})...`)
        const { signedTxXdr: signedActivation } = await StellarWalletsKit.signTransaction(
          activateData.xdr,
          { networkPassphrase: Networks.TESTNET, address: publicKey }
        )

        setStepMessage('Activating wallet on Stellar...')
        const activateSubmitRes = await fetch('/api/claim/activate/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ signedXdr: signedActivation }),
        })
        const activateSubmitData = await activateSubmitRes.json()
        if (!activateSubmitRes.ok || activateSubmitData.error) {
          throw new Error(activateSubmitData.error || 'Activation submission failed')
        }

        // Wait for ledger to close so Soroban simulation sees the new account
        await new Promise(resolve => setTimeout(resolve, 6000))
      }

      // ── Phase 2: Claim from contract (Soroban) ──────────────────────────
      // Contract releases principal → receiver, fee → treasury (in locked asset).
      currentStep++
      setStepMessage(`Building claim (${currentStep}/${totalSteps})...`)
      const buildRes = await fetch('/api/claim/build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiverPublicKey: publicKey,
          amount: vaultData.amount,
          assetCode: vaultData.assetCode,
        }),
      })
      const buildData = await buildRes.json()
      if (!buildRes.ok || buildData.error) {
        throw new Error(buildData.error || 'Claim build failed')
      }

      if (!needsSwap) {
        setFinalReceivedAmount((parseFloat(buildData.principalAmount) / 10_000_000).toString())
      }

      setStepMessage(`Sign claim (${currentStep}/${totalSteps})...`)
      const { signedTxXdr: signedClaimXdr } = await StellarWalletsKit.signTransaction(
        buildData.xdr,
        { networkPassphrase: Networks.TESTNET, address: publicKey }
      )

      setStepMessage('Submitting claim to network...')
      const submitRes = await fetch('/api/claim/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signedXdr: signedClaimXdr }),
      })
      const submitData = await submitRes.json()
      if (!submitRes.ok || submitData.error) {
        throw new Error(submitData.error || 'Claim submission failed')
      }

      // ── Phase 3: Treasury conversion (if cross-asset) ───────────────────
      // Treasury-backed conversion: receiver sends locked asset → treasury,
      // treasury sends target asset → receiver at live oracle rate.
      if (needsSwap) {
        currentStep++

        // Use the EXACT principalAmount from the API (same BigInt math as contract)
        const principalAmount = buildData.principalAmount

        setStepMessage(`Building conversion (${currentStep}/${totalSteps})...`)
        const swapBuildRes = await fetch('/api/claim/swap', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            receiverPublicKey: publicKey,
            sendAmount: principalAmount,
            lockedAssetCode: vaultData.assetCode,
            targetAssetCode: targetAsset,
          }),
        })
        const swapBuildData = await swapBuildRes.json()
        if (!swapBuildRes.ok || swapBuildData.error) {
          throw new Error(swapBuildData.error || 'Conversion build failed')
        }

        setFinalReceivedAmount(swapBuildData.convertedAmount)

        setStepMessage(`Sign conversion (${currentStep}/${totalSteps})...`)
        const { signedTxXdr: signedSwapXdr } = await StellarWalletsKit.signTransaction(
          swapBuildData.xdr,
          { networkPassphrase: Networks.TESTNET, address: publicKey }
        )

        setStepMessage('Submitting conversion to network...')
        const swapSubmitRes = await fetch('/api/claim/swap/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ signedXdr: signedSwapXdr }),
        })
        const swapSubmitData = await swapSubmitRes.json()
        if (!swapSubmitRes.ok || swapSubmitData.error) {
          throw new Error(swapSubmitData.error || 'Conversion submission failed')
        }
      }

      setSuccess(true)
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
    } finally {
      setIsProcessing(false)
      setStepMessage('Processing Secure Claim...')
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
        <div className="flex items-center gap-3 text-zinc-400">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading vault...</span>
        </div>
      </div>
    )
  }

  if (error || !vaultData) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
        <div className="w-full max-w-md rounded-2xl border border-red-500/30 bg-red-950/30 p-8 text-center">
          <h1 className="text-2xl font-bold text-red-400">{error || 'Vault Not Found'}</h1>
        </div>
      </div>
    )
  }

  if (!isAuthorized) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
        <div className="w-full max-w-md rounded-2xl border border-red-500/30 bg-red-950/30 p-8 text-center">
          <h1 className="text-2xl font-bold text-red-400">Unauthorized.</h1>
          <p className="mt-2 text-zinc-400">This secure link is assigned to a different wallet.</p>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
        <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8 backdrop-blur-sm text-center">
          <CheckCircle className="mx-auto h-16 w-16 text-green-400" />
          <h1 className="mt-4 text-2xl font-bold text-zinc-50">Transaction Settled</h1>
          <p className="mt-2 text-zinc-400">
            Funds claimed and transferred successfully.
          </p>
          
          <div className="my-6 rounded-2xl bg-zinc-950/40 p-5 border border-zinc-800/80 text-left w-full space-y-4">
            <div className="text-center">
              <span className="text-xs text-zinc-500 uppercase tracking-widest font-semibold block mb-1">Claimed Amount</span>
              <span className="text-3xl font-black text-green-400 font-mono">
                {parseFloat(finalReceivedAmount || '0').toFixed(4)} {targetAssetData.code}
              </span>
            </div>
            
            {breakdown && (
              <div className="pt-3 border-t border-zinc-800/80 text-xs text-zinc-450 space-y-2">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Vault Value:</span>
                  <span className="font-mono text-zinc-300">{breakdown.originalAmountTokens.toFixed(2)} {vaultData.assetCode}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Sponsoring Fee:</span>
                  <span className="font-mono text-red-400">-{breakdown.feeTokens.toFixed(4)} {breakdown.feeAsset}</span>
                </div>
                {breakdown.needsSwap && (
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Oracle Swap Rate:</span>
                    <span className="font-mono text-blue-400">1 {vaultData.assetCode} = {breakdown.exchangeRate.toFixed(4)} {targetAssetData.code}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <button
            onClick={() => router.push('/dashboard')}
            className="w-full rounded-2xl bg-blue-500 px-8 py-4 text-lg font-semibold text-white shadow-lg shadow-blue-500/30 hover:bg-blue-400 transition-colors"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8 backdrop-blur-sm text-center">
          <motion.h1
            key={isConnected ? 'connected' : 'disconnected'}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl font-bold"
          >
            <span className="text-green-400">{(parseFloat(vaultData.amount) / 10_000_000).toFixed(2)} {vaultData.assetCode}</span> waiting.
          </motion.h1>

          <p className="mt-2 text-zinc-400">Securely locked in SwiftClaim Vault.</p>

          <div className="mt-6">
            <label className="mb-2 block text-sm font-medium text-zinc-300">
              Desired Output Asset
            </label>
            <select
              value={targetAsset}
              onChange={(e) => setTargetAsset(e.target.value)}
              className="w-full rounded-2xl border border-zinc-800 bg-zinc-900/50 px-4 py-3 text-lg text-zinc-50 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              {Object.entries(ASSETS).map(([key, asset]) => (
                <option key={key} value={key}>
                  {asset.code}
                </option>
              ))}
            </select>
          </div>

          {breakdown && (
            <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-950/40 p-5 text-left space-y-3">
              <div className="flex justify-between items-center pb-2 border-b border-zinc-800/60">
                <span className="text-sm font-semibold text-zinc-200">Claim Details & Fees</span>
                <span className="text-xs text-blue-400 font-mono">Real-Time Oracle</span>
              </div>
              
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">Locked Vault Amount:</span>
                <span className="font-mono text-zinc-100 font-medium">
                  {breakdown.originalAmountTokens.toFixed(2)} {vaultData.assetCode}
                </span>
              </div>

              <div className="flex justify-between text-sm">
                <span className="text-zinc-400 flex items-center gap-1">
                  Secure Sponsoring Fee:
                  <span className="text-xs text-zinc-500">(1% or $0.50 min)</span>
                </span>
                <span className="font-mono text-red-400 font-medium">
                  -{breakdown.feeTokens.toFixed(4)} {breakdown.feeAsset}
                </span>
              </div>

              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">Net Principal:</span>
                <span className="font-mono text-zinc-100 font-medium">
                  {breakdown.principalTokens.toFixed(4)} {breakdown.principalAsset}
                </span>
              </div>

              {breakdown.needsSwap && (
                <>
                  <div className="flex justify-between text-sm border-t border-dashed border-zinc-800/80 pt-2">
                    <span className="text-zinc-400">Conversion Rate:</span>
                    <span className="font-mono text-blue-400 font-medium">
                      1 {vaultData.assetCode} = {breakdown.exchangeRate.toFixed(4)} {targetAssetData.code}
                    </span>
                  </div>
                </>
              )}

              <div className="flex justify-between text-base font-bold border-t border-zinc-800 pt-3 mt-1">
                <span className="text-zinc-50">Estimated Received:</span>
                <span className="font-mono text-green-400 font-extrabold">
                  {breakdown.receivedTokens.toFixed(4)} {targetAssetData.code}
                </span>
              </div>
            </div>
          )}

          <div className="mt-8 space-y-4">
            {!isConnected ? (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={connectWallet}
                className="w-full rounded-2xl bg-blue-500 px-8 py-4 text-lg font-semibold text-white shadow-lg shadow-blue-500/30 hover:bg-blue-400 transition-colors"
              >
                Connect Wallet to Claim
              </motion.button>
            ) : (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleClaim}
                disabled={isProcessing}
                className="w-full rounded-2xl bg-green-500 px-8 py-4 text-lg font-semibold text-white shadow-lg shadow-green-500/30 hover:bg-green-400 disabled:opacity-70 transition-colors"
              >
                {isProcessing ? (
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    {stepMessage}
                  </div>
                ) : isGhost ? (
                  `Claim ${targetAssetData.code} ($0.50 Network Activation Fee)`
                ) : (
                  `Claim ${targetAssetData.code} (Gas-Free)`
                )}
              </motion.button>
            )}

            {error && (
              <p className="text-sm text-red-400">{error}</p>
            )}

            {isConnected && isGhost && (
              <p className="text-xs text-zinc-500">
                The Stellar ledger requires a base deposit to activate a new wallet. We securely sponsor this requirement for you. No liquid gas is provided.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ClaimPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
      <Navbar />
      <div className="flex-1">
        <Suspense fallback={
          <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
            <div className="flex items-center gap-3 text-zinc-400">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span>Loading...</span>
            </div>
          </div>
        }>
          <ClaimPageContent />
        </Suspense>
      </div>
    </div>
  )
}
