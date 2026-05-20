'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import { useWallet } from '@/contexts/WalletContext'
import { checkIfGhost, fetchVaultData } from '@/lib/stellar'

function ClaimPageContent() {
  const searchParams = useSearchParams()
  const vaultId = searchParams.get('vault')
  const { isConnected, publicKey, connectWallet, setIsGhost, isGhost } = useWallet()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [vaultData, setVaultData] = useState<{ amount: string; claimant: string } | null>(null)
  const [isAuthorized, setIsAuthorized] = useState(true)

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
            <span className="text-green-400">${parseFloat(vaultData.amount).toFixed(2)} USDC</span> waiting.
          </motion.h1>

          <p className="mt-2 text-zinc-400">Securely locked in SwiftClaim Vault.</p>

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
                className="w-full rounded-2xl bg-green-500 px-8 py-4 text-lg font-semibold text-white shadow-lg shadow-green-500/30 hover:bg-green-400 transition-colors"
              >
                {isGhost ? 'Claim USDC ($0.50 Network Activation Fee)' : 'Claim USDC (Gas-Free)'}
              </motion.button>
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
