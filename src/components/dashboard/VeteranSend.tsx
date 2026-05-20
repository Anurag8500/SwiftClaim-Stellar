'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'

export default function VeteranSend() {
  const [publicKey, setPublicKey] = useState('')
  const [amount, setAmount] = useState('50')

  return (
    <div className="space-y-6">
      <div>
        <label className="mb-2 block text-sm font-medium text-zinc-300">
          Friend's Public Key
        </label>
        <input
          type="text"
          value={publicKey}
          onChange={(e) => setPublicKey(e.target.value)}
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

      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-500 px-6 py-3 font-semibold text-white shadow-lg shadow-blue-500/30 hover:bg-blue-400 transition-colors"
      >
        Send USDC Gas-Free
      </motion.button>
    </div>
  )
}
