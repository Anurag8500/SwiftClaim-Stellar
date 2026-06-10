'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { useWallet } from '@/contexts/WalletContext'

export default function Navbar() {
  const { isConnected, publicKey, connectWallet, disconnectWallet } = useWallet()

  const truncatePublicKey = (pk: string) => {
    return `${pk.slice(0, 4)}...${pk.slice(-4)}`
  }

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3 group">
          <img src="/logo.png" alt="SwiftClaim Logo" className="h-16 w-16 object-contain" />
          <span className="text-xl font-bold tracking-tight text-white group-hover:text-white/80 transition-colors">
            SwiftClaim
          </span>
        </Link>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={isConnected ? disconnectWallet : connectWallet}
          className="rounded-2xl border border-zinc-800 bg-zinc-900/50 px-6 py-2 text-sm font-semibold text-zinc-50 shadow-lg shadow-blue-500/10 hover:border-blue-400 hover:shadow-blue-500/20 transition-all"
        >
          {isConnected && publicKey ? truncatePublicKey(publicKey) : 'Connect Wallet'}
        </motion.button>
      </div>
    </nav>
  )
}
