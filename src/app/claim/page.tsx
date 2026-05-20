'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'

export default function ClaimPage() {
  const [isWalletConnected, setIsWalletConnected] = useState(false)

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8 backdrop-blur-sm text-center">
          <motion.h1
            key={isWalletConnected ? 'connected' : 'disconnected'}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl font-bold"
          >
            <span className="text-green-400">$500.00 USDC</span> waiting.
          </motion.h1>

          <p className="mt-2 text-zinc-400">Securely locked in SwiftClaim Vault.</p>

          <div className="mt-8 space-y-4">
            {!isWalletConnected ? (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsWalletConnected(true)}
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
                Claim USDC ($0.50 Network Activation Fee)
              </motion.button>
            )}

            <p className="text-xs text-zinc-500">
              The Stellar ledger requires a base deposit to activate a new wallet. We securely sponsor this requirement for you. No liquid gas is provided.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
