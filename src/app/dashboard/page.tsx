'use client'

import { useState, useEffect } from 'react'
import GenerateLink from '@/components/dashboard/GenerateLink'
import VeteranSend from '@/components/dashboard/VeteranSend'
import { checkIfGhost } from '@/lib/stellar'

export default function DashboardPage() {
  const [destinationPublicKey, setDestinationPublicKey] = useState('')
  const [isGhost, setIsGhost] = useState<boolean | null>(null)
  const [isChecking, setIsChecking] = useState(false)

  useEffect(() => {
    async function checkGhostStatus() {
      if (destinationPublicKey.length === 56 && destinationPublicKey.startsWith('G')) {
        setIsChecking(true)
        try {
          const ghost = await checkIfGhost(destinationPublicKey)
          setIsGhost(ghost)
        } catch (error) {
          console.error('Error checking ghost status:', error)
        } finally {
          setIsChecking(false)
        }
      } else {
        setIsGhost(null)
      }
    }
    checkGhostStatus()
  }, [destinationPublicKey])

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6">
          <label className="mb-2 block text-sm font-medium text-zinc-300">
            Destination Public Key
          </label>
          <input
            type="text"
            value={destinationPublicKey}
            onChange={(e) => setDestinationPublicKey(e.target.value)}
            placeholder="G..."
            className="w-full rounded-2xl border border-zinc-800 bg-zinc-900/50 px-4 py-3 text-lg text-zinc-50 placeholder:text-zinc-600 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
        </div>

        {isChecking && (
          <div className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-600 border-t-blue-400" />
              Checking wallet status...
            </div>
          </div>
        )}

        {isGhost !== null && !isChecking && (
          <div className="mb-6 flex items-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
            <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${isGhost ? 'bg-yellow-900/30 text-yellow-400' : 'bg-green-900/30 text-green-400'}`}>
              {isGhost ? 'Unregistered User — Escrow Flow' : 'Active Stellar Wallet'}
            </span>
          </div>
        )}

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 backdrop-blur-sm">
          {isGhost ? (
            <GenerateLink receiverPublicKey={destinationPublicKey} />
          ) : isGhost === false ? (
            <VeteranSend receiverPublicKey={destinationPublicKey} />
          ) : (
            <div className="text-center text-zinc-400">
              Enter a valid Stellar public key to continue
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
