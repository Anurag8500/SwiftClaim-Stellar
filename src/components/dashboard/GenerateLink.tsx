'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Loader2, Copy, Check, ShieldCheck, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
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
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

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

      {mounted && typeof window !== 'undefined' && createPortal(
        <AnimatePresence>
          {link && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setLink('')}
                className="absolute inset-0 bg-black/85 backdrop-blur-2xl"
              />
              
              {/* Modal Content */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ type: 'spring', duration: 0.5 }}
                className="relative w-full max-w-xl rounded-3xl border border-orange-500/20 bg-[#0d0d0e]/95 p-8 md:p-10 shadow-[0_20px_50px_rgba(250,100,0,0.18)] backdrop-blur-xl overflow-hidden text-center space-y-6 z-10"
              >
                {/* Top-Right Close Button */}
                <button
                  type="button"
                  onClick={() => setLink('')}
                  className="absolute top-5 right-5 p-2 rounded-xl text-zinc-500 hover:text-white hover:bg-zinc-900 transition-all cursor-pointer z-20"
                >
                  <X className="h-5 w-5" />
                </button>

                {/* Top glow accent */}
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-orange-500/40 to-transparent" />
                
                {/* Header & Icon */}
                <div className="flex flex-col items-center gap-2">
                  <div className="p-4 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <ShieldCheck className="h-10 w-10" />
                  </div>
                  <h3 className="text-2xl font-black text-white tracking-tight">
                    SwiftLink Secured
                  </h3>
                  <p className="text-sm text-zinc-400 max-w-md leading-relaxed mx-auto">
                    Funds are locked in the escrow contract and only the designated recipient wallet can unlock them.
                  </p>
                </div>

                {/* Value Badge Details */}
                <div className="bg-[#070708]/60 border border-zinc-900 rounded-2xl p-5 flex flex-col items-center justify-center gap-2">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Locked Principal</span>
                  <span className="text-3xl font-black text-orange-400 font-mono tracking-tight">
                    {parseFloat(amount).toFixed(2)} {selectedAssetData.code}
                  </span>
                  <div className="text-xs text-zinc-450 font-mono border-t border-zinc-900/60 w-full pt-3 mt-1 flex justify-between px-2">
                    <span className="text-zinc-500">For Recipient:</span>
                    <span className="text-zinc-350">{receiverPublicKey}</span>
                  </div>
                </div>

                {/* Copy Area */}
                <div className="space-y-2 text-left">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider pl-1">
                    SwiftLink URL
                  </label>
                  <div className="flex flex-col sm:flex-row items-center gap-3">
                    <div className="w-full rounded-2xl border border-zinc-800 bg-[#070708]/80 px-4 py-3.5 font-mono text-xs text-zinc-300 break-all select-all flex-1 text-center sm:text-left select-none">
                      {link}
                    </div>
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-2xl bg-white text-black font-bold text-sm px-6 py-3.5 hover:bg-zinc-200 active:scale-95 transition-all shadow-md shrink-0 cursor-pointer"
                    >
                      {copied ? (
                        <>
                          <Check className="h-4 w-4 text-emerald-600 stroke-[3px]" />
                          <span className="text-emerald-700 font-extrabold">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4" />
                          <span>Copy Link</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Close Button */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setLink('')}
                    className="w-full rounded-2xl bg-zinc-900 border border-zinc-850 hover:bg-zinc-800 px-6 py-4 font-bold text-sm text-zinc-400 hover:text-white transition-all cursor-pointer shadow-sm"
                  >
                    Done
                  </button>
                </div>

              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  )
}
