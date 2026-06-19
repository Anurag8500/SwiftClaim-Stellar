import { NextResponse } from 'next/server'
import * as StellarSdk from '@stellar/stellar-sdk'
import { server, ASSETS } from '@/lib/stellar'
import { getTreasuryKeypair } from '@/lib/treasury'

/**
 * Wallet Activation — Build
 * 
 * Creates the ghost wallet on the Stellar ledger and adds trustlines for all
 * unique assets in the receiver's deposits.
 * 
 * Treasury sponsors the account reserve so no XLM is needed.
 * Operations: beginSponsoring → createAccount → changeTrust(s) → endSponsoring
 */
export async function POST(request: Request) {
  try {
    const { receiverPublicKey, assetContractIds } = await request.json()

    const treasuryKeypair = getTreasuryKeypair()
    const sourceAccount = await server.loadAccount(treasuryKeypair.publicKey())

    // Resolve classic assets from contract IDs (for changeTrust operations)
    function resolveClassicAsset(contractId: string): StellarSdk.Asset | null {
      for (const [, assetInfo] of Object.entries(ASSETS)) {
        if (assetInfo.contractId === contractId && assetInfo.code !== 'XLM') {
          return new StellarSdk.Asset(assetInfo.code, assetInfo.issuer!)
        }
      }
      return null
    }

    // Collect unique trustlines from all provided contract IDs
    const trustlines: StellarSdk.Asset[] = []
    const seen = new Set<string>()
    for (const contractId of (assetContractIds || [])) {
      const classicAsset = resolveClassicAsset(contractId)
      if (classicAsset && !seen.has(classicAsset.code)) {
        trustlines.push(classicAsset)
        seen.add(classicAsset.code)
      }
    }

    const txBuilder = new StellarSdk.TransactionBuilder(sourceAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: StellarSdk.Networks.TESTNET,
    })
      .addOperation(
        StellarSdk.Operation.beginSponsoringFutureReserves({
          sponsoredId: receiverPublicKey,
        })
      )
      .addOperation(
        StellarSdk.Operation.createAccount({
          destination: receiverPublicKey,
          startingBalance: '0',
        })
      )

    // Add trustlines for each unique asset
    for (const classicAsset of trustlines) {
      txBuilder.addOperation(
        StellarSdk.Operation.changeTrust({
          asset: classicAsset,
          source: receiverPublicKey,
        })
      )
    }

    txBuilder.addOperation(
      StellarSdk.Operation.endSponsoringFutureReserves({
        source: receiverPublicKey,
      })
    )

    const transaction = txBuilder.setTimeout(300).build()

    // Treasury signs as the source account
    transaction.sign(treasuryKeypair)

    return NextResponse.json({ xdr: transaction.toXDR() })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An error occurred' },
      { status: 500 }
    )
  }
}
