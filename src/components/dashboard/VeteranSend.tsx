'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Loader2, CheckCircle } from 'lucide-react'
import { useWallet } from '@/contexts/WalletContext'
import { StellarWalletsKit, Networks } from '@creit.tech/stellar-wallets-kit'

export default function VeteranSend() {
  const [receiverPublicKey, setReceiverPublicKey] = useState('')
  const [amount, setAmount] = useState('50')
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const { isConnected, publicKey, connectWallet } = useWallet()

  const handleReset = () => {
    setReceiverPublicKey('')
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
      if (
        !receiverPublicKey ||
        receiverPublicKey.length !== 56 ||
        !receiverPublicKey.startsWith('G')
      ) {
        alert('Please enter a valid 56-character Stellar public key starting with G')
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
        }),
      })
      const { xdr } = await buildRes.json()

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
          ${parseFloat(amount).toFixed(2)} USDC sent successfully.
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
          Friend's Public Key
        </label>
        <input
          type="text"
          value={receiverPublicKey}
          onChange={(e) => setReceiverPublicKey(e.target.value)}
          placeholder="G..."
          className="w-full rounded-2xl border border-zinc-800 bg-zinc-900/50 px-4 py-3 text-lg text-zinc-50 placeholder:text-zinc-600 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-zinc-300">
          Amount to Send (USDC)
        </label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="50.00"
          className="w-full rounded-2xl border border-zinc-800 bg-zinc-900/50 px-4 py-3 text-lg text-zinc-50 placeholder:text-zinc-600 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-zinc-400">Amount:</span>
          <span className="text-zinc-100">${parseFloat(amount).toFixed(2)} USDC</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-zinc-400">Network Gas:</span>
          <span className="text-green-400">0 XLM (Covered)</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-zinc-400">Convenience Fee:</span>
          <span className="text-zinc-100">$0.001 USDC</span>
        </div>
        <div className="border-t border-zinc-800 pt-3 flex justify-between">
          <span className="text-sm font-medium text-zinc-300">Total:</span>
          <span className="text-lg font-bold text-blue-400">
            ${(parseFloat(amount) + 0.001).toFixed(3)} USDC
          </span>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-950/30 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={isConnected ? handleSend : connectWallet}
        disabled={isProcessing}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-500 px-6 py-3 font-semibold text-white shadow-lg shadow-blue-500/30 hover:bg-blue-400 disabled:opacity-70 transition-colors"
      >
        {isProcessing ? (
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            Processing...
          </div>
        ) : isConnected ? (
          'Send USDC Gas-Free'
        ) : (
          'Connect Wallet to Send'
        )}
      </motion.button>
    </div>
  )
}
