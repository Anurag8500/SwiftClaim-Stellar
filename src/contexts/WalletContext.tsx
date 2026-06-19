'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { StellarWalletsKit, Networks } from '@creit.tech/stellar-wallets-kit'
import { FreighterModule } from '@creit.tech/stellar-wallets-kit/modules/freighter'
import { AlbedoModule } from '@creit.tech/stellar-wallets-kit/modules/albedo'
import { xBullModule } from '@creit.tech/stellar-wallets-kit/modules/xbull'
import { LobstrModule } from '@creit.tech/stellar-wallets-kit/modules/lobstr'

interface WalletContextType {
  isConnected: boolean
  publicKey: string | null
  isGhost: boolean | null
  setIsGhost: (value: boolean | null) => void
  connectWallet: () => Promise<void>
  disconnectWallet: () => void
}

const WalletContext = createContext<WalletContextType | undefined>(undefined)

const STORAGE_KEY = 'stellar-wallet-connected'

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

    // Restore session from localStorage.
    // We load the saved key but defer to the user to confirm if signing fails —
    // the wallet extension may have been locked/disconnected since last session.
    const savedWallet = localStorage.getItem(STORAGE_KEY)
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
      localStorage.setItem(STORAGE_KEY, address)
    } catch (error) {
      console.error('Failed to connect wallet:', error)
      // If the connect itself fails (e.g. user dismissed the modal), clear any
      // stale state so the next click opens the modal fresh.
      const errorMsg = error instanceof Error ? error.message : String(error)
      if (
        errorMsg.includes('rejected') ||
        errorMsg.includes('cancelled') ||
        errorMsg.includes('denied')
      ) {
        // User explicitly dismissed — don't clear localStorage
        return
      }
      // Unknown error: clear stale state
      disconnectWallet()
    }
  }

  const disconnectWallet = () => {
    setPublicKey(null)
    setIsConnected(false)
    setIsGhost(null)
    localStorage.removeItem(STORAGE_KEY)
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
