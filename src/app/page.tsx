'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { useWallet } from '@/contexts/WalletContext'

export default function LandingPage() {
  const { isConnected, publicKey, connectWallet, disconnectWallet } = useWallet()

  const truncateAddress = (addr: string) => {
    return `${addr.slice(0, 4)}...${addr.slice(-4)}`
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8, ease: 'easeOut' }}
      className="relative min-h-screen w-full bg-[#050505] text-white flex flex-col justify-between overflow-x-hidden font-sans select-none"
    >
      
      {/* 100vh Full Viewport Hero Section */}
      <header className="relative w-full h-screen flex flex-col justify-between overflow-hidden">
        
        {/* Background Image Layer: Anchored to display card visual on the right */}
        <div 
          className="absolute inset-0 bg-[url('/hero-bg.png')] bg-cover bg-no-repeat bg-[position:72%_center] md:bg-right-center w-full h-full z-0" 
        />
        
        {/* Smooth Gradient Overlay to transition into dark base color at the bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-[#050505] to-transparent pointer-events-none z-10" />

        <nav className="relative w-full z-50 pt-4 pb-2 px-6 md:px-12 bg-transparent">
          <div className="max-w-[1400px] mx-auto flex items-center justify-between">
            
            {/* Logo: Clickable brand logo image and text */}
            <Link href="/" className="flex items-center gap-3 group">
              <img src="/logo.png" alt="SwiftClaim Logo" className="h-16 w-16 object-contain" />
              <span className="text-xl font-bold tracking-tight text-white group-hover:text-white/80 transition-colors">
                SwiftClaim
              </span>
            </Link>

            {/* Navigation Links */}
            <div className="hidden md:flex items-center gap-8 text-sm font-medium text-white/80">
              <a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a>
              <a href="#security" className="hover:text-white transition-colors">Security</a>
              <a href="#docs" className="hover:text-white transition-colors">Docs</a>
              <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
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
            <div className="md:col-span-6 lg:col-span-5 flex flex-col items-start text-left space-y-6 md:space-y-8 z-10 max-w-[540px]">
              
              {/* Bold White Display Title */}
              <h1 className="text-4xl sm:text-5xl lg:text-[60px] font-black text-white leading-[1.08] tracking-tight">
                Kill The Wallet Setup.<br />
                Keep The Payment.
              </h1>

              {/* Soft White Copywriting */}
              <p className="text-lg text-white/80 leading-relaxed font-normal max-w-[500px]">
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
                  <button className="w-full sm:w-auto px-8 py-4 bg-white/5 hover:bg-white/10 text-white font-bold rounded-full border border-white/20 hover:border-white/40 shadow-lg backdrop-blur-sm transition-all duration-300">
                    Launch App
                  </button>
                </Link>
              </div>

            </div>

            {/* Right Side Spacer for Desktop */}
            <div className="hidden md:block md:col-span-6 lg:col-span-7 h-full" />
            
            {/* Inline Image Container for Mobile Viewports (Below content) */}
            <div className="md:hidden col-span-1 w-full h-[260px] rounded-xl border border-white/10 shadow-xl overflow-hidden bg-[url('/hero-bg.png')] bg-cover bg-[position:center_right] bg-no-repeat mt-4" />

          </div>
        </div>

        {/* Empty layout height block at the bottom of hero */}
        <div className="h-10 w-full" />

      </header>

      {/* Main Page Footer: Renders below 100vh viewport */}
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
