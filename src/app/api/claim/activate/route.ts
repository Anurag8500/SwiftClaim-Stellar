import { NextResponse } from 'next/server'
import * as StellarSdk from '@stellar/stellar-sdk'
import { server, ASSETS } from '@/lib/stellar'
import { getTreasuryKeypair } from '@/lib/treasury'

export async function POST(request: Request) {
  try {
    const { receiverPublicKey, targetAsset, lockedAssetContractId } = await request.json()

    const treasuryKeypair = getTreasuryKeypair()
    const treasuryPublicKey = treasuryKeypair.publicKey()
    const sourceAccount = await server.loadAccount(treasuryPublicKey)

    // Resolve classic assets from contract IDs
    function resolveClassicAsset(contractId: string): { asset: StellarSdk.Asset; code: string } | null {
      for (const [, assetInfo] of Object.entries(ASSETS)) {
        if (assetInfo.contractId === contractId) {
          return {
            asset: new StellarSdk.Asset(assetInfo.code, assetInfo.issuer!),
            code: assetInfo.code,
          }
        }
      }
      return null
    }

    const targetAssetInfo = resolveClassicAsset(targetAsset)
    const lockedAssetInfo = lockedAssetContractId ? resolveClassicAsset(lockedAssetContractId) : null

    // Collect unique trustlines needed (locked asset + target asset, deduplicated)
    const trustlines: StellarSdk.Asset[] = []
    if (lockedAssetInfo && lockedAssetInfo.code !== 'XLM') {
      trustlines.push(lockedAssetInfo.asset)
    }
    if (targetAssetInfo && targetAssetInfo.code !== 'XLM') {
      // Only add if different from locked asset
      if (!lockedAssetInfo || targetAssetInfo.code !== lockedAssetInfo.code) {
        trustlines.push(targetAssetInfo.asset)
      }
    }

    // Build classic activation tx:
    // beginSponsoring → createAccount → changeTrust(s) → endSponsoring
    // Treasury is the source (sponsor), receiver co-signs client-side.
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

    // Add trustline for each asset (locked + target if different)
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
