'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Loader2,
  CheckCircle,
  CheckCircle2,
  Lock,
  ShieldCheck,
  AlertCircle,
  Info,
  ChevronRight,
  Wallet,
  RefreshCw,
  TrendingUp,
  ArrowRight
} from 'lucide-react'
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
  const [isAssetDropdownOpen, setIsAssetDropdownOpen] = useState(false)
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
    } else {
      setIsAuthorized(true)
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

  // 1. Loading state
  if (loading) {
    return (
      <div className="flex items-center gap-3 text-zinc-400 py-20">
        <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
        <span className="font-medium">Decrypting vault lockbox...</span>
      </div>
    )
  }

  // 2. Error state
  if (error || !vaultData) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md rounded-3xl border border-red-500/20 bg-red-950/5 p-6 md:p-8 backdrop-blur-xl shadow-2xl text-center space-y-6 relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-red-500/30 to-transparent" />
        <div className="p-3.5 rounded-2xl bg-red-500/10 text-red-400 border border-red-500/20 w-fit mx-auto">
          <AlertCircle className="h-7 w-7" />
        </div>
        <h1 className="text-xl font-bold text-white tracking-tight">{error || 'Vault Not Found'}</h1>
        <p className="text-sm text-zinc-400 leading-relaxed">
          The requested SwiftLink vault does not exist or may have already been claimed.
        </p>
        <button
          onClick={() => router.push('/dashboard')}
          className="w-full rounded-2xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 px-6 py-3.5 font-bold text-sm text-zinc-300 transition-colors cursor-pointer"
        >
          Go to Dashboard
        </button>
      </motion.div>
    )
  }

  // 3. Disconnected state: Hide vault details, show connect CTA
  if (!isConnected || !publicKey) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md rounded-3xl border border-zinc-900 bg-[#0d0d0e]/60 p-6 md:p-8 backdrop-blur-xl shadow-2xl text-center space-y-6 relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-orange-500/30 to-transparent" />

        <div className="flex flex-col items-center gap-3">
          <div className="p-3.5 rounded-2xl bg-orange-500/10 text-orange-500 border border-orange-500/20 shadow-md">
            <Lock className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">Private SwiftLink Vault</h2>
          <p className="text-sm text-zinc-400 leading-relaxed">
            This SwiftLink contains funds secured on the Stellar blockchain. Only the designated recipient address can inspect the vault contents and claim the funds.
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-800/80 bg-[#070708]/50 p-4 space-y-3 text-left">
          <div className="flex gap-3 items-start text-xs text-zinc-400">
            <span className="h-5 w-5 rounded-full bg-zinc-850 flex items-center justify-center text-[10px] text-zinc-300 font-bold shrink-0">1</span>
            <span>Connect your receiver Stellar wallet.</span>
          </div>
          <div className="flex gap-3 items-start text-xs text-zinc-400">
            <span className="h-5 w-5 rounded-full bg-zinc-850 flex items-center justify-center text-[10px] text-zinc-300 font-bold shrink-0">2</span>
            <span>Verify wallet address authorization.</span>
          </div>
          <div className="flex gap-3 items-start text-xs text-zinc-400">
            <span className="h-5 w-5 rounded-full bg-zinc-850 flex items-center justify-center text-[10px] text-zinc-300 font-bold shrink-0">3</span>
            <span>Claim funds directly or swap to another token gaslessly.</span>
          </div>
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={connectWallet}
          className="w-full rounded-2xl bg-gradient-to-r from-[#ff5500] to-[#ff7700] hover:from-[#e04b00] hover:to-[#ff5500] px-6 py-4 font-bold text-white shadow-lg shadow-orange-500/20 border border-orange-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <Wallet className="h-5 w-5" />
          Connect Wallet to Inspect
        </motion.button>
      </motion.div>
    )
  }

  // 4. Wrong wallet connected state: Show unauthorized warnings, offer switch wallet
  if (!isAuthorized) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md rounded-3xl border border-red-500/20 bg-[#0d0d0e]/60 p-6 md:p-8 backdrop-blur-xl shadow-2xl text-center space-y-6 relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-red-500/30 to-transparent" />

        <div className="flex flex-col items-center gap-3">
          <div className="p-3.5 rounded-2xl bg-red-500/10 text-red-400 border border-red-500/20">
            <AlertCircle className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">Unauthorized Recipient</h2>
          <p className="text-sm text-zinc-400 leading-relaxed">
            Your connected wallet is not authorized to claim this SwiftLink.
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-900 bg-[#070708]/50 p-4 space-y-3 text-left text-xs">
          <div className="flex justify-between border-b border-zinc-900/60 pb-2">
            <span className="text-zinc-500">Connected Wallet:</span>
            <span className="font-mono text-red-400 font-bold">
              {publicKey.slice(0, 8)}...{publicKey.slice(-8)}
            </span>
          </div>
          <div className="flex justify-between pt-1">
            <span className="text-zinc-500">Authorized Claimant:</span>
            <span className="font-mono text-emerald-400 font-bold">
              {vaultData.claimant.slice(0, 8)}...{vaultData.claimant.slice(-8)}
            </span>
          </div>
        </div>

        <div className="pt-2 flex flex-col gap-3">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={connectWallet}
            className="w-full rounded-2xl bg-white text-black font-bold text-sm px-6 py-4 hover:bg-zinc-200 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
          >
            <RefreshCw className="h-4 w-4" />
            Switch Connected Wallet
          </motion.button>

          <button
            onClick={() => router.push('/dashboard')}
            className="w-full rounded-2xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 px-6 py-3 text-xs font-semibold text-zinc-400 transition-colors"
          >
            Go to Dashboard
          </button>
        </div>
      </motion.div>
    )
  }

  // 5. Success state
  if (success) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md rounded-3xl border border-zinc-900 bg-[#0d0d0e]/60 p-6 md:p-8 backdrop-blur-xl shadow-2xl text-center space-y-6 relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />

        <div className="p-3.5 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 w-fit mx-auto">
          <CheckCircle className="h-10 w-10" />
        </div>

        <h1 className="text-2xl font-black text-white tracking-tight">Transaction Settled</h1>
        <p className="text-sm text-zinc-400 leading-relaxed">
          Funds claimed and transferred successfully.
        </p>

        <div className="my-6 rounded-2xl bg-[#070708]/60 p-5 border border-zinc-900 text-left w-full space-y-4">
          <div className="text-center">
            <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold block mb-1">Claimed Amount</span>
            <span className="text-3xl font-black text-emerald-400 font-mono tracking-tight">
              {parseFloat(finalReceivedAmount || '0').toFixed(4)} {targetAssetData.code}
            </span>
          </div>

          {breakdown && (
            <div className="pt-3 border-t border-zinc-900 text-xs text-zinc-400 space-y-2">
              <div className="flex justify-between">
                <span>Vault Value:</span>
                <span className="font-mono text-zinc-300">{breakdown.originalAmountTokens.toFixed(2)} {vaultData.assetCode}</span>
              </div>
              <div className="flex justify-between">
                <span>Sponsoring Fee:</span>
                <span className="font-mono text-red-400">-{breakdown.feeTokens.toFixed(4)} {breakdown.feeAsset}</span>
              </div>
              {breakdown.needsSwap && (
                <div className="flex justify-between">
                  <span>Oracle Swap Rate:</span>
                  <span className="font-mono text-blue-400">1 {vaultData.assetCode} = {breakdown.exchangeRate.toFixed(4)} {targetAssetData.code}</span>
                </div>
              )}
            </div>
          )}
        </div>

        <button
          onClick={() => router.push('/dashboard')}
          className="w-full rounded-2xl bg-gradient-to-r from-[#ff5500] to-[#ff7700] hover:from-[#e04b00] hover:to-[#ff5500] px-6 py-4 font-bold text-white shadow-lg shadow-orange-500/20 border border-orange-500/20 transition-all cursor-pointer"
        >
          Go to Dashboard
        </button>
      </motion.div>
    )
  }

  // 6. Active Claim State (Authorized & Connected)
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-md rounded-3xl border border-zinc-900 bg-[#0d0d0e]/60 p-6 md:p-8 backdrop-blur-xl shadow-2xl text-center space-y-6 relative overflow-hidden"
    >
      {/* Top orange glow accent */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-orange-500/40 to-transparent" />

      {/* Lockbox Title & Tag */}
      <div className="flex justify-between items-center pb-4 border-b border-zinc-900/60 text-left">
        <h3 className="text-sm font-extrabold text-white flex items-center gap-1.5">
          <ShieldCheck className="h-4 w-4 text-emerald-400" />
          SwiftLink Vault
        </h3>
        <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-widest bg-emerald-500/10 px-2.5 py-1 rounded-full flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Verified Receiver
        </span>
      </div>

      {/* Primary Locked Cost Display */}
      <div className="bg-[#09090a] border border-orange-500/10 rounded-2xl p-6 text-center relative overflow-hidden">
        <span className="text-[10px] font-bold text-orange-500 uppercase tracking-widest block mb-1">Locked Vault Amount</span>
        <span className="text-3xl font-black text-white font-mono block tracking-tight">
          {(parseFloat(vaultData.amount) / 10_000_000).toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </span>
        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mt-1">{vaultData.assetCode}</span>
        <div className="text-[10px] text-zinc-400 mt-3 border-t border-zinc-900/60 pt-3">
          Funds waiting in smart contract escrow.
        </div>
      </div>

      {/* Output Asset Custom Dropdown Selector */}
      <div className="space-y-2 text-left">
        <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 pl-1">
          Desired Output Asset
        </label>
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsAssetDropdownOpen(!isAssetDropdownOpen)}
            className="w-full flex items-center justify-between rounded-2xl border border-zinc-805 bg-[#070708]/80 px-4 py-3.5 text-sm font-medium text-zinc-100 focus:border-orange-500/50 focus:outline-none focus:ring-1 focus:ring-orange-500/50 transition-all text-left"
          >
            <span className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${targetAsset === 'USDC' ? 'bg-blue-500' : 'bg-orange-500'}`} />
              {targetAsset}
            </span>
            <ChevronRight className={`h-4 w-4 text-zinc-400 transition-transform ${isAssetDropdownOpen ? 'rotate-90' : ''}`} />
          </button>

          <AnimatePresence>
            {isAssetDropdownOpen && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 5 }}
                className="absolute z-50 mt-2 w-full rounded-2xl border border-zinc-800 bg-[#0d0d0e]/95 backdrop-blur-xl p-1.5 shadow-xl text-left"
              >
                {Object.keys(ASSETS).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setTargetAsset(key)
                      setIsAssetDropdownOpen(false)
                    }}
                    className={`w-full flex items-center justify-between rounded-xl px-3 py-3 text-xs font-medium transition-all ${targetAsset === key ? 'bg-orange-500/10 text-white border border-orange-500/20' : 'text-zinc-400 hover:bg-zinc-900/50 hover:text-white border border-transparent'
                      }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${key === 'USDC' ? 'bg-blue-500' : 'bg-orange-500'}`} />
                      <div>
                        <div className="text-sm font-bold">{key}</div>
                        <div className="text-[10px] text-zinc-500">{key === 'USDC' ? 'USD Coin' : 'Euro Coin'}</div>
                      </div>
                    </span>
                    {targetAsset === key && (
                      <CheckCircle2 className="h-4 w-4 text-orange-500" />
                    )}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Claim Breakdown Card */}
      {breakdown && (
        <div className="rounded-2xl border border-zinc-900 bg-[#070708]/40 p-4 text-left space-y-3">
          <div className="flex justify-between items-center pb-2 border-b border-zinc-900/60">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Claim Details & Fees</span>
            <span className="text-[10px] text-orange-500 font-semibold font-mono flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              Oracle Feed
            </span>
          </div>

          <div className="flex justify-between text-xs">
            <span className="text-zinc-400">Locked Vault Amount:</span>
            <span className="font-mono text-zinc-100 font-medium">
              {breakdown.originalAmountTokens.toFixed(2)} {vaultData.assetCode}
            </span>
          </div>

          <div className="flex justify-between text-xs">
            <span className="text-zinc-400 flex items-center gap-1">
              Secure Sponsoring Fee:
              <span className="text-[10px] text-zinc-500">(1% or $0.50 min)</span>
            </span>
            <span className="font-mono text-red-400 font-medium">
              -{breakdown.feeTokens.toFixed(4)} {breakdown.feeAsset}
            </span>
          </div>

          <div className="flex justify-between text-xs">
            <span className="text-zinc-400">Net Principal:</span>
            <span className="font-mono text-zinc-100 font-medium">
              {breakdown.principalTokens.toFixed(4)} {breakdown.principalAsset}
            </span>
          </div>

          {breakdown.needsSwap && (
            <div className="flex justify-between text-xs border-t border-dashed border-zinc-900 pt-2">
              <span className="text-zinc-400">Conversion Rate:</span>
              <span className="font-mono text-blue-400 font-medium">
                1 {vaultData.assetCode} = {breakdown.exchangeRate.toFixed(4)} {targetAssetData.code}
              </span>
            </div>
          )}

          <div className="flex justify-between text-sm font-bold border-t border-zinc-900 pt-3 mt-1">
            <span className="text-zinc-100">Estimated Received:</span>
            <span className="font-mono text-emerald-400 font-extrabold">
              {breakdown.receivedTokens.toFixed(4)} {targetAssetData.code}
            </span>
          </div>
        </div>
      )}

      {/* Submit Claim Action */}
      <div className="space-y-4 pt-2">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleClaim}
          disabled={isProcessing}
          className="w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 px-6 py-4 font-bold text-white shadow-lg shadow-emerald-500/20 border border-emerald-500/20 disabled:opacity-75 transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          {isProcessing ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>{stepMessage}</span>
            </>
          ) : isGhost ? (
            `Claim ${targetAssetData.code} ($0.50 Account Activation Fee)`
          ) : (
            `Claim ${targetAssetData.code} (Gas-Free)`
          )}
        </motion.button>

        {isConnected && isGhost && (
          <div className="rounded-2xl border border-orange-500/10 bg-orange-500/5 p-4 text-xs text-orange-400 flex items-start gap-2 leading-relaxed text-left">
            <Info className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              <strong>First Claim Reservation</strong>: The Stellar ledger requires a base reserve deposit to activate a new wallet. We securely sponsor this requirement from the vault fee. No XLM gas is needed.
            </span>
          </div>
        )}
      </div>

    </motion.div>
  )
}

export default function ClaimPage() {
  return (
    <div className="relative min-h-screen bg-[#050505] text-zinc-105 flex flex-col font-sans select-none overflow-x-hidden">
      {/* Self-contained keyframes and styles */}
      <style>{`
        @keyframes routeDash {
          to {
            stroke-dashoffset: -24;
          }
        }
        .animate-route-dash {
          stroke-dasharray: 8, 4;
          animation: routeDash 1.2s linear infinite;
        }
        /* Custom pulsing glow animation */
        @keyframes pulseGlow {
          0%, 100% {
            box-shadow: 0 0 15px rgba(249, 115, 22, 0.05);
          }
          50% {
            box-shadow: 0 0 25px rgba(249, 115, 22, 0.15);
          }
        }
        .animate-pulse-glow {
          animation: pulseGlow 2s infinite ease-in-out;
        }
      `}</style>

      {/* Background Image Mesh */}
      <div
        className="absolute inset-0 bg-[url('/dashboard-bg.jpg')] bg-cover bg-center opacity-[0.06] pointer-events-none z-0 mix-blend-screen"
      />

      {/* Floating Ambient Gradients */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-orange-600/10 blur-[150px] pointer-events-none z-0" />
      <div className="absolute bottom-[20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-blue-600/5 blur-[180px] pointer-events-none z-0" />

      <Navbar />

      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-12">
        <Suspense fallback={
          <div className="flex min-h-[calc(100vh-5rem)] items-center justify-center px-4 py-12">
            <div className="flex items-center gap-3 text-zinc-400">
              <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
              <span>Loading secure portal...</span>
            </div>
          </div>
        }>
          <ClaimPageContent />
        </Suspense>
      </main>
    </div>
  )
}
