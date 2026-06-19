'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Loader2,
  CheckCircle,
  Lock,
  ShieldCheck,
  AlertCircle,
  Info,
  Wallet,
  RefreshCw,
  ArrowRight,
  Coins,
} from 'lucide-react'
import { useWallet } from '@/contexts/WalletContext'
import { StellarWalletsKit, Networks } from '@creit.tech/stellar-wallets-kit'
import { checkIfGhost } from '@/lib/stellar'
import Navbar from '@/components/layout/Navbar'

// ─── Types ────────────────────────────────────────────────────────────────────
interface VaultDeposit {
  index: number
  asset: string
  assetCode: string
  amount: string
  amountDisplay: string
}

interface AssetTotal {
  asset: string
  assetCode: string
  amount: string
  feeAmount: string
  principal: string
  amountDisplay: string
  feeDisplay: string
  principalDisplay: string
}

// Asset color tokens for display
const ASSET_COLORS: Record<string, { dot: string; badge: string; text: string }> = {
  USDC: {
    dot: 'bg-blue-500',
    badge: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
    text: 'text-blue-400',
  },
  EURC: {
    dot: 'bg-violet-400',
    badge: 'bg-violet-500/10 border-violet-500/20 text-violet-400',
    text: 'text-violet-400',
  },
}
function assetColor(code: string) {
  return ASSET_COLORS[code] ?? {
    dot: 'bg-orange-400',
    badge: 'bg-orange-500/10 border-orange-500/20 text-orange-400',
    text: 'text-orange-400',
  }
}

