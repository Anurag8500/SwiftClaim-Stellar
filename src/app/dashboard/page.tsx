'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import GenerateLink from '@/components/dashboard/GenerateLink'
import VeteranSend from '@/components/dashboard/VeteranSend'

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState('generate')

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 flex gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-1">
          <button
            onClick={() => setActiveTab('generate')}
            className={`flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
              activeTab === 'generate'
                ? 'bg-zinc-800 text-zinc-50 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Generate SwiftLink
          </button>
          <button
            onClick={() => setActiveTab('send')}
            className={`flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
              activeTab === 'send'
                ? 'bg-zinc-800 text-zinc-50 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Send to Friend
          </button>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 backdrop-blur-sm">
          {activeTab === 'generate' ? (
            <GenerateLink />
          ) : (
            <VeteranSend />
          )}
        </div>
      </div>
    </div>
  )
}
