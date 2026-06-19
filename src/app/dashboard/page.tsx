'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  Wallet,
  HelpCircle,
  Lock,
  Link as LinkIcon,
  CheckCircle2,
  AlertCircle,
  Loader2,
  TrendingUp,
  ShieldCheck,
  ChevronRight,
  Info,
  Layers
} from 'lucide-react'
import GenerateLink from '@/components/dashboard/GenerateLink'
import VeteranSend from '@/components/dashboard/VeteranSend'
import { checkIfGhost, ASSETS, isValidPublicKey } from '@/lib/stellar'
import Navbar from '@/components/layout/Navbar'
import { useWallet } from '@/contexts/WalletContext'
import Link from 'next/link'

export default function DashboardPage() {
  const { isConnected, publicKey: userPublicKey, connectWallet, disconnectWallet } = useWallet()
  const [destinationPublicKey, setDestinationPublicKey] = useState('')
  const [isGhost, setIsGhost] = useState<boolean | null>(null)
  const [isChecking, setIsChecking] = useState(false)
  const [amount, setAmount] = useState('50')
  const [selectedAsset, setSelectedAsset] = useState('USDC')
  const [isAssetDropdownOpen, setIsAssetDropdownOpen] = useState(false)
  const [eurcPrice, setEurcPrice] = useState<number | null>(null)

  // Fetch live EURC price only when EURC is selected
  useEffect(() => {
    if (selectedAsset !== 'EURC') {
      return
    }

    let active = true
    async function fetchEurcPrice() {
      try {
        const res = await fetch('/api/price?asset=EURC')
        const data = await res.json()
        if (active && data.price) {
          setEurcPrice(data.price)
        }
      } catch (err) {
        console.error('Error fetching EURC price:', err)
      }
    }

    fetchEurcPrice()
    const interval = setInterval(fetchEurcPrice, 30000)
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [selectedAsset])

  // Live route detection logic
  useEffect(() => {
    async function checkGhostStatus() {
      if (isValidPublicKey(destinationPublicKey)) {
        setIsChecking(true)
        setIsGhost(null)
        try {
          const ghost = await checkIfGhost(destinationPublicKey)
          setIsGhost(ghost)
        } catch (error) {
          console.error('Error checking ghost status:', error)
          setIsGhost(null) // Do NOT default to ghost on network error
        } finally {
          setIsChecking(false)
        }
      } else {
        setIsGhost(null)
      }
    }
    checkGhostStatus()
  }, [destinationPublicKey])

  const isValidAddress = isValidPublicKey(destinationPublicKey)

  // Live calculations for Preview Panel
  const assetData = ASSETS[selectedAsset as keyof typeof ASSETS]
  // eurcPrice may be null while loading — use null-coalescing to keep math safe
  const assetPrice = selectedAsset === 'USDC' ? 1.0 : (eurcPrice ?? null)
  const numAmount = parseFloat(amount) || 0
  const amountInUsd = assetPrice !== null ? numAmount * assetPrice : 0

  // Fee Calculation:
  // Active Route (Direct): Flat 0.001 USDC equivalent (Paid by Sender)
  // Vault Route (SwiftLink): 1% claim fee (Min $0.50, Max $3.00 USD value) deducted from Recipient upon claim.
  let senderFeeInUsd = 0
  let recipientFeeInUsd = 0

  if (numAmount > 0) {
    if (isGhost === false) {
      senderFeeInUsd = 0.001
    } else if (isGhost === true) {
      recipientFeeInUsd = Math.max(0.50, Math.min(3.00, amountInUsd * 0.01))
    }
  }

  const senderFeeInToken = assetPrice !== null && assetPrice > 0 ? senderFeeInUsd / assetPrice : 0
  const recipientFeeInToken = assetPrice !== null && assetPrice > 0 ? recipientFeeInUsd / assetPrice : 0

  const totalDeductedFromSender = numAmount + senderFeeInToken
  const totalReceivedByRecipient = numAmount - recipientFeeInToken

  const truncateAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-6)}`
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className="relative min-h-screen bg-[#050505] text-zinc-100 flex flex-col font-sans select-none overflow-x-hidden"
    >

      {/* Self-contained keyframes and styles */}
      <style>{`
        @keyframes routeDash {
          to {
            stroke-dashoffset: -24;
          }
        }
        .animate-route-dash-green {
          stroke-dasharray: 8, 4;
          animation: routeDash 1.2s linear infinite;
        }
        .animate-route-dash-orange {
          stroke-dasharray: 8, 4;
          animation: routeDash 1.2s linear infinite;
        }
        /* Hide number spinners */
        input[type="number"]::-webkit-outer-spin-button,
        input[type="number"]::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        input[type="number"] {
          -moz-appearance: textfield;
        }
      `}</style>

      {/* Background Image Mesh */}
      <div
        className="absolute inset-0 bg-[url('/dashboard-bg.jpg')] bg-cover bg-center opacity-[0.06] pointer-events-none z-0 mix-blend-screen"
      />

      {/* Floating Ambient Gradients */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-orange-600/10 blur-[150px] pointer-events-none z-0" />
      <div className="absolute bottom-[20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-blue-600/5 blur-[180px] pointer-events-none z-0" />

      {/* Top Navbar: Clean premium header with logo left, connect right (no center links) */}
      <nav className="relative z-50 border-b border-zinc-900/60 bg-[#050505]/40 backdrop-blur-md">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6 lg:px-8">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <img src="/logo.png" alt="SwiftClaim Logo" className="h-16 w-16 object-contain" />
            <span className="text-xl font-bold tracking-tight text-white uppercase group-hover:text-white/80 transition-colors">
              SwiftClaim
            </span>
          </Link>

          {/* Connected Wallet Capsule */}
          <div>
            {isConnected && userPublicKey ? (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={disconnectWallet}
                className="px-6 py-2.5 text-sm font-bold tracking-tight text-[#fa6400] bg-white rounded-full hover:bg-white/95 shadow-[0_4px_20px_rgba(250,100,0,0.15)] transition-all flex items-center gap-2"
              >
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                {truncateAddress(userPublicKey)}
              </motion.button>
            ) : (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={connectWallet}
                className="px-6 py-2.5 text-sm font-bold tracking-tight text-[#fa6400] bg-white rounded-full hover:bg-white/95 shadow-lg transition-all"
              >
                Connect Wallet
              </motion.button>
            )}
          </div>
        </div>
      </nav>

      {/* Main Container */}
      <main className="relative z-10 flex-1 max-w-7xl mx-auto w-full px-6 lg:px-8 py-12 flex flex-col gap-10">

        {/* Main Hero Header */}
        <div className="text-center md:text-left space-y-4 max-w-3xl">
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white leading-tight">
            Send Value.<br />
            We'll Handle The Route.
          </h1>
          <p className="text-base md:text-lg text-zinc-400 max-w-2xl">
            Enter a destination address. SwiftClaim automatically determines the safest and most efficient way to deliver funds.
          </p>
        </div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

          {/* LEFT SIDE: Inputs & Route Visualizer (Col 1 to 7) */}
          <div className="lg:col-span-7 space-y-8">

            {/* Input Panel Card */}
            <div className="rounded-3xl border border-zinc-900 bg-[#0d0d0e]/60 p-6 md:p-8 backdrop-blur-xl space-y-6">

              {/* Destination Public Key */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Destination Public Key
                  </label>
                  {isValidAddress && (
                    <span className="text-xs text-emerald-400 flex items-center gap-1 font-mono">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      Valid Address format
                    </span>
                  )}
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={destinationPublicKey}
                    onChange={(e) => setDestinationPublicKey(e.target.value)}
                    placeholder="Enter recipient Stellar public key (G...)"
                    className="w-full rounded-2xl border border-zinc-800 bg-[#070708]/80 px-4 py-4 text-base font-mono text-zinc-100 placeholder:text-zinc-600 focus:border-orange-500/50 focus:outline-none focus:ring-1 focus:ring-orange-500/50 transition-all"
                  />
                </div>
              </div>

              {/* Asset and Amount Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Asset Selector */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Asset
                  </label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsAssetDropdownOpen(!isAssetDropdownOpen)}
                      className="w-full flex items-center justify-between rounded-2xl border border-zinc-800 bg-[#070708]/80 px-4 py-4 text-base font-medium text-zinc-100 focus:border-orange-500/50 focus:outline-none focus:ring-1 focus:ring-orange-500/50 transition-all text-left"
                    >
                      <span className="flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 rounded-full ${selectedAsset === 'USDC' ? 'bg-blue-500' : 'bg-orange-500'}`} />
                        {selectedAsset}
                      </span>
                      <ChevronRight className={`h-4 w-4 text-zinc-400 transition-transform ${isAssetDropdownOpen ? 'rotate-90' : ''}`} />
                    </button>

                    <AnimatePresence>
                      {isAssetDropdownOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 5 }}
                          className="absolute z-50 mt-2 w-full rounded-2xl border border-zinc-800 bg-[#0d0d0e]/95 backdrop-blur-xl p-1.5 shadow-xl"
                        >
                          {Object.keys(ASSETS).map((key) => (
                            <button
                              key={key}
                              type="button"
                              onClick={() => {
                                setSelectedAsset(key)
                                setIsAssetDropdownOpen(false)
                              }}
                              className={`w-full flex items-center justify-between rounded-xl px-3 py-3 text-sm font-medium transition-all ${selectedAsset === key ? 'bg-orange-500/10 text-white border border-orange-500/20' : 'text-zinc-400 hover:bg-zinc-900/50 hover:text-white border border-transparent'
                                }`}
                            >
                              <span className="flex items-center gap-2">
                                <span className={`h-2 w-2 rounded-full ${key === 'USDC' ? 'bg-blue-500' : 'bg-orange-500'}`} />
                                <div>
                                  <div className="text-sm font-bold">{key}</div>
                                  <div className="text-[10px] text-zinc-500 text-left">{key === 'USDC' ? 'USD Coin' : 'Euro Coin'}</div>
                                </div>
                              </span>
                              {selectedAsset === key && (
                                <CheckCircle2 className="h-4 w-4 text-orange-500" />
                              )}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Amount Input */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Amount
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      min="0.01"
                      step="any"
                      className="w-full rounded-2xl border border-zinc-800 bg-[#070708]/80 px-4 py-4 text-base font-medium text-zinc-100 placeholder:text-zinc-600 focus:border-orange-500/50 focus:outline-none focus:ring-1 focus:ring-orange-500/50 transition-all"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-500 uppercase">
                      {assetData.code}
                    </div>
                  </div>
                </div>

              </div>

              {/* Action Buttons Integrated Directly Under Asset/Amount */}
              <div className="pt-2">
                {isChecking ? (
                  <button disabled className="flex w-full items-center justify-center gap-2 rounded-2xl bg-zinc-900 border border-zinc-800/80 px-6 py-4 font-semibold text-zinc-400 cursor-not-allowed">
                    <Loader2 className="h-5 w-5 animate-spin text-orange-500" />
                    Analyzing Routing Path...
                  </button>
                ) : isValidAddress && isGhost !== null ? (
                  isGhost ? (
                    <GenerateLink
                      receiverPublicKey={destinationPublicKey}
                      amount={amount}
                      setAmount={setAmount}
                      selectedAsset={selectedAsset}
                      setSelectedAsset={setSelectedAsset}
                    />
                  ) : (
                    <VeteranSend
                      receiverPublicKey={destinationPublicKey}
                      amount={amount}
                      setAmount={setAmount}
                      selectedAsset={selectedAsset}
                      setSelectedAsset={setSelectedAsset}
                      livePrice={selectedAsset === 'USDC' ? 1.0 : eurcPrice}
                    />
                  )
                ) : (
                  <button disabled className="flex w-full items-center justify-center gap-2 rounded-2xl bg-zinc-900/30 border border-zinc-900/60 px-6 py-4 text-sm font-semibold text-zinc-600 cursor-not-allowed">
                    Enter Destination Key to Continue
                  </button>
                )}
              </div>

            </div>

            {/* Live Route Detection Card & Visual Flow (Positions below primary input/button panel) */}
            <AnimatePresence mode="wait">
              {isValidAddress && !isChecking && isGhost !== null && (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  className="space-y-8"
                >
                  {/* Route Status Card */}
                  {isGhost ? (
                    /* Ghost Wallet: Vault/Escrow route */
                    <div className="rounded-3xl border border-orange-500/10 bg-orange-950/10 p-6 md:p-8 space-y-4 shadow-[0_4px_30px_rgba(249,115,22,0.03)] backdrop-blur-xl animate-pulse-glow">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-2xl bg-orange-500/10 text-orange-500">
                          <AlertCircle className="h-6 w-6" />
                        </div>
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-wider text-orange-500">Route Selection</div>
                          <h3 className="text-lg font-bold text-white">Wallet Not Activated</h3>
                        </div>
                      </div>
                      <p className="text-sm text-zinc-400 leading-relaxed">
                        The recipient does not have an active wallet on the Stellar network.
                        SwiftClaim automatically routes this to the secure <strong className="text-zinc-200">SwiftClaim Vault</strong>.
                        A claimable link will be created for the recipient.
                      </p>
                      <div className="flex items-center gap-2 text-xs font-semibold text-orange-500 bg-orange-500/5 px-3.5 py-2 rounded-xl border border-orange-500/10 w-fit">
                        <span>Recommended Route:</span>
                        <span className="uppercase tracking-wider">SwiftLink Escrow Flow</span>
                      </div>
                    </div>
                  ) : (
                    /* Active Wallet: Direct Send route */
                    <div className="rounded-3xl border border-emerald-500/10 bg-emerald-950/10 p-6 md:p-8 space-y-4 shadow-[0_4px_30px_rgba(16,185,129,0.03)] backdrop-blur-xl">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-500">
                          <CheckCircle2 className="h-6 w-6" />
                        </div>
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Route Selection</div>
                          <h3 className="text-lg font-bold text-white">Active Stellar Wallet</h3>
                        </div>
                      </div>
                      <p className="text-sm text-zinc-400 leading-relaxed">
                        The recipient public key points to an active Stellar account.
                        Funds can be routed directly and instantly.
                      </p>
                      <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 bg-emerald-500/5 px-3.5 py-2 rounded-xl border border-emerald-500/10 w-fit">
                        <span>Recommended Route:</span>
                        <span className="uppercase tracking-wider">Gasless Direct Transfer</span>
                      </div>
                    </div>
                  )}

                  {/* Route Flow Diagram */}
                  <div className="rounded-3xl border border-zinc-900 bg-[#0d0d0e]/60 p-6 md:p-8 backdrop-blur-xl space-y-6">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                      Live Delivery Route Visualization
                    </h4>

                    {isGhost ? (
                      /* Ghost Wallet: Balanced 4-node flow */
                      <div className="relative flex flex-col md:flex-row items-center justify-between gap-6 md:gap-4 py-4 px-2">
                        {/* Node 1: Sender */}
                        <div className="flex flex-col items-center text-center space-y-2 z-10 w-24">
                          <div className="h-14 w-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 shadow-md">
                            <Wallet className="h-6 w-6" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-white">You</div>
                            <div className="text-[10px] font-mono text-zinc-500">Sender</div>
                          </div>
                        </div>

                        {/* Connection 1 */}
                        <div className="flex-1 hidden md:flex items-center h-12 relative">
                          <svg className="w-full h-8 overflow-visible" fill="none" viewBox="0 0 100 32" preserveAspectRatio="none">
                            <path d="M 0 16 L 100 16" stroke="#27272a" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                            <path d="M 0 16 L 100 16" stroke="#f97316" strokeWidth="2" vectorEffect="non-scaling-stroke" className="animate-route-dash-orange" />
                          </svg>
                        </div>

                        {/* Node 2: Vault */}
                        <div className="flex flex-col items-center text-center space-y-2 z-10 w-24">
                          <div className="h-14 w-14 rounded-2xl bg-zinc-900 border border-orange-500/20 text-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/5">
                            <Lock className="h-6 w-6" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-white">Claim Vault</div>
                            <div className="text-[10px] font-mono text-orange-500/80">Funds Locked</div>
                          </div>
                        </div>

                        {/* Connection 2 */}
                        <div className="flex-1 hidden md:flex items-center h-12 relative">
                          <svg className="w-full h-8 overflow-visible" fill="none" viewBox="0 0 100 32" preserveAspectRatio="none">
                            <path d="M 0 16 L 100 16" stroke="#27272a" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                            <path d="M 0 16 L 100 16" stroke="#f97316" strokeWidth="2" vectorEffect="non-scaling-stroke" className="animate-route-dash-orange" />
                          </svg>
                        </div>

                        {/* Node 3: SwiftLink */}
                        <div className="flex flex-col items-center text-center space-y-2 z-10 w-24">
                          <div className="h-14 w-14 rounded-2xl bg-zinc-900 border border-orange-500/20 text-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/5">
                            <LinkIcon className="h-6 w-6" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-white">SwiftLink</div>
                            <div className="text-[10px] font-mono text-orange-500/80">Claim URL</div>
                          </div>
                        </div>

                        {/* Connection 3 */}
                        <div className="flex-1 hidden md:flex items-center h-12 relative">
                          <svg className="w-full h-8 overflow-visible" fill="none" viewBox="0 0 100 32" preserveAspectRatio="none">
                            <path d="M 0 16 L 100 16" stroke="#27272a" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                            <path d="M 0 16 L 100 16" stroke="#f97316" strokeWidth="2" vectorEffect="non-scaling-stroke" className="animate-route-dash-orange" />
                          </svg>
                        </div>

                        {/* Node 4: Recipient */}
                        <div className="flex flex-col items-center text-center space-y-2 z-10 w-24">
                          <div className="h-14 w-14 rounded-2xl bg-zinc-900 border border-orange-500/20 text-orange-400 flex items-center justify-center shadow-md">
                            <CheckCircle2 className="h-6 w-6" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-white">Recipient</div>
                            <div className="text-[10px] font-mono text-zinc-500">Ghost Wallet</div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* Active Wallet: Clean, compact 3-node flow utilizing Gasless Router */
                      <div className="relative flex flex-col md:flex-row items-center justify-center gap-6 md:gap-12 py-4 px-2 max-w-2xl mx-auto">
                        {/* Node 1: Sender */}
                        <div className="flex flex-col items-center text-center space-y-2 z-10 w-24">
                          <div className="h-14 w-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 shadow-md">
                            <Wallet className="h-6 w-6" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-white">You</div>
                            <div className="text-[10px] font-mono text-zinc-500">Sender</div>
                          </div>
                        </div>

                        {/* Connection 1 */}
                        <div className="flex-1 hidden md:flex items-center h-12 relative max-w-[150px]">
                          <svg className="w-full h-8 overflow-visible" fill="none" viewBox="0 0 100 32" preserveAspectRatio="none">
                            <path d="M 0 16 L 100 16" stroke="#27272a" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                            <path d="M 0 16 L 100 16" stroke="#10b981" strokeWidth="2" vectorEffect="non-scaling-stroke" className="animate-route-dash-green" />
                          </svg>
                        </div>

                        {/* Node 2: Gasless Router */}
                        <div className="flex flex-col items-center text-center space-y-2 z-10 w-28">
                          <div className="h-14 w-14 rounded-2xl bg-zinc-900 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/5">
                            <Layers className="h-6 w-6 animate-pulse" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-white">Gasless Router</div>
                            <div className="text-[10px] font-mono text-emerald-500/80">Sponsoring Gas</div>
                          </div>
                        </div>

                        {/* Connection 2 */}
                        <div className="flex-1 hidden md:flex items-center h-12 relative max-w-[150px]">
                          <svg className="w-full h-8 overflow-visible" fill="none" viewBox="0 0 100 32" preserveAspectRatio="none">
                            <path d="M 0 16 L 100 16" stroke="#27272a" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                            <path d="M 0 16 L 100 16" stroke="#10b981" strokeWidth="2" vectorEffect="non-scaling-stroke" className="animate-route-dash-green" />
                          </svg>
                        </div>

                        {/* Node 3: Recipient */}
                        <div className="flex flex-col items-center text-center space-y-2 z-10 w-24">
                          <div className="h-14 w-14 rounded-2xl bg-zinc-900 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shadow-md">
                            <CheckCircle2 className="h-6 w-6" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-white">Recipient</div>
                            <div className="text-[10px] font-mono text-zinc-500">Active Wallet</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {!isValidAddress && !isChecking && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="rounded-3xl border border-zinc-900/50 bg-[#0d0d0e]/30 p-8 text-center text-zinc-500 flex flex-col items-center gap-3 py-16"
                >
                  <Info className="h-8 w-8 text-zinc-600" />
                  <p className="text-sm font-medium">Enter a valid 56-character Stellar public key starting with 'G' above to run live route analysis.</p>
                </motion.div>
              )}
            </AnimatePresence>

          </div>

          {/* RIGHT SIDE: Live Preview Panel (Col 8 to 12) */}
          <div className="lg:col-span-5">
            <div className="rounded-3xl border border-zinc-900 bg-[#0d0d0e]/80 p-6 md:p-8 backdrop-blur-xl space-y-6 sticky top-28 shadow-2xl">

              <div className="flex justify-between items-center pb-4 border-b border-zinc-900/60">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-orange-500" />
                  Live Routing Preview
                </h3>
                <span className="text-[10px] font-mono font-bold text-orange-500 uppercase tracking-widest bg-orange-500/10 px-2.5 py-1 rounded-full flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-orange-500 animate-pulse" />
                  Realtime
                </span>
              </div>

              {/* Primary Cost Box (Hero Display) */}
              <div className="bg-[#09090a] border border-orange-500/20 rounded-2xl p-6 text-center relative overflow-hidden shadow-[0_4px_30px_rgba(250,100,0,0.05)]">
                {/* Accent glow line at top */}
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-orange-500/40 to-transparent" />

                {isGhost ? (
                  <>
                    <span className="text-[10px] font-bold text-orange-500 uppercase tracking-widest block mb-1">You Send</span>
                    <span className="text-3xl font-black text-white font-mono block tracking-tight">
                      {isValidAddress && numAmount > 0 ? (
                        numAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })
                      ) : (
                        numAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })
                      )}
                    </span>
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mt-1">{assetData.code}</span>
                    <div className="text-[10px] text-zinc-400 mt-3 border-t border-zinc-900 pt-3">
                      Secure Vault Escrow • Free for Sender
                    </div>
                  </>
                ) : (
                  <>
                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest block mb-1">You Pay</span>
                    <span className="text-3xl font-black text-white font-mono block tracking-tight">
                      {isValidAddress && numAmount > 0 ? (
                        totalDeductedFromSender.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })
                      ) : (
                        numAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })
                      )}
                    </span>
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mt-1">{assetData.code}</span>
                    <div className="text-[10px] text-zinc-400 mt-3 border-t border-zinc-900 pt-3">
                      Direct Transfer • Sponsored On-Chain
                    </div>
                  </>
                )}
              </div>

              {/* Secondary Delivery Detail Strip */}
              <div className="bg-[#070708]/50 border border-zinc-900 rounded-2xl p-4 flex items-center justify-between text-xs">
                {isGhost ? (
                  <>
                    <span className="font-semibold text-zinc-500 uppercase tracking-wider">Recipient Claimable</span>
                    <span className="font-black font-mono text-orange-400">
                      {isValidAddress && numAmount > 0 ? (
                        `${totalReceivedByRecipient.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })} ${assetData.code}`
                      ) : (
                        `${numAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} ${assetData.code}`
                      )}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="font-semibold text-zinc-500 uppercase tracking-wider">Directly Delivered</span>
                    <span className="font-black font-mono text-emerald-400">
                      {isValidAddress && numAmount > 0 ? (
                        `${numAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} ${assetData.code}`
                      ) : (
                        `${numAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} ${assetData.code}`
                      )}
                    </span>
                  </>
                )}
              </div>

              {/* Route analysis details */}
              <div className="space-y-3 pt-2 text-xs">

                {/* Asset */}
                <div className="flex justify-between items-center py-1">
                  <span className="font-semibold text-zinc-500 uppercase tracking-wider">Asset Selected</span>
                  <span className="font-bold text-white">{assetData.code}</span>
                </div>

                {/* Amount */}
                <div className="flex justify-between items-center py-1">
                  <span className="font-semibold text-zinc-500 uppercase tracking-wider">Transfer Value</span>
                  <span className="font-bold text-white font-mono">{numAmount.toFixed(2)} {assetData.code}</span>
                </div>

                {/* Delivery Path */}
                <div className="flex justify-between items-center py-1">
                  <span className="font-semibold text-zinc-500 uppercase tracking-wider">Delivery Path</span>
                  <span className="font-bold text-right">
                    {isValidAddress ? (
                      isGhost ? (
                        <span className="text-orange-400">SwiftLink Vault Escrow</span>
                      ) : (
                        <span className="text-emerald-400">Instant Direct Deposit</span>
                      )
                    ) : (
                      <span className="text-zinc-600">—</span>
                    )}
                  </span>
                </div>

                {/* Gas Surcharge */}
                <div className="flex justify-between items-center py-1">
                  <span className="font-semibold text-zinc-500 uppercase tracking-wider">Gas Surcharge</span>
                  <span className="font-bold text-emerald-400">Sponsored (No XLM Needed)</span>
                </div>

                {/* Conversion Rate (Only if EURC is selected) */}
                {selectedAsset === 'EURC' && (
                  <div className="flex justify-between items-center border-t border-zinc-900/60 pt-3">
                    <span className="font-semibold text-zinc-500 uppercase tracking-wider">EURC/USDC Rate</span>
                    <span className="font-bold text-white font-mono">
                      {eurcPrice !== null ? `1 EURC ≈ $${eurcPrice.toFixed(4)} USDC` : 'Loading...'}
                    </span>
                  </div>
                )}

                {/* Routing Fee breakdown */}
                <div className="border-t border-zinc-900/60 pt-3 space-y-2">
                  <div className="flex justify-between">
                    <span className="font-semibold text-zinc-500 uppercase tracking-wider">Routing Fee (Paid by You)</span>
                    <span className="font-bold text-white font-mono">
                      {isValidAddress && numAmount > 0 ? (
                        senderFeeInToken > 0 ? (
                          `${senderFeeInToken.toFixed(6)} ${assetData.code}`
                        ) : (
                          '0.00 (Free)'
                        )
                      ) : (
                        '—'
                      )}
                    </span>
                  </div>

                  {isGhost ? (
                    <div className="flex justify-between">
                      <span className="font-semibold text-zinc-500 uppercase tracking-wider">Claiming Fee (Paid by Recipient)</span>
                      <span className="font-bold text-orange-400 font-mono">
                        {isValidAddress && numAmount > 0 ? (
                          recipientFeeInToken > 0 ? (
                            `${recipientFeeInToken.toFixed(6)} ${assetData.code}`
                          ) : (
                            '0.00'
                          )
                        ) : (
                          '—'
                        )}
                      </span>
                    </div>
                  ) : (
                    <div className="flex justify-between">
                      <span className="font-semibold text-zinc-500 uppercase tracking-wider">Recipient Claiming Fee</span>
                      <span className="font-bold text-zinc-500 font-mono">
                        Not Applicable
                      </span>
                    </div>
                  )}
                </div>

              </div>

              {/* Dynamic summary banner */}
              {isValidAddress && numAmount > 0 && (
                <div className="pt-2">
                  {isGhost ? (
                    <div className="rounded-2xl border border-orange-500/10 bg-orange-500/5 p-4 text-xs text-orange-400 flex items-start gap-2.5 leading-relaxed">
                      <Info className="h-4 w-4 shrink-0 mt-0.5" />
                      <span>
                        <strong>SwiftClaim Vault Route</strong>: Locked securely for free. A <strong>1% claiming fee</strong> (Min $0.50, Max $3.00 USD value) is deducted from the link's balance when claimed.
                      </span>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-emerald-500/10 bg-emerald-500/5 p-4 text-xs text-emerald-400 flex items-start gap-2.5 leading-relaxed">
                      <Info className="h-4 w-4 shrink-0 mt-0.5" />
                      <span>
                        <strong>Gasless Direct Transfer Route</strong>: Shipped instantly. Senders pay a flat <strong>0.001 USDC</strong> equivalent network routing fee. Sponsored on-chain by SwiftClaim.
                      </span>
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full py-8 border-t border-zinc-900/60 bg-[#050505] mt-12 relative z-10">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-zinc-500">
          <div>© {new Date().getFullYear()} SwiftClaim Protocol. All rights reserved.</div>
          <div className="flex gap-6">
            <a href="/#privacy" className="hover:text-zinc-400 transition-colors">Privacy Policy</a>
            <a href="/#terms" className="hover:text-zinc-400 transition-colors">Terms of Service</a>
          </div>
        </div>
      </footer>

    </motion.div>
  )
}
