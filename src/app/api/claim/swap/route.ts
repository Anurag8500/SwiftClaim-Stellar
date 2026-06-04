import { NextResponse } from 'next/server'
import * as StellarSdk from '@stellar/stellar-sdk'
import { server, ASSETS } from '@/lib/stellar'
import { getAttestedPriceData } from '@/lib/oracle'
import { getTreasuryKeypair } from '@/lib/treasury'

export async function POST(request: Request) {
  try {
    const { receiverPublicKey, sendAmount, lockedAssetCode, targetAssetCode } = await request.json()

    const lockedAssetInfo = ASSETS[lockedAssetCode as keyof typeof ASSETS]
    const targetAssetInfo = ASSETS[targetAssetCode as keyof typeof ASSETS]

    if (!lockedAssetInfo || !targetAssetInfo) {
      return NextResponse.json({ error: 'Invalid asset code' }, { status: 400 })
    }

    if (lockedAssetCode === targetAssetCode) {
      return NextResponse.json({ error: 'No swap needed for same asset' }, { status: 400 })
    }

    // Fetch oracle prices for both assets to calculate conversion
    const lockedPriceData = await getAttestedPriceData(lockedAssetCode)
    const targetPriceData = await getAttestedPriceData(targetAssetCode)

    const lockedPrice = parseInt(lockedPriceData.scaledPrice) // price * 10^7
    const targetPrice = parseInt(targetPriceData.scaledPrice) // price * 10^7

    if (lockedPrice <= 0 || targetPrice <= 0) {
      return NextResponse.json({ error: 'Invalid oracle prices' }, { status: 500 })
    }

    // Calculate converted amount: sendAmount (in locked asset stroops) → target asset stroops
    // Formula: convertedAmount = sendAmount * lockedPrice / targetPrice
    const convertedAmount = Math.floor((Number(sendAmount) * lockedPrice) / targetPrice)

    if (convertedAmount <= 0) {
      return NextResponse.json({ error: 'Converted amount is zero' }, { status: 400 })
    }

    const lockedClassicAsset = new StellarSdk.Asset(lockedAssetInfo.code, lockedAssetInfo.issuer!)
    const targetClassicAsset = new StellarSdk.Asset(targetAssetInfo.code, targetAssetInfo.issuer!)

    const treasuryKeypair = getTreasuryKeypair()
    const treasuryPublicKey = treasuryKeypair.publicKey()

    // Treasury is the tx source (pays fees). Two operations:
    // 1. Receiver sends locked asset to Treasury
    // 2. Treasury sends target asset to Receiver (at oracle rate)
    const treasuryAccount = await server.loadAccount(treasuryPublicKey)

    const swapTx = new StellarSdk.TransactionBuilder(treasuryAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: StellarSdk.Networks.TESTNET,
    })
      .addOperation(
        StellarSdk.Operation.payment({
          source: receiverPublicKey, // Receiver is the source of this op
          destination: treasuryPublicKey,
          asset: lockedClassicAsset,
          amount: (Number(sendAmount) / 10_000_000).toFixed(7),
        })
      )
      .addOperation(
        StellarSdk.Operation.payment({
          // Treasury is the default source (tx source)
          destination: receiverPublicKey,
          asset: targetClassicAsset,
          amount: (convertedAmount / 10_000_000).toFixed(7),
        })
      )
      .setTimeout(300)
      .build()

    // Treasury signs for: tx source + op 2 (payment from treasury)
    swapTx.sign(treasuryKeypair)

    // Return partially-signed XDR — receiver still needs to sign for op 1
    return NextResponse.json({
      xdr: swapTx.toXDR(),
      convertedAmount: (convertedAmount / 10_000_000).toFixed(7),
      rate: (lockedPrice / targetPrice).toFixed(6),
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An error occurred' },
      { status: 500 }
    )
  }
}
