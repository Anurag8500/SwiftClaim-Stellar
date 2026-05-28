'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Loader2, CheckCircle } from 'lucide-react'
import { useWallet } from '@/contexts/WalletContext'
import { StellarWalletsKit, Networks } from '@creit.tech/stellar-wallets-kit'
import { ASSETS } from '@/lib/stellar'

interface VeteranSendProps {
  receiverPublicKey: string
}

export default function VeteranSend({ receiverPublicKey }: VeteranSendProps) {
  const [amount, setAmount] = useState('50')
  const [selectedAsset, setSelectedAsset] = useState('USDC')
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const { isConnected, publicKey, connectWallet } = useWallet()

  const selectedAssetData = ASSETS[selectedAsset as keyof typeof ASSETS]
  const estimatedFiatValue = parseFloat(amount) || 0
  const fixedFee = 0.001
  const totalCost = estimatedFiatValue + fixedFee
  const isBelowMinimum = estimatedFiatValue < 1.00

  const handleReset = () => {
    setAmount('50')
    setError(null)
    setSuccess(false)
  }

  const handleSend = async () => {
    setIsProcessing(true)
    setError(null)
    try {
      if (!amount || parseFloat(amount) <= 0) {
        alert('Please enter a valid amount greater than 0')
        setIsProcessing(false)
        return
      }
      if (!publicKey) {
        setIsProcessing(false)
        return
      }

      const buildRes = await fetch('/api/transfer/build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderPublicKey: publicKey,
          receiverPublicKey,
          amount,
          assetCode: selectedAsset,
          assetAddress: selectedAssetData.contractId,
        }),
      })
      const buildData = await buildRes.json()
      if (!buildRes.ok || buildData.error) {
        throw new Error(buildData.error || `Build failed with status ${buildRes.status}`)
      }
      const { xdr } = buildData

      const { signedTxXdr } = await StellarWalletsKit.signTransaction(xdr, {
        networkPassphrase: Networks.TESTNET,
        address: publicKey,
      })

      await fetch('/api/transfer/submit', {
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

  if (success) {
    return (
      <div className="space-y-6 text-center">
        <CheckCircle className="mx-auto h-16 w-16 text-green-400" />
        <h2 className="text-2xl font-bold text-zinc-50">Transfer Complete</h2>
        <p className="text-zinc-400">
          ${parseFloat(amount).toFixed(2)} {selectedAssetData.code} sent successfully.
        </p>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleReset}
          className="w-full rounded-2xl bg-blue-500 px-6 py-3 font-semibold text-white shadow-lg shadow-blue-500/30 hover:bg-blue-400 transition-colors"
        >
          Send Another Payment
        </motion.button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
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
          Amount to Send ({selectedAssetData.code})
        </label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="50.00"
          className="w-full rounded-2xl border border-zinc-800 bg-zinc-900/50 px-4 py-3 text-lg text-zinc-50 placeholder:text-zinc-600 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
      </div>

      {isBelowMinimum && amount && (
        <div className="rounded-2xl border border-red-500/30 bg-red-950/30 p-4 text-sm text-red-400">
          Transfer amount must be at least $1.00 USD equivalent.
        </div>
      )}

      {!isBelowMinimum && estimatedFiatValue > 0 && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-1">
          <div className="flex justify-between text-sm text-zinc-400">
            <span>Receiver gets</span>
            <span className="text-zinc-50">{estimatedFiatValue.toFixed(2)} {selectedAssetData.code}</span>
          </div>
          <div className="flex justify-between text-sm text-zinc-400">
            <span>Network fee</span>
            <span className="text-zinc-50">{fixedFee.toFixed(3)} {selectedAssetData.code}</span>
          </div>
          <div className="border-t border-zinc-800 pt-1 mt-1 flex justify-between text-sm font-semibold">
            <span className="text-zinc-300">You pay</span>
            <span className="text-blue-400">{totalCost.toFixed(3)} {selectedAssetData.code}</span>
          </div>
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
        onClick={isConnected ? handleSend : connectWallet}
        disabled={isProcessing || isBelowMinimum}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-500 px-6 py-3 font-semibold text-white shadow-lg shadow-blue-500/30 hover:bg-blue-400 disabled:opacity-70 transition-colors"
      >
        {isProcessing ? (
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            Processing...
          </div>
        ) : isConnected ? (
          'Send Gas-Free'
        ) : (
          'Connect Wallet to Send'
        )}
      </motion.button>
    </div>
  )
}
