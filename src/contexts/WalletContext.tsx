'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { StellarWalletsKit, Networks } from '@creit.tech/stellar-wallets-kit'
import { FreighterModule, FREIGHTER_ID } from '@creit.tech/stellar-wallets-kit/modules/freighter'
import { AlbedoModule, ALBEDO_ID } from '@creit.tech/stellar-wallets-kit/modules/albedo'
import { xBullModule, XBULL_ID } from '@creit.tech/stellar-wallets-kit/modules/xbull'
import { LobstrModule, LOBSTR_ID } from '@creit.tech/stellar-wallets-kit/modules/lobstr'

interface WalletContextType {
  isConnected: boolean
  publicKey: string | null
  isGhost: boolean | null
  setIsGhost: (value: boolean | null) => void
  connectWallet: () => Promise<void>
  disconnectWallet: () => void
}

const WalletContext = createContext<WalletContextType | undefined>(undefined)

export function WalletProvider({ children }: { children: ReactNode }) {
  const [isConnected, setIsConnected] = useState(false)
  const [publicKey, setPublicKey] = useState<string | null>(null)
  const [isGhost, setIsGhost] = useState<boolean | null>(null)

  useEffect(() => {
    StellarWalletsKit.init({
      modules: [
        new FreighterModule(),
        new AlbedoModule(),
        new xBullModule(),
        new LobstrModule(),
      ],
      network: Networks.TESTNET,
    })

    const savedWallet = localStorage.getItem('stellar-wallet-connected')
    if (savedWallet) {
      setPublicKey(savedWallet)
      setIsConnected(true)
    }
  }, [])

  const connectWallet = async () => {
    try {
      const { address } = await StellarWalletsKit.authModal()
      setPublicKey(address)
      setIsConnected(true)
      localStorage.setItem('stellar-wallet-connected', address)
    } catch (error) {
      console.error('Failed to connect wallet:', error)
    }
  }

  const disconnectWallet = () => {
    setPublicKey(null)
    setIsConnected(false)
    setIsGhost(null)
    localStorage.removeItem('stellar-wallet-connected')
  }

  return (
    <WalletContext.Provider
      value={{
        isConnected,
        publicKey,
        isGhost,
        setIsGhost,
        connectWallet,
        disconnectWallet,
      }}
    >
      {children}
    </WalletContext.Provider>
  )
}

export function useWallet() {
  const context = useContext(WalletContext)
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider')
  }
  return context
}
