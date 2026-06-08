import { NextResponse } from 'next/server'
import * as StellarSdk from '@stellar/stellar-sdk'
import { server, ASSETS } from '@/lib/stellar'
import { getTreasuryKeypair } from '@/lib/treasury'
import { getAttestedPriceData } from '@/lib/oracle'

export const dynamic = 'force-dynamic'

/**
 * Treasury Dashboard API
 * 
 * Returns treasury balances in all supported assets and total value in USDC.
 * Useful for monitoring and planning rebalancing.
 */
export async function GET() {
  try {
    const treasuryKeypair = getTreasuryKeypair()
    const treasuryPublicKey = treasuryKeypair.publicKey()

    const account = await server.loadAccount(treasuryPublicKey)

    // Parse balances
    const balances: Record<string, { balance: string; usdValue: number }> = {}
    let xlmBalance = '0'

    for (const bal of account.balances) {
      if (bal.asset_type === 'native') {
        xlmBalance = bal.balance
      } else if ('asset_code' in bal && 'asset_issuer' in bal) {
        // Check if this is one of our supported assets
        for (const [code, info] of Object.entries(ASSETS)) {
          if (bal.asset_code === info.code && bal.asset_issuer === info.issuer) {
            balances[code] = { balance: bal.balance, usdValue: 0 }
          }
        }
      }
    }

    // Fetch oracle prices and calculate USD values
    let totalUsdValue = 0

    for (const [code, data] of Object.entries(balances)) {
      try {
        const priceData = await getAttestedPriceData(code)
        const price = parseInt(priceData.scaledPrice) / 10_000_000
        data.usdValue = parseFloat(data.balance) * price
        totalUsdValue += data.usdValue
      } catch {
        // If price fetch fails, mark as unknown
        data.usdValue = -1
      }
    }

    return NextResponse.json({
      publicKey: treasuryPublicKey,
      xlmBalance,
      assets: balances,
      totalUsdValue: parseFloat(totalUsdValue.toFixed(2)),
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An error occurred' },
      { status: 500 }
    )
  }
}
