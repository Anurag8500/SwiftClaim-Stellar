import { NextResponse } from 'next/server'
import * as StellarSdk from '@stellar/stellar-sdk'
import { server, ASSETS } from '@/lib/stellar'
import { getTreasuryKeypair } from '@/lib/treasury'

export async function POST(request: Request) {
  try {
    const { receiverPublicKey, targetAsset } = await request.json()

    const treasuryKeypair = getTreasuryKeypair()
    const treasuryPublicKey = treasuryKeypair.publicKey()
    const sourceAccount = await server.loadAccount(treasuryPublicKey)

    // Look up the correct asset issuer from the ASSETS registry
    let targetClassicAsset: StellarSdk.Asset = StellarSdk.Asset.native()
    let targetAssetCode = 'XLM'
    for (const [, assetInfo] of Object.entries(ASSETS)) {
      if (assetInfo.contractId === targetAsset) {
        targetClassicAsset = new StellarSdk.Asset(assetInfo.code, assetInfo.issuer!)
        targetAssetCode = assetInfo.code
        break
      }
    }

    // Build classic activation tx:
    // beginSponsoring → createAccount → changeTrust → endSponsoring
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

    if (targetAssetCode !== 'XLM') {
      txBuilder.addOperation(
        StellarSdk.Operation.changeTrust({
          asset: targetClassicAsset,
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
