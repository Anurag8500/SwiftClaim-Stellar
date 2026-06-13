'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { useWallet } from '@/contexts/WalletContext'
import {
  Zap,
  Lock,
  ShieldCheck,
  TrendingUp,
  ArrowRight,
  Clock,
  UserCheck,
  Cpu,
  Check,
  AlertTriangle
} from 'lucide-react'

export default function LandingPage() {
  const { isConnected, publicKey, connectWallet, disconnectWallet } = useWallet()
  const [activeSection, setActiveSection] = useState('hero')
  const [routingState, setRoutingState] = useState<'analyzing' | 'direct' | 'vault'>('analyzing')
  const [activationStep, setActivationStep] = useState<'inactive' | 'activating' | 'active'>('inactive')
  const [frictionStep, setFrictionStep] = useState<'tradin' | 'swiftin'>('tradin')
  const [gasFeeStep, setGasFeeStep] = useState<'charge' | 'sponsored'>('charge')

  useEffect(() => {
    const timer = setInterval(() => {
      setRoutingState((prev) => {
        if (prev === 'analyzing') return 'direct'
        if (prev === 'direct') return 'vault'
        return 'analyzing'
      })
    }, 3000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const timer = setInterval(() => {
      setActivationStep((prev) => {
        if (prev === 'inactive') return 'activating'
        if (prev === 'activating') return 'active'
        return 'inactive'
      })
    }, 2000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const timer = setInterval(() => {
      setFrictionStep((prev) => (prev === 'tradin' ? 'swiftin' : 'tradin'))
    }, 3000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const timer = setInterval(() => {
      setGasFeeStep((prev) => (prev === 'charge' ? 'sponsored' : 'charge'))
    }, 2500)
    return () => clearInterval(timer)
  }, [])

  const truncateAddress = (addr: string) => {
    return `${addr.slice(0, 4)}...${addr.slice(-4)}`
  }

  const handleScrollTo = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault()
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  // Scroll spy to cross-fade background images smoothly
  useEffect(() => {
    const handleScroll = () => {
      const sections = ['hero', 'why', 'how', 'pricing']
      let current = 'hero'
      for (const id of sections) {
        const el = document.getElementById(id)
        if (el) {
          const rect = el.getBoundingClientRect()
          // If the section top is above 45% of the viewport height, activate it
          if (rect.top <= window.innerHeight * 0.45) {
            current = id
          }
        }
      }
      setActiveSection(current)
    }

    // Call once on mount to establish initial state correctly
    handleScroll()

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8, ease: 'easeOut' }}
      className="relative min-h-screen w-full bg-[#050505] text-white flex flex-col justify-between overflow-x-hidden font-sans select-none scroll-smooth"
    >

      {/* Global Background Cross-fade Layer (Transitions as user scrolls past hero) */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden bg-[#050505]">
        {/* Background 1 (Why SwiftClaim) */}
        <motion.div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "linear-gradient(to bottom, #050505 0%, rgba(5, 5, 5, 0) 18%), url('/landing-bg-1.jpg')" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: activeSection === 'why' ? 0.35 : 0 }}
          transition={{ duration: 1.0, ease: 'easeInOut' }}
        />
        {/* Background 2 (How It Works) */}
        <motion.div
          className="absolute inset-0 bg-[url('/landing-bg-2.jpg')] bg-cover bg-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: activeSection === 'how' ? 0.35 : 0 }}
          transition={{ duration: 1.0, ease: 'easeInOut' }}
        />
        {/* Background 3 (Pricing) */}
        <motion.div
          className="absolute inset-0 bg-[url('/landing-bg-3.jpg')] bg-cover bg-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: activeSection === 'pricing' ? 0.35 : 0 }}
          transition={{ duration: 1.0, ease: 'easeInOut' }}
        />

        {/* Dimming overlay to make text pop while keeping background details visible */}
        <div className="absolute inset-0 bg-black/55 pointer-events-none" />

        {/* Shared Soft Glowing Ambient Gradients */}
        <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full bg-orange-600/10 blur-[150px] pointer-events-none" />
        <div className="absolute bottom-[20%] right-[-10%] w-[700px] h-[700px] rounded-full bg-blue-600/5 blur-[180px] pointer-events-none" />
      </div>

      {/* 100vh Full Viewport Hero Section (Preserved styling exactly as current) */}
      <header id="hero" className="relative w-full h-screen flex flex-col justify-between overflow-hidden">

        {/* Background Image Layer: Anchored to display card visual on the right */}
        <div
          className="absolute inset-0 bg-[url('/hero-bg.png')] bg-cover bg-no-repeat bg-[position:72%_center] md:bg-right-center w-full h-full z-0 opacity-90"
        />

        {/* Smooth Gradient Overlay to transition into dark base color at the bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-[#050505] to-transparent pointer-events-none z-10" />

        <nav className="relative w-full z-50 pt-4 pb-2 px-6 md:px-12 bg-transparent opacity-[0.98] hover:opacity-100 transition-opacity duration-300">
          <div className="max-w-[1400px] mx-auto flex items-center justify-between">

            {/* Logo: Clickable brand logo image and text */}
            <Link href="/" className="flex items-center gap-3 group">
              <img src="/logo.png" alt="SwiftClaim Logo" className="h-16 w-16 object-contain" />
              <span className="text-xl font-bold tracking-tight text-white group-hover:text-white/80 transition-colors">
                SwiftClaim
              </span>
            </Link>

            {/* Navigation Links (Extended targeting Why, How, Pricing) */}
            <div className="hidden md:flex items-center gap-8 text-sm font-medium">
              <a
                href="#why"
                onClick={(e) => handleScrollTo(e, 'why')}
                className={`transition-colors cursor-pointer ${
                  activeSection === 'why' ? 'text-[#fa6400]' : 'text-white/95 hover:text-[#fa6400]'
                }`}
              >
                Why SwiftClaim
              </a>
              <a
                href="#how"
                onClick={(e) => handleScrollTo(e, 'how')}
                className={`transition-colors cursor-pointer ${
                  activeSection === 'how' ? 'text-[#fa6400]' : 'text-white/95 hover:text-[#fa6400]'
                }`}
              >
                How It Works
              </a>
              <a
                href="#pricing"
                onClick={(e) => handleScrollTo(e, 'pricing')}
                className={`transition-colors cursor-pointer ${
                  activeSection === 'pricing' ? 'text-[#fa6400]' : 'text-white/95 hover:text-[#fa6400]'
                }`}
              >
                Pricing
              </a>
            </div>

            {/* Top Right Action Buttons */}
            <div className="flex items-center gap-3">
              {isConnected && publicKey ? (
                <button
                  onClick={disconnectWallet}
                  className="px-5 py-2 text-xs md:text-sm font-bold tracking-tight text-[#fa6400] bg-white rounded-full hover:bg-white/90 shadow-md hover:shadow-lg transition-all"
                >
                  {truncateAddress(publicKey)}
                </button>
              ) : (
                <button
                  onClick={connectWallet}
                  className="px-5 py-2 text-xs md:text-sm font-bold tracking-tight text-[#fa6400] bg-white rounded-full hover:bg-white/90 shadow-md hover:shadow-lg transition-all"
                >
                  Connect Wallet
                </button>
              )}
            </div>

          </div>
        </nav>

        {/* Hero Content Layer */}
        <div className="flex-1 flex items-center relative z-10">
          <div className="max-w-7xl mx-auto px-6 md:px-12 w-full grid grid-cols-1 md:grid-cols-12 gap-8 items-center">

            {/* Left Content Column: Maximum width structured at 540px */}
            <div className="md:col-span-6 lg:col-span-5 flex flex-col items-start text-left space-y-6 md:space-y-8 z-10 max-w-[540px] opacity-[0.98] hover:opacity-100 transition-opacity duration-300">

              {/* Bold White Display Title */}
              <h1 className="text-4xl sm:text-5xl lg:text-[60px] font-black text-white leading-[1.08] tracking-tight">
                Kill The Wallet Setup.<br />
                Keep The Payment.
              </h1>

              {/* Soft White Copywriting */}
              <p className="text-lg text-white/90 leading-relaxed font-normal max-w-[500px]">
                Send USDC or EURC to anyone through secure claim links.<br />
                No wallet funding. No XLM required.<br />
                Funds stay protected until they're claimed.
              </p>

              {/* Double CTA Buttons */}
              <div className="flex items-center gap-4 w-full sm:w-auto pt-2">
                <Link href="/dashboard" className="flex-1 sm:flex-initial">
                  <button className="group w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-[#ff5500] to-[#ff7700] hover:from-[#e04b00] hover:to-[#ff5500] text-white font-bold rounded-full border border-orange-400/30 shadow-[0_8px_30px_rgba(255,85,0,0.35)] hover:shadow-[0_8px_40px_rgba(255,85,0,0.5)] transition-all duration-300 flex items-center justify-center gap-2">
                    <span>Create SwiftLink</span>
                    <svg
                      className="w-5 h-5 transform group-hover:translate-x-1 transition-transform duration-200"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </button>
                </Link>
                <Link href="/dashboard" className="flex-1 sm:flex-initial">
                  <button className="w-full sm:w-auto px-8 py-4 bg-white/10 hover:bg-white/20 text-white font-bold rounded-full border border-white/30 hover:border-white/50 shadow-lg backdrop-blur-sm transition-all duration-300">
                    Launch App
                  </button>
                </Link>
              </div>

            </div>

            {/* Right Side Spacer for Desktop */}
            <div className="hidden md:block md:col-span-6 lg:col-span-7 h-full" />

            {/* Inline Image Container for Mobile Viewports (Below content) */}
            <div className="md:hidden col-span-1 w-full h-[260px] rounded-xl border border-white/10 shadow-xl overflow-hidden bg-[url('/hero-bg.png')] bg-cover bg-[position:center_right] bg-no-repeat mt-4 opacity-90" />

          </div>
        </div>

        {/* Empty layout height block at the bottom of hero */}
        <div className="h-10 w-full" />

      </header>

      {/* EXTENDED CONTENT SECTIONS - Fully Transparent to reveal global background merges */}

      {/* Section 1: Why SwiftClaim - Resolving Stellar Friction */}
      <section
        id="why"
        className="relative z-10 py-32 px-6 md:px-12 w-full bg-transparent"
      >
        <div className="max-w-7xl mx-auto w-full">
          {/* Section Header */}
          <div className="max-w-3xl space-y-4 mb-20">
            <span className="text-xs font-bold uppercase tracking-widest text-[#fa6400]">
              01. Why SwiftClaim
            </span>
            <h2 className="text-4xl md:text-5xl font-black text-white tracking-tight leading-tight">
              Why SwiftClaim Exists
            </h2>
            <p className="text-lg text-zinc-300 leading-relaxed max-w-2xl">
              A wallet can exist, but receiving still may not be ready. SwiftClaim removes the setup gap.
            </p>
          </div>

          {/* Bento Grid layout */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Card 1: Account Not Activated (Span 1) */}
            <motion.div
              whileHover={{ y: -6 }}
              transition={{ duration: 0.2 }}
              className="p-8 rounded-3xl bg-white/[0.01] border border-white/5 hover:border-[#fa6400]/30 hover:bg-white/[0.03] transition-all duration-300 flex flex-col justify-between space-y-6 shadow-xl shadow-black/20"
            >
              <div className="space-y-4">
                <div className="p-3.5 rounded-2xl bg-orange-500/10 text-orange-500 border border-orange-500/20 w-fit shrink-0">
                  <AlertTriangle className="h-6 w-6" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-white tracking-tight">Account Not Activated</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    A Stellar wallet may exist, but it still needs to be active before it can receive assets. SwiftClaim checks the status and routes automatically.
                  </p>
                </div>
              </div>
              
              {/* Card 1 Visual: Dynamic activation states */}
              <div className="p-4 rounded-2xl bg-black/40 border border-white/5 flex items-center justify-between transition-colors duration-500 min-h-[64px]">
                <div className="flex items-center gap-3">
                  <motion.div 
                    animate={{
                      scale: activationStep === 'active' ? [1, 1.15, 1] : 1,
                      rotate: activationStep === 'active' ? [0, 360, 360] : 0,
                    }}
                    transition={{ duration: 0.5 }}
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-mono font-bold transition-colors duration-500 ${
                      activationStep === 'active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-zinc-800 text-zinc-500'
                    }`}
                  >
                    W
                  </motion.div>
                  <div className="space-y-0.5">
                    <div className="text-[10px] font-mono text-zinc-500">GD3F...9X2A</div>
                    <div className="text-[10px] font-bold flex items-center gap-1.5 transition-colors duration-500">
                      <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${
                        activationStep === 'inactive' ? 'bg-amber-500' :
                        activationStep === 'activating' ? 'bg-orange-500' :
                        'bg-emerald-400'
                      }`} />
                      <span className={
                        activationStep === 'inactive' ? 'text-amber-500' :
                        activationStep === 'activating' ? 'text-orange-500' :
                        'text-emerald-400'
                      }>
                        {activationStep === 'inactive' ? 'Unactivated' :
                         activationStep === 'activating' ? 'Activating...' :
                         'Active & Funded'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border transition-all duration-500 ${
                  activationStep === 'active' 
                    ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20 opacity-100 scale-100' 
                    : 'text-zinc-500 bg-zinc-900 border-zinc-800 opacity-50 scale-95'
                }`}>
                  {activationStep === 'active' ? 'Delivered' : 'Routing'}
                </div>
              </div>
            </motion.div>

            {/* Card 2: Setup & Funding Friction (Span 2) */}
            <motion.div
              whileHover={{ y: -6 }}
              transition={{ duration: 0.2 }}
              className="md:col-span-2 p-8 rounded-3xl bg-white/[0.01] border border-white/5 hover:border-[#fa6400]/30 hover:bg-white/[0.03] transition-all duration-300 flex flex-col md:flex-row justify-between items-stretch gap-8 shadow-xl shadow-black/20"
            >
              <div className="flex flex-col justify-between flex-1 space-y-6">
                <div className="space-y-4">
                  <div className="p-3.5 rounded-2xl bg-orange-500/10 text-orange-500 border border-orange-500/20 w-fit shrink-0">
                    <Zap className="h-6 w-6" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-bold text-white tracking-tight">Setup & Funding Friction</h3>
                    <p className="text-sm text-zinc-400 leading-relaxed">
                      Receiving a payment shouldn't require creating exchange accounts, passing KYC checks, and purchasing XLM beforehand. SwiftClaim removes that activation barrier.
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Card 2 Visual: Timed comparisons */}
              <div className="w-full md:w-[280px] flex flex-col justify-center gap-3">
                {/* Traditional flow */}
                <div className={`p-4 rounded-2xl border transition-all duration-500 flex flex-col gap-1.5 relative overflow-hidden ${
                  frictionStep === 'tradin' 
                    ? 'bg-red-500/5 border-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.05)]' 
                    : 'bg-zinc-900/30 border-white/5 opacity-30'
                }`}>
                  {frictionStep === 'tradin' && (
                    <div className="absolute top-0 right-0 w-full h-full flex items-center justify-center font-black text-red-500/10 text-6xl pointer-events-none select-none">
                      ✕
                    </div>
                  )}
                  <span className="text-[9px] font-bold font-mono text-red-400 uppercase tracking-widest block">Traditional Route</span>
                  <span className="text-xs text-zinc-400 font-medium leading-normal block">KYC Check ➔ Fund Wallet ➔ Purchase XLM</span>
                </div>
                
                {/* SwiftClaim flow */}
                <div className={`p-4 rounded-2xl border transition-all duration-500 flex flex-col gap-1.5 relative overflow-hidden ${
                  frictionStep === 'swiftin' 
                    ? 'bg-[#fa6400]/5 border-[#fa6400]/40 shadow-[0_0_20px_rgba(250,100,0,0.1)]' 
                    : 'bg-zinc-900/30 border-white/5 opacity-30'
                }`}>
                  {frictionStep === 'swiftin' && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="absolute top-0 right-0 w-full h-full flex items-center justify-center font-black text-orange-500/5 text-5xl pointer-events-none select-none"
                    >
                      ✓
                    </motion.div>
                  )}
                  <span className="text-[9px] font-bold font-mono text-[#fa6400] uppercase tracking-widest block">SwiftClaim Engine</span>
                  <span className="text-xs text-white font-bold leading-normal block flex items-center gap-1">
                    Create Link ➔ Settle Payment Instantly
                  </span>
                  {frictionStep === 'swiftin' && (
                    <motion.div 
                      initial={{ left: '0%' }}
                      animate={{ left: '100%' }}
                      transition={{ duration: 1.5, ease: 'easeInOut' }}
                      className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#fa6400] to-transparent"
                    />
                  )}
                </div>
              </div>
            </motion.div>

            {/* Card 3: Missing Trustlines (Span 2) */}
            <motion.div
              whileHover={{ y: -6 }}
              transition={{ duration: 0.2 }}
              className="md:col-span-2 p-8 rounded-3xl bg-white/[0.01] border border-white/5 hover:border-[#fa6400]/30 hover:bg-white/[0.03] transition-all duration-300 flex flex-col md:flex-row justify-between items-stretch gap-8 shadow-xl shadow-black/20"
            >
              <div className="flex flex-col justify-between flex-1 space-y-6">
                <div className="space-y-4">
                  <div className="p-3.5 rounded-2xl bg-orange-500/10 text-orange-500 border border-orange-500/20 w-fit shrink-0">
                    <Cpu className="h-6 w-6" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-bold text-white tracking-tight">Missing Trustlines</h3>
                    <p className="text-sm text-zinc-400 leading-relaxed">
                      Receiving USDC or EURC may require trustlines before funds can be used. SwiftClaim can set up the needed trustlines during the claim flow.
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Card 3 Visual: Synchronized Lock/USDC Coin Animation */}
              <div className="w-full md:w-[280px] flex flex-col justify-center">
                <div className="p-4 rounded-2xl bg-black/40 border border-white/5 flex flex-col gap-3">
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span className="text-zinc-500">Token Escrow Stream</span>
                    <span className="text-emerald-400 font-bold">Automatic Opt-In</span>
                  </div>
                  
                  <div className="h-16 bg-zinc-950/80 border border-white/5 rounded-2xl flex items-center justify-between px-6 relative overflow-hidden">
                    {/* Background Track Line */}
                    <div className="absolute left-10 right-10 h-0.5 bg-zinc-800" />
                    
                    {/* Left wallet endpoint */}
                    <div className="w-8 h-8 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center z-10">
                      <span className="text-[10px] font-mono text-zinc-500 font-bold">Src</span>
                    </div>

                    {/* Middle Trustline Lock status */}
                    <motion.div
                      animate={{
                        borderColor: ["rgba(239, 68, 68, 0.2)", "rgba(239, 68, 68, 0.2)", "rgba(16, 185, 129, 0.5)", "rgba(16, 185, 129, 0.5)", "rgba(239, 68, 68, 0.2)"],
                        color: ["#ef4444", "#ef4444", "#10b981", "#10b981", "#ef4444"],
                        scale: [1, 1, 1.15, 1, 1],
                      }}
                      transition={{
                        duration: 4,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                      className="w-8 h-8 rounded-full border bg-zinc-900 flex items-center justify-center z-20"
                    >
                      <Lock className="w-3.5 h-3.5" />
                    </motion.div>

                    {/* Right wallet endpoint */}
                    <div className="w-8 h-8 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center z-10">
                      <span className="text-[10px] font-mono text-zinc-500 font-bold">Dest</span>
                    </div>

                    {/* Traveling USDC Coin */}
                    <motion.div
                      animate={{
                        left: ["2.5rem", "6.25rem", "6.25rem", "10.25rem", "10.25rem", "2.5rem"],
                        opacity: [1, 1, 0.8, 1, 0, 0],
                        scale: [1, 1.1, 1.1, 1, 0.8, 1],
                      }}
                      transition={{
                        duration: 4,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                      className="absolute w-7 h-7 rounded-full bg-blue-600 border border-blue-400 flex items-center justify-center z-30 shadow-lg shadow-blue-500/20"
                    >
                      <span className="text-[8px] font-black text-white">USDC</span>
                    </motion.div>
                  </div>
                  
                  <div className="text-[10px] text-zinc-505 leading-tight">
                    Audits registry and mounts target trustline on claim.
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Card 4: No XLM For Fees (Span 1) */}
            <motion.div
              whileHover={{ y: -6 }}
              transition={{ duration: 0.2 }}
              className="p-8 rounded-3xl bg-white/[0.01] border border-white/5 hover:border-[#fa6400]/30 hover:bg-white/[0.03] transition-all duration-300 flex flex-col justify-between space-y-6 shadow-xl shadow-black/20"
            >
              <div className="space-y-4">
                <div className="p-3.5 rounded-2xl bg-orange-500/10 text-orange-500 border border-orange-500/20 w-fit shrink-0">
                  <Clock className="h-6 w-6" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-white tracking-tight">No XLM For Fees</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    Users can get blocked even with a wallet if they do not have XLM for network operations. SwiftClaim lets the sender pay in the asset being sent, not XLM.
                  </p>
                </div>
              </div>
              
              {/* Card 4 Visual: Gas surcharge indicator */}
              <div className="flex flex-col gap-2.5">
                <div className="flex justify-between items-center text-[10px] font-mono">
                  <span className="text-zinc-500 font-semibold">Stellar Gas Surcharge</span>
                  <motion.span 
                    animate={{
                      color: gasFeeStep === 'charge' ? '#f59e0b' : '#10b981'
                    }}
                    className="font-bold transition-colors duration-500"
                  >
                    {gasFeeStep === 'charge' ? '1.50 XLM' : '0.00 XLM'}
                  </motion.span>
                </div>
                
                <div className={`p-3.5 rounded-xl border transition-all duration-500 flex items-center justify-between ${
                  gasFeeStep === 'sponsored' 
                    ? 'bg-emerald-950/10 border-emerald-500/30' 
                    : 'bg-zinc-950/80 border-white/5'
                }`}>
                  <div className="flex items-center gap-2">
                    <motion.div
                      animate={{
                        scale: gasFeeStep === 'sponsored' ? [1, 1.25, 1] : 1
                      }}
                      transition={{ duration: 0.3 }}
                    >
                      <Zap className={`w-4 h-4 transition-colors duration-500 ${
                        gasFeeStep === 'sponsored' ? 'text-emerald-400' : 'text-zinc-500'
                      }`} />
                    </motion.div>
                    <span className={`text-xs transition-colors duration-500 ${
                      gasFeeStep === 'sponsored' ? 'text-emerald-400 font-bold' : 'text-zinc-400'
                    }`}>
                      {gasFeeStep === 'sponsored' ? 'Gas Fully Sponsored' : 'Standard Gas Required'}
                    </span>
                  </div>
                  <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded transition-colors duration-500 ${
                    gasFeeStep === 'sponsored' 
                      ? 'text-emerald-400 bg-emerald-500/10' 
                      : 'text-zinc-600 bg-zinc-900'
                  }`}>
                    {gasFeeStep === 'sponsored' ? 'Active' : 'Unpaid'}
                  </span>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Bottom Statement Panel */}
          <div className="mt-24 border-t border-zinc-800/80 pt-12 text-center max-w-3xl mx-auto space-y-6">
            <p className="text-lg text-zinc-305 font-medium leading-relaxed italic">
              "The Fastest Path To Getting Paid."
            </p>
            <div className="flex justify-center">
              <Link href="/dashboard">
                <button className="px-6 py-3.5 bg-[#fa6400] hover:bg-orange-500 text-white font-bold text-sm rounded-full flex items-center gap-2 cursor-pointer transition-all shadow-lg shadow-orange-500/20 hover:shadow-orange-500/30">
                  Open Dashboard
                  <ArrowRight className="h-4 w-4" />
                </button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Section 2: How It Works - One Address. Two Delivery Paths. */}
      <section
        id="how"
        className="relative z-10 py-32 px-6 md:px-12 w-full bg-transparent"
      >
        <div className="max-w-7xl mx-auto w-full">
          {/* Section Header */}
          <div className="max-w-3xl space-y-4 mb-20">
            <span className="text-xs font-bold uppercase tracking-widest text-[#fa6400]">
              02. How It Works
            </span>
            <h2 className="text-4xl md:text-5xl font-black text-white tracking-tight leading-tight">
              One Address. Two Delivery Paths.
            </h2>
            <p className="text-lg text-zinc-300 leading-relaxed max-w-2xl">
              Enter a destination address. SwiftClaim checks the route and sends it the right way.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
            {/* Left side: Premium Animated Routing Control Board */}
            <div className="lg:col-span-6 flex justify-center w-full">
              <div className="relative w-full max-w-[480px] bg-black/40 rounded-3xl border border-white/5 p-8 overflow-hidden h-[440px] flex flex-col items-center justify-between shadow-2xl">
                {/* SVG Connections Overlay */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" viewBox="0 0 400 440" fill="none">
                  {/* Background static lines */}
                  <path d="M 200 48 L 200 180" stroke="rgba(255,255,255,0.06)" strokeWidth="2" />
                  <path d="M 200 180 L 95 340" stroke="rgba(255,255,255,0.06)" strokeWidth="2" />
                  <path d="M 200 180 L 305 340" stroke="rgba(255,255,255,0.06)" strokeWidth="2" />

                  {/* Animated path flows based on state */}
                  {routingState === 'analyzing' && (
                    <motion.path
                      d="M 200 48 L 200 180"
                      stroke="url(#orange-gradient)"
                      strokeWidth="3"
                      strokeDasharray="8 4"
                      animate={{ strokeDashoffset: [0, -24] }}
                      transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }}
                    />
                  )}
                  {routingState === 'direct' && (
                    <motion.path
                      d="M 200 180 L 95 340"
                      stroke="url(#green-gradient)"
                      strokeWidth="3"
                      strokeDasharray="8 4"
                      animate={{ strokeDashoffset: [0, -24] }}
                      transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }}
                    />
                  )}
                  {routingState === 'vault' && (
                    <motion.path
                      d="M 200 180 L 305 340"
                      stroke="url(#orange-gradient)"
                      strokeWidth="3"
                      strokeDasharray="8 4"
                      animate={{ strokeDashoffset: [0, -24] }}
                      transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }}
                    />
                  )}

                  {/* Gradients definitions */}
                  <defs>
                    <linearGradient id="orange-gradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#fa6400" stopOpacity="0.2" />
                      <stop offset="50%" stopColor="#fa6400" stopOpacity="1" />
                      <stop offset="100%" stopColor="#fa6400" stopOpacity="0.2" />
                    </linearGradient>
                    <linearGradient id="green-gradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity="0.2" />
                      <stop offset="50%" stopColor="#10b981" stopOpacity="1" />
                      <stop offset="100%" stopColor="#10b981" stopOpacity="0.2" />
                    </linearGradient>
                  </defs>
                </svg>

                {/* Node 1: Top Center */}
                <div className="z-10 bg-zinc-900/90 border border-white/10 rounded-full px-5 py-2.5 flex items-center gap-2.5 shadow-lg shadow-black/40">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#fa6400] animate-pulse" />
                  <span className="text-xs font-mono text-zinc-300">Destination Address</span>
                </div>

                {/* Node 2: Middle Center */}
                <div className={`z-10 border rounded-2xl px-6 py-4 flex flex-col items-center gap-1 shadow-xl transition-all duration-500 bg-zinc-900/95 ${
                  routingState === 'analyzing' ? 'border-[#fa6400] shadow-[#fa6400]/10' : 'border-white/10'
                }`}>
                  <span className="text-[9px] font-bold uppercase tracking-widest text-[#fa6400]">Route Auditor</span>
                  <span className="text-sm font-black text-white">SwiftClaim Analysis</span>
                  {routingState === 'analyzing' && (
                    <span className="text-[10px] text-zinc-400 animate-pulse">Checking status...</span>
                  )}
                </div>

                {/* Node 3: Bottom Left & Right Row */}
                <div className="w-full flex justify-between gap-4 z-10">
                  {/* Left Node */}
                  <div className={`border rounded-2xl p-4 flex flex-col items-center text-center flex-1 bg-zinc-900/95 transition-all duration-500 ${
                    routingState === 'direct' ? 'border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.15)] bg-emerald-950/5' : 'border-white/5 opacity-40'
                  }`}>
                    <span className="text-[11px] font-bold text-zinc-400">Active Wallet</span>
                    <div className="h-px w-8 bg-zinc-800 my-2" />
                    <span className="text-[11px] font-mono text-emerald-400 font-bold flex items-center gap-1">
                      Direct Transfer
                    </span>
                  </div>

                  {/* Right Node */}
                  <div className={`border rounded-2xl p-4 flex flex-col items-center text-center flex-1 bg-zinc-900/95 transition-all duration-500 ${
                    routingState === 'vault' ? 'border-[#fa6400]/50 shadow-[0_0_20px_rgba(250,100,0,0.15)] bg-orange-950/5' : 'border-white/5 opacity-40'
                  }`}>
                    <span className="text-[11px] font-bold text-zinc-400">Needs Setup</span>
                    <div className="h-px w-8 bg-zinc-800 my-2" />
                    <span className="text-[11px] font-mono text-[#fa6400] font-bold flex items-center gap-1">
                      SwiftLink Vault
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right side: Detailed Path A & Path B */}
            <div className="lg:col-span-6 space-y-8 w-full">
              {/* Path A Column */}
              <div className={`p-8 rounded-3xl border transition-all duration-500 bg-white/[0.01] ${
                routingState === 'direct' ? 'border-emerald-500/30 shadow-[0_4px_30px_rgba(16,185,129,0.05)] bg-white/[0.02]' : 'border-white/5'
              }`}>
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-xs font-bold font-mono text-emerald-400 uppercase tracking-widest bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/10">PATH A</span>
                  <h3 className="text-xl font-bold text-white">Direct Transfer</h3>
                </div>
                <p className="text-sm text-zinc-405 mb-6 leading-relaxed">
                  For active Stellar accounts that are already ready to receive.
                </p>
                <ul className="space-y-3">
                  <li className="flex items-start gap-2.5 text-sm text-zinc-300">
                    <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>Instant settlement</span>
                  </li>
                  <li className="flex items-start gap-2.5 text-sm text-zinc-300">
                    <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>No XLM required from sender</span>
                  </li>
                  <li className="flex items-start gap-2.5 text-sm text-zinc-300">
                    <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>Network fees paid behind the scenes and charged in the asset being sent</span>
                  </li>
                  <li className="flex items-start gap-2.5 text-sm text-zinc-300">
                    <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>No additional setup required</span>
                  </li>
                </ul>
              </div>

              {/* Path B Column */}
              <div className={`p-8 rounded-3xl border transition-all duration-500 bg-white/[0.01] ${
                routingState === 'vault' ? 'border-[#fa6400]/30 shadow-[0_4px_30px_rgba(250,100,0,0.05)] bg-white/[0.02]' : 'border-white/5'
              }`}>
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-xs font-bold font-mono text-[#fa6400] uppercase tracking-widest bg-orange-500/10 px-2.5 py-1 rounded-full border border-orange-500/10">PATH B</span>
                  <h3 className="text-xl font-bold text-white">SwiftLink Vault</h3>
                </div>
                <p className="text-sm text-zinc-405 mb-6 leading-relaxed">
                  For accounts that require activation, trustlines, or additional setup.
                </p>
                <ul className="space-y-3">
                  <li className="flex items-start gap-2.5 text-sm text-zinc-300">
                    <Check className="h-4 w-4 text-[#fa6400] shrink-0 mt-0.5" />
                    <span>Funds locked securely</span>
                  </li>
                  <li className="flex items-start gap-2.5 text-sm text-zinc-300">
                    <Check className="h-4 w-4 text-[#fa6400] shrink-0 mt-0.5" />
                    <span>Shareable claim link</span>
                  </li>
                  <li className="flex items-start gap-2.5 text-sm text-zinc-300">
                    <Check className="h-4 w-4 text-[#fa6400] shrink-0 mt-0.5" />
                    <span>Account activation handled</span>
                  </li>
                  <li className="flex items-start gap-2.5 text-sm text-zinc-300">
                    <Check className="h-4 w-4 text-[#fa6400] shrink-0 mt-0.5" />
                    <span>Trustline setup supported</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Bottom Statement */}
          <div className="mt-24 border-t border-zinc-800/80 pt-12 text-center max-w-3xl mx-auto space-y-6">
            <p className="text-lg text-zinc-305 font-medium leading-relaxed italic">
              "You choose the destination. SwiftClaim chooses the route."
            </p>
          </div>
        </div>
      </section>

      {/* Section 3: Pricing */}
      <section
        id="pricing"
        className="relative z-10 py-32 px-6 md:px-12 w-full bg-transparent"
      >
        <div className="max-w-7xl mx-auto w-full">
          {/* Section Header */}
          <div className="max-w-3xl space-y-4 mb-20">
            <span className="text-xs font-bold uppercase tracking-widest text-[#fa6400]">
              03. Pricing
            </span>
            <h2 className="text-4xl md:text-5xl font-black text-white tracking-tight leading-tight">
              Simple, Transparent Pricing.
            </h2>
            <p className="text-lg text-zinc-300 leading-relaxed max-w-2xl">
              Only pay when value moves.
            </p>
          </div>

          {/* Pricing Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-stretch">
            {/* Pricing Card 1: Direct Transfer */}
            <motion.div
              whileHover={{ y: -4 }}
              className="p-8 rounded-3xl border border-white/5 bg-white/[0.01] flex flex-col justify-between space-y-8 shadow-xl shadow-black/20"
            >
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-bold text-white">Direct Transfer</h3>
                  <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/10">Active Stellar Accounts</span>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-zinc-400 font-medium block">Flat Fee</span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-4xl font-mono font-black text-white">0.001 USDC</span>
                    <span className="text-xs text-zinc-505">Equivalent</span>
                  </div>
                  <span className="text-[11px] text-[#fa6400] font-semibold block mt-1">Paid by sender.</span>
                </div>
                <p className="text-sm text-zinc-405 leading-relaxed pt-2">
                  Direct instant route with all gas covered automatically behind the scenes.
                </p>
              </div>

              <div className="space-y-3 pt-6 border-t border-zinc-800/80">
                <div className="flex items-center gap-2.5 text-sm text-zinc-350">
                  <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>Instant route</span>
                </div>
                <div className="flex items-center gap-2.5 text-sm text-zinc-350">
                  <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>No XLM required</span>
                </div>
                <div className="flex items-center gap-2.5 text-sm text-zinc-350">
                  <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>Direct settlement</span>
                </div>
              </div>
            </motion.div>

            {/* Pricing Card 2: SwiftLink Vault Route */}
            <motion.div
              whileHover={{ y: -4 }}
              className="p-8 rounded-3xl border border-white/5 bg-white/[0.01] flex flex-col justify-between space-y-8 shadow-xl shadow-black/20"
            >
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-bold text-white">SwiftLink Vault Route</h3>
                  <span className="text-[10px] font-bold text-[#fa6400] uppercase tracking-widest bg-orange-500/10 px-2.5 py-1 rounded-full border border-orange-500/10">Activation & Setup Required</span>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-zinc-400 font-medium block">Claim Fee</span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-4xl font-mono font-black text-white">1%</span>
                    <span className="text-xs text-zinc-505">Claim Fee</span>
                  </div>
                  <span className="text-[11px] text-zinc-400 block mt-1">Minimum: $0.50 | Maximum: $3.00</span>
                  <span className="text-[11px] text-[#fa6400] font-semibold block mt-1">Paid by the recipient and automatically deducted from the claimed amount.</span>
                </div>
                <p className="text-sm text-zinc-405 leading-relaxed pt-2">
                  Safely locks stablecoins and co-sponsors trustline generation and reserves on-chain when claiming.
                </p>
              </div>

              <div className="space-y-3 pt-6 border-t border-zinc-800/80">
                <div className="flex items-center gap-2.5 text-sm text-zinc-350">
                  <Check className="h-4 w-4 text-[#fa6400] shrink-0" />
                  <span>Secure vault protection</span>
                </div>
                <div className="flex items-center gap-2.5 text-sm text-zinc-350">
                  <Check className="h-4 w-4 text-[#fa6400] shrink-0" />
                  <span>Claim link generation</span>
                </div>
                <div className="flex items-center gap-2.5 text-sm text-zinc-350">
                  <Check className="h-4 w-4 text-[#fa6400] shrink-0" />
                  <span>Activation and trustline support</span>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Pricing Footer */}
          <div className="mt-20 border-t border-zinc-900 pt-10 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div className="space-y-1">
              <span className="text-xs font-mono text-zinc-500 block">Pricing Rules</span>
              <span className="text-sm font-bold text-white block">No subscriptions.</span>
            </div>
            <div className="space-y-1">
              <span className="text-xs font-mono text-zinc-500 block">Billing Terms</span>
              <span className="text-sm font-bold text-white block">No monthly plans.</span>
            </div>
            <div className="space-y-1">
              <span className="text-xs font-mono text-zinc-500 block">Fee Schedule</span>
              <span className="text-sm font-bold text-white block">No hidden charges.</span>
            </div>
            <div className="space-y-1">
              <span className="text-xs font-mono text-zinc-500 block">Claim Condition</span>
              <span className="text-sm font-bold text-white block">Pay only when funds are delivered.</span>
            </div>
          </div>

          {/* Final CTA conversion panel */}
          <div className="mt-32 text-center max-w-4xl mx-auto space-y-8">
            <span className="text-xs font-bold uppercase tracking-widest text-[#fa6400]">
              Get Started
            </span>
            <h3 className="text-4xl md:text-5xl font-black text-white tracking-tight">
              Ready to Route Your First Payment?
            </h3>
            <p className="text-lg text-zinc-305 max-w-2xl mx-auto leading-relaxed">
              Connect your wallet and let SwiftClaim choose the right delivery path automatically.
            </p>
            <div className="pt-4 flex justify-center">
              <Link href="/dashboard">
                <button className="px-8 py-4 bg-gradient-to-r from-[#ff5500] to-[#ff7700] hover:from-[#e04b00] hover:to-[#ff5500] text-white font-bold rounded-full border border-orange-400/30 shadow-lg shadow-orange-500/20 hover:shadow-orange-500/35 transition-all flex items-center gap-2.5 cursor-pointer">
                  Launch Dashboard
                  <ArrowRight className="h-4 w-4" />
                </button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Main Page Footer */}
      <footer className="w-full py-12 px-6 md:px-12 border-t border-zinc-900 bg-[#050505] z-10">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-zinc-500">
          <div>© {new Date().getFullYear()} SwiftClaim Protocol. All rights reserved.</div>
          <div className="flex gap-6">
            <a href="#privacy" className="hover:text-zinc-400 transition-colors">Privacy Policy</a>
            <a href="#terms" className="hover:text-zinc-400 transition-colors">Terms of Service</a>
          </div>
        </div>
      </footer>

    </motion.div>
  )
}
