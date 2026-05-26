'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Loader2, CheckCircle } from 'lucide-react'
import { useWallet } from '@/contexts/WalletContext'
import { StellarWalletsKit, Networks } from '@creit.tech/stellar-wallets-kit'
import { checkIfGhost, fetchVaultData, ASSETS } from '@/lib/stellar'

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
  const [success, setSuccess] = useState(false)
  const [targetAsset, setTargetAsset] = useState('USDC')

  const targetAssetData = ASSETS[targetAsset as keyof typeof ASSETS]

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

  const handleClaim = async () => {
    if (!vaultId || !publicKey || !vaultData) return
    setIsProcessing(true)
    setError(null)
    try {
      const buildRes = await fetch('/api/claim/build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiverPublicKey: publicKey,
          routerAddress: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
          usdcAddress: ASSETS.USDC.contractId,
          targetAsset: targetAssetData.contractId,
          minPrincipalOut: '0',
          minFeeOut: '0',
          deadline: Math.floor(Date.now() / 1000) + 3600,
          amount: vaultData.amount,
          assetCode: vaultData.assetCode,
        }),
      })
      const { xdr } = await buildRes.json()

      const { signedTxXdr } = await StellarWalletsKit.signTransaction(xdr, {
        networkPassphrase: Networks.TESTNET,
        address: publicKey,
      })

      await fetch('/api/claim/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signedXdr: signedTxXdr }),
      })

      setSuccess(true)
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
    } finally {
      setIsProcessing(false)
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
          <h1 className="mt-4 text-2xl font-bold text-zinc-50">Transaction Settled.</h1>
          <p className="mt-2 text-zinc-400">
            Your wallet has been permanently activated. You now hold ${parseFloat(vaultData.amount).toFixed(2)} {targetAssetData.code} .
          </p>
          <button
            onClick={() => router.push('/dashboard')}
            className="mt-8 w-full rounded-2xl bg-blue-500 px-8 py-4 text-lg font-semibold text-white shadow-lg shadow-blue-500/30 hover:bg-blue-400 transition-colors"
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
            <span className="text-green-400">${parseFloat(vaultData.amount).toFixed(2)} {vaultData.assetCode}</span> waiting.
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
                    Processing Secure Claim...
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
  )
}
