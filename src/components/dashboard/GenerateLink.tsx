'use client'

import { useState } from 'react'
import { Loader2, Copy, Check } from 'lucide-react'
import { motion } from 'framer-motion'
import { useWallet } from '@/contexts/WalletContext'
import { StellarWalletsKit, Networks } from '@creit.tech/stellar-wallets-kit'
import * as StellarSdk from '@stellar/stellar-sdk'
import { ASSETS, server, submitToNetwork } from '@/lib/stellar'

interface GenerateLinkProps {
  receiverPublicKey: string
  amount?: string
  setAmount?: (val: string) => void
  selectedAsset?: string
  setSelectedAsset?: (val: string) => void
}

export default function GenerateLink({
  receiverPublicKey,
  amount: propAmount,
  setAmount: propSetAmount,
  selectedAsset: propSelectedAsset,
  setSelectedAsset: propSetSelectedAsset
}: GenerateLinkProps) {
  const [localAmount, localSetAmount] = useState('')
  const [localSelectedAsset, localSetSelectedAsset] = useState('USDC')

  const amount = propAmount !== undefined ? propAmount : localAmount
  const setAmount = propSetAmount !== undefined ? propSetAmount : localSetAmount
  const selectedAsset = propSelectedAsset !== undefined ? propSelectedAsset : localSelectedAsset
  const setSelectedAsset = propSetSelectedAsset !== undefined ? propSetSelectedAsset : localSetSelectedAsset
  const [isLoading, setIsLoading] = useState(false)
  const [link, setLink] = useState('')
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { isConnected, publicKey: userPublicKey, connectWallet } = useWallet()

  const selectedAssetData = ASSETS[selectedAsset as keyof typeof ASSETS]
  const estimatedFiatValue = parseFloat(amount) || 0
  const isBelowMinimum = estimatedFiatValue < 1.00

  const handleGenerate = async () => {
    setError(null)
    setIsLoading(true)
    try {
      if (!amount || parseFloat(amount) <= 0) {
        alert('Please enter a valid amount greater than 0')
        setIsLoading(false)
        return
      }
      if (
        !receiverPublicKey ||
        receiverPublicKey.length !== 56 ||
        !receiverPublicKey.startsWith('G')
      ) {
        alert('Please enter a valid 56-character Stellar public key starting with G')
        setIsLoading(false)
        return
      }
      if (!userPublicKey) {
        setIsLoading(false)
        return
      }

      // Phase A: Build transaction
      const buildRes = await fetch('/api/lock/build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderPublicKey: userPublicKey,
          receiverPublicKey,
          assetAddress: selectedAssetData.contractId,
          amount,
        }),
      })
      const buildData = await buildRes.json()
      if (!buildRes.ok || buildData.error) {
        throw new Error(buildData.error || `Build failed with status ${buildRes.status}`)
      }
      const { xdr } = buildData

      // Phase B: Sign with Freighter
      const { signedTxXdr } = await StellarWalletsKit.signTransaction(xdr, {
        networkPassphrase: Networks.TESTNET,
        address: userPublicKey,
      })

      const submitRes = await fetch('/api/lock/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signedXdr: signedTxXdr }),
      })
      const submitData = await submitRes.json()
      if (!submitRes.ok || submitData.error) {
        throw new Error(submitData.error || `Submit failed with status ${submitRes.status}`)
      }

      // Link generation: vaultId is receiverPublicKey
      setLink(`${window.location.origin}/claim?vault=${receiverPublicKey}`)
    } catch (err) {
      console.error(err)
      setError(
        err instanceof Error ? err.message : 'An unexpected error occurred'
      )
    } finally {
      setIsLoading(false)
    }
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const isParentControlled = propAmount !== undefined

  return (
    <div className="space-y-6">
      {!isParentControlled && (
        <>
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-300">
              Asset
            </label>
            <select
              value={selectedAsset}
              onChange={(e) => setSelectedAsset(e.target.value)}
              className="w-full rounded-2xl border border-zinc-800 bg-zinc-900/50 px-4 py-3 text-lg text-zinc-50 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              {Object.entries(ASSETS).map(([key, asset]) => (
                <option key={key} value={key}>
                  {asset.code}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-300">
              Transfer Amount ({selectedAssetData.code})
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="50.00"
              className="w-full rounded-2xl border border-zinc-800 bg-zinc-900/50 px-4 py-3 text-lg text-zinc-50 placeholder:text-zinc-600 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>
        </>
      )}

      {isBelowMinimum && amount && (
        <div className="rounded-2xl border border-red-500/30 bg-red-950/30 p-4 text-sm text-red-400">
          Transfer amount must be at least $1.00 USD equivalent.
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-950/30 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={isConnected ? handleGenerate : connectWallet}
        disabled={isLoading || isBelowMinimum}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#ff5500] to-[#ff7700] hover:from-[#e04b00] hover:to-[#ff5500] px-6 py-4 font-bold text-white shadow-lg shadow-orange-500/25 border border-orange-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
      >
        {isLoading ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            Generating...
          </>
        ) : isConnected ? (
          'Generate SwiftLink'
        ) : (
          'Connect Wallet to Generate'
        )}
      </motion.button>

      {link && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-400">Your SwiftLink:</span>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 text-sm text-orange-500 hover:text-orange-400"
            >
              {copied ? (
                <Check className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <p className="mt-2 break-all text-sm font-mono text-zinc-300">
            {link}
          </p>
        </motion.div>
      )}
    </div>
  )
}
