'use client'

import { useState } from 'react'
import { Loader2, Copy, Check } from 'lucide-react'
import { motion } from 'framer-motion'
import { useWallet } from '@/contexts/WalletContext'
import { StellarWalletsKit, Networks } from '@creit.tech/stellar-wallets-kit'
import * as StellarSdk from '@stellar/stellar-sdk'
import { TESTNET_USDC, server, submitToNetwork } from '@/lib/stellar'

export default function GenerateLink() {
  const [amount, setAmount] = useState('')
  const [receiverPublicKey, setReceiverPublicKey] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [link, setLink] = useState('')
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { isConnected, publicKey: userPublicKey, connectWallet } = useWallet()

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

      const sourceAccount = await server.loadAccount(userPublicKey)
      const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: StellarSdk.Networks.TESTNET,
      })
        .addOperation(
          StellarSdk.Operation.createClaimableBalance({
            asset: TESTNET_USDC,
            amount: amount.toString(),
            claimants: [
              new StellarSdk.Claimant(
                receiverPublicKey,
                StellarSdk.Claimant.predicateUnconditional()
              ),
            ],
          })
        )
        .setTimeout(StellarSdk.TimeoutInfinite)
        .build()

      const { signedTxXdr } = await StellarWalletsKit.signTransaction(
        transaction.toXDR(),
        {
          networkPassphrase: Networks.TESTNET,
          address: userPublicKey,
        }
      )

      const signedTx = StellarSdk.TransactionBuilder.fromXDR(
        signedTxXdr,
        StellarSdk.Networks.TESTNET
      ) as StellarSdk.Transaction

      const response = await submitToNetwork(signedTx)

      // Synchronously parse the XDR receipt to extract the Vault ID instantly
      const txResult = StellarSdk.xdr.TransactionResult.fromXDR(
        response.result_xdr,
        'base64'
      )
      const results = txResult.result().results()
      const opResult = (results[0].tr() as any).createClaimableBalanceResult()

      // Use .toHex() to extract the correct Claimable Balance ID format
      const vaultId = opResult.balanceId().toHex()

      setLink(`${window.location.origin}/claim?vault=${vaultId}`)
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

  return (
    <div className="space-y-6">
      <div>
        <label className="mb-2 block text-sm font-medium text-zinc-300">
          Transfer Amount (USDC)
        </label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="50.00"
          className="w-full rounded-2xl border border-zinc-800 bg-zinc-900/50 px-4 py-3 text-lg text-zinc-50 placeholder:text-zinc-600 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-zinc-300">
          Receiver's Public Key
        </label>
        <input
          type="text"
          value={receiverPublicKey}
          onChange={(e) => setReceiverPublicKey(e.target.value)}
          placeholder="G..."
          className="w-full rounded-2xl border border-zinc-800 bg-zinc-900/50 px-4 py-3 text-lg text-zinc-50 placeholder:text-zinc-600 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
      </div>

      {error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-950/30 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={isConnected ? handleGenerate : connectWallet}
        disabled={isLoading}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-500 px-6 py-3 font-semibold text-white shadow-lg shadow-blue-500/30 hover:bg-blue-400 disabled:opacity-70 transition-colors"
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
              className="flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300"
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