// ─── Main Content ─────────────────────────────────────────────────────────────
function ClaimPageContent() {
  const searchParams = useSearchParams()
  const vaultId = searchParams.get('vault')   // = receiver public key
  const router = useRouter()
  const { isConnected, publicKey, connectWallet, setIsGhost, isGhost, disconnectWallet } = useWallet()

  const [loadingVault, setLoadingVault] = useState(true)
  const [vaultError, setVaultError] = useState<string | null>(null)
  const [deposits, setDeposits] = useState<VaultDeposit[]>([])
  const [assetTotals, setAssetTotals] = useState<AssetTotal[]>([])

  const [isAuthorized, setIsAuthorized] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
  const [stepMessage, setStepMessage] = useState('Processing...')
  const [success, setSuccess] = useState(false)
  const [claimedAssetTotals, setClaimedAssetTotals] = useState<AssetTotal[]>([])

  // ── Load vault deposits from /api/vault ────────────────────────────────────
  useEffect(() => {
    async function loadDeposits() {
      if (!vaultId) {
        setVaultError('No vault ID provided in URL.')
        setLoadingVault(false)
        return
      }
      try {
        const res = await fetch(`/api/vault?receiver=${vaultId}`)
        const data = await res.json()
        if (!res.ok || data.error) {
          throw new Error(data.error || 'Failed to fetch vault data')
        }
        if (!data.deposits || data.deposits.length === 0) {
          setVaultError('Vault Not Found or Already Claimed')
        } else {
          setDeposits(data.deposits)
          setAssetTotals(data.assetTotals || [])
        }
      } catch (err) {
        setVaultError(err instanceof Error ? err.message : 'Vault Not Found')
      } finally {
        setLoadingVault(false)
      }
    }
    loadDeposits()
  }, [vaultId])

  // ── Authorization check ────────────────────────────────────────────────────
  useEffect(() => {
    if (isConnected && publicKey && vaultId) {
      if (publicKey !== vaultId) {
        setIsAuthorized(false)
      } else {
        setIsAuthorized(true)
        checkIfGhost(publicKey)
          .then(setIsGhost)
          .catch(() => setIsGhost(null))
      }
    } else {
      setIsAuthorized(true)
    }
  }, [isConnected, publicKey, vaultId, setIsGhost])

  // ── Claim handler ──────────────────────────────────────────────────────────
  const handleClaim = async () => {
    if (!vaultId || !publicKey || deposits.length === 0) return
    setIsProcessing(true)
    setVaultError(null)

    try {
      const isGhostWallet = isGhost

      // ── Phase 1: Activate ghost wallet (if needed) ─────────────────────
      if (isGhostWallet) {
        setStepMessage('Building wallet activation...')
        const uniqueAssets = [...new Set(deposits.map(d => d.asset))]
        const activateRes = await fetch('/api/claim/activate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            receiverPublicKey: publicKey,
            assetContractIds: uniqueAssets,
          }),
        })
        const activateData = await activateRes.json()
        if (!activateRes.ok || activateData.error) {
          throw new Error(activateData.error || 'Failed to build activation transaction')
        }

        setStepMessage('Sign wallet activation...')
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

        // Wait for ledger close so simulation sees the new account
        await new Promise(resolve => setTimeout(resolve, 6000))
      }

      // ── Phase 2: Build claim transaction ───────────────────────────────
      setStepMessage('Fetching live oracle prices...')
      const buildRes = await fetch('/api/claim/build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiverPublicKey: publicKey }),
      })
      const buildData = await buildRes.json()
      if (!buildRes.ok || buildData.error) {
        throw new Error(buildData.error || 'Claim build failed')
      }

      // ── Phase 3: Sign claim ────────────────────────────────────────────
      setStepMessage('Sign claim transaction...')
      let signedClaimXdr: string
      try {
        const { signedTxXdr } = await StellarWalletsKit.signTransaction(
          buildData.xdr,
          { networkPassphrase: Networks.TESTNET, address: publicKey }
        )
        signedClaimXdr = signedTxXdr
      } catch (signErr) {
        // If the wallet rejects signing, clear stale session
        disconnectWallet()
        throw new Error(
          'Wallet signing was rejected. Please reconnect your wallet and try again.'
        )
      }

      // ── Phase 4: Submit ────────────────────────────────────────────────
      setStepMessage('Submitting to the Stellar network...')
      const submitRes = await fetch('/api/claim/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signedXdr: signedClaimXdr }),
      })
      const submitData = await submitRes.json()
      if (!submitRes.ok || submitData.error) {
        throw new Error(submitData.error || 'Claim submission failed')
      }

      // Success — snapshot deposits for the success screen
      setClaimedAssetTotals([...assetTotals])
      setSuccess(true)
    } catch (err) {
      console.error(err)
      setVaultError(err instanceof Error ? err.message : 'An unexpected error occurred')
    } finally {
      setIsProcessing(false)
      setStepMessage('Processing...')
    }
  }

  const totalSummary = assetTotals.map(t => ({
    assetCode: t.assetCode,
    totalDisplay: t.principalDisplay
  }))

  // ── Render States ──────────────────────────────────────────────────────────

  if (loadingVault) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-zinc-400">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
        <span className="text-sm font-medium">Decrypting vault lockbox...</span>
      </div>
    )
  }

  if (vaultError && deposits.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md rounded-3xl border border-red-500/20 bg-red-950/5 p-8 backdrop-blur-xl shadow-2xl text-center space-y-6 relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-red-500/30 to-transparent" />
        <div className="p-3.5 rounded-2xl bg-red-500/10 text-red-400 border border-red-500/20 w-fit mx-auto">
          <AlertCircle className="h-7 w-7" />
        </div>
        <h1 className="text-xl font-bold text-white tracking-tight">{vaultError}</h1>
        <p className="text-sm text-zinc-400 leading-relaxed">
          The requested SwiftLink vault does not exist or may have already been claimed.
        </p>
        <button
          onClick={() => router.push('/dashboard')}
          className="w-full rounded-2xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 px-6 py-3.5 font-bold text-sm text-zinc-300 transition-colors cursor-pointer"
        >
          Go to Dashboard
        </button>
      </motion.div>
    )
  }

  if (!isConnected || !publicKey) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md rounded-3xl border border-zinc-900 bg-[#0d0d0e]/60 p-8 backdrop-blur-xl shadow-2xl text-center space-y-6 relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-orange-500/30 to-transparent" />
        <div className="flex flex-col items-center gap-3">
          <div className="p-3.5 rounded-2xl bg-orange-500/10 text-orange-500 border border-orange-500/20 shadow-md">
            <Lock className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">Private SwiftLink Vault</h2>
          <p className="text-sm text-zinc-400 leading-relaxed">
            Funds are secured on the Stellar blockchain. Only the designated recipient wallet can inspect and claim them.
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-800/80 bg-[#070708]/50 p-4 space-y-3 text-left">
          {[
            'Connect your recipient Stellar wallet.',
            'Verify your wallet is the authorized claimant.',
            'Claim all your funds gas-free in one click.',
          ].map((step, i) => (
            <div key={i} className="flex gap-3 items-start text-xs text-zinc-400">
              <span className="h-5 w-5 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] text-zinc-300 font-bold shrink-0">
                {i + 1}
              </span>
              <span>{step}</span>
            </div>
          ))}
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

  if (!isAuthorized) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md rounded-3xl border border-red-500/20 bg-[#0d0d0e]/60 p-8 backdrop-blur-xl shadow-2xl text-center space-y-6 relative overflow-hidden"
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
            <span className="text-zinc-500">Connected:</span>
            <span className="font-mono text-red-400 font-bold">
              {publicKey.slice(0, 8)}...{publicKey.slice(-8)}
            </span>
          </div>
          <div className="flex justify-between pt-1">
            <span className="text-zinc-500">Authorized Claimant:</span>
            <span className="font-mono text-emerald-400 font-bold">
              {vaultId?.slice(0, 8)}...{vaultId?.slice(-8)}
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
            Switch Wallet
          </motion.button>
          <button
            onClick={() => router.push('/dashboard')}
            className="w-full rounded-2xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 px-6 py-3 text-xs font-semibold text-zinc-400 transition-colors cursor-pointer"
          >
            Go to Dashboard
          </button>
        </div>
      </motion.div>
    )
  }

  if (success) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', duration: 0.5 }}
        className="w-full max-w-md rounded-3xl border border-zinc-900 bg-[#0d0d0e]/60 p-8 backdrop-blur-xl shadow-2xl text-center space-y-6 relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />

        {/* Success icon with pulse ring */}
        <div className="relative w-fit mx-auto">
          <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping opacity-60" />
          <div className="relative p-3.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <CheckCircle className="h-10 w-10" />
          </div>
        </div>

        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Transaction Settled</h1>
          <p className="text-sm text-zinc-400 mt-1">Funds claimed and transferred to your wallet.</p>
        </div>

        {/* Claimed amounts breakdown */}
        <div className="rounded-2xl bg-[#070708]/70 border border-zinc-900 p-5 text-left space-y-4">
          <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 block">
            You Claimed
          </span>

          {claimedAssetTotals.map((t) => {
            const colors = assetColor(t.assetCode)
            return (
              <div key={t.assetCode} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold flex items-center gap-1.5 ${colors.text}`}>
                    <span className={`h-2 w-2 rounded-full ${colors.dot}`} />
                    {t.assetCode}
                  </span>
                  <span className="text-emerald-400 font-black font-mono text-base">
                    +{t.principalDisplay}
                  </span>
                </div>
                <div className="flex justify-between text-[10px] text-zinc-500">
                  <span>Locked: {t.amountDisplay} — Consumed Fee: {t.feeDisplay}</span>
                </div>
              </div>
            )
          })}

          {claimedAssetTotals.length > 1 && (
            <div className="border-t border-zinc-900 pt-3 flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Total Received</span>
              {claimedAssetTotals.map((t) => {
                const colors = assetColor(t.assetCode)
                return (
                  <div key={t.assetCode} className="flex justify-between items-center">
                    <span className={`text-xs font-semibold ${colors.text}`}>{t.assetCode}</span>
                    <span className="font-mono font-black text-white text-sm">{t.principalDisplay}</span>
                  </div>
                )
              })}
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

  // ── Active Claim State ───────────────────────────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-md rounded-3xl border border-zinc-900 bg-[#0d0d0e]/60 p-6 md:p-8 backdrop-blur-xl shadow-2xl space-y-5 relative overflow-hidden"
    >
      {/* Top orange accent line */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-orange-500/40 to-transparent" />

      {/* Header */}
      <div className="flex justify-between items-center pb-4 border-b border-zinc-900/60">
        <h3 className="text-sm font-extrabold text-white flex items-center gap-1.5">
          <ShieldCheck className="h-4 w-4 text-emerald-400" />
          SwiftLink Vault
        </h3>
        <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-widest bg-emerald-500/10 px-2.5 py-1 rounded-full flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Verified Receiver
        </span>
      </div>

      {/* Deposit count badge */}
      {deposits.length > 1 && (
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <Coins className="h-3.5 w-3.5 text-orange-400" />
          <span><span className="text-white font-semibold">{deposits.length}</span> deposits pending — all claimed in one transaction</span>
        </div>
      )}

      {/* Grouped asset cards */}
      <div className="space-y-4">
        {assetTotals.map((total, i) => {
          const colors = assetColor(total.assetCode)
          const assetDeposits = deposits.filter(d => d.assetCode === total.assetCode)

          return (
            <motion.div
              key={total.assetCode}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="rounded-2xl border border-zinc-800/70 bg-[#080809]/60 p-5 space-y-4"
            >
              {/* Asset header */}
              <div className="flex items-center justify-between">
                <span className={`text-xs font-bold px-3 py-1 rounded-full border ${colors.badge} flex items-center gap-1.5`}>
                  <span className={`h-2.5 w-2.5 rounded-full ${colors.dot}`} />
                  {total.assetCode} Vault
                </span>
                <span className="text-[10px] font-semibold text-zinc-500">
                  {assetDeposits.length} deposit{assetDeposits.length > 1 ? 's' : ''}
                </span>
              </div>

              {/* Breakdown rows */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-400">Total locked amount</span>
                  <span className="font-mono text-zinc-200 font-medium">{total.amountDisplay} {total.assetCode}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-400 flex items-center gap-1">
                    Consolidated Fee
                    <span className="text-[9px] text-zinc-600">(1% or $0.50 min)</span>
                  </span>
                  <span className="font-mono text-red-400">−{total.feeDisplay} {total.assetCode}</span>
                </div>
                <div className="border-t border-zinc-800/60 pt-2 flex justify-between text-xs font-bold">
                  <span className="text-zinc-100">You claim net</span>
                  <span className="font-mono text-emerald-400 text-sm">+{total.principalDisplay} {total.assetCode}</span>
                </div>
              </div>

              {/* Nested individual deposits breakdown */}
              {assetDeposits.length > 1 && (
                <div className="mt-3 pt-3 border-t border-zinc-900/60 space-y-1.5">
                  <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold block mb-1">
                    Included Deposits
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {assetDeposits.map((d, idx) => (
                      <div key={d.index} className="flex justify-between items-center bg-[#0d0d0e]/40 border border-zinc-900/80 rounded-xl px-3 py-2 text-[11px] text-zinc-400">
                        <span className="text-zinc-500">#{idx + 1}</span>
                        <span className="font-mono font-medium text-zinc-300">{d.amountDisplay} {d.assetCode}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )
        })}
      </div>

      {/* Total summary (only when multiple deposits) */}
      {deposits.length > 1 && (
        <div className="rounded-2xl border border-orange-500/10 bg-orange-500/5 p-4 space-y-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-orange-400 flex items-center gap-1.5">
            <ArrowRight className="h-3 w-3" />
            Total You Receive
          </span>
          {totalSummary.map(({ assetCode, totalDisplay }) => {
            const colors = assetColor(assetCode)
            return (
              <div key={assetCode} className="flex justify-between items-center">
                <span className={`text-xs font-semibold ${colors.text}`}>{assetCode}</span>
                <span className="font-mono font-black text-white text-base">{totalDisplay}</span>
              </div>
            )
          })}
        </div>
      )}

      {/* Error display */}
      {vaultError && (
        <div className="rounded-2xl border border-red-500/20 bg-red-950/20 p-3.5 text-xs text-red-400 flex items-start gap-2">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>{vaultError}</span>
        </div>
      )}

      {/* Ghost wallet info */}
      {isConnected && isGhost && (
        <div className="rounded-2xl border border-orange-500/10 bg-orange-500/5 p-4 text-xs text-orange-400 flex items-start gap-2 leading-relaxed">
          <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>
            <strong>First-Time Activation</strong>: Your wallet will be created on-chain
            and trustlines established — all sponsored by SwiftClaim. No XLM needed.
          </span>
        </div>
      )}

      {/* Claim button */}
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={handleClaim}
        disabled={isProcessing || deposits.length === 0}
        className="w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 px-6 py-4 font-bold text-white shadow-lg shadow-emerald-500/20 border border-emerald-500/20 disabled:opacity-70 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 cursor-pointer"
      >
        {isProcessing ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">{stepMessage}</span>
          </>
        ) : (
          <>
            <ShieldCheck className="h-5 w-5" />
            {isGhost
              ? `Activate & Claim All (${deposits.length} deposit${deposits.length > 1 ? 's' : ''})`
              : `Claim All — Gas-Free (${deposits.length} deposit${deposits.length > 1 ? 's' : ''})`
            }
          </>
        )}
      </motion.button>

      {/* Stellar network note */}
      <p className="text-center text-[10px] text-zinc-600 leading-relaxed">
        Secured by the Stellar blockchain · Soroban smart contract · Zero XLM required
      </p>
    </motion.div>
  )
}

// ─── Page Wrapper ─────────────────────────────────────────────────────────────
export default function ClaimPage() {
  return (
    <div className="relative min-h-screen bg-[#050505] text-zinc-100 flex flex-col font-sans select-none overflow-x-hidden">
      {/* Ambient gradients */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-orange-600/8 blur-[150px] pointer-events-none z-0" />
      <div className="absolute bottom-[20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-blue-600/4 blur-[180px] pointer-events-none z-0" />
      <div className="absolute inset-0 bg-[url('/dashboard-bg.jpg')] bg-cover bg-center opacity-[0.05] pointer-events-none z-0 mix-blend-screen" />

      <Navbar />

      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-12">
        <Suspense
          fallback={
            <div className="flex items-center gap-3 text-zinc-400">
              <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
              <span className="text-sm">Loading secure portal...</span>
            </div>
          }
        >
          <ClaimPageContent />
        </Suspense>
      </main>
    </div>
  )
}
