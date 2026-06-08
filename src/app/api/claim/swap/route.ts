import { NextResponse } from 'next/server'
import * as StellarSdk from '@stellar/stellar-sdk'
import { server, ASSETS } from '@/lib/stellar'
import { getAttestedPriceData } from '@/lib/oracle'
import { getTreasuryKeypair } from '@/lib/treasury'

/**
 * Treasury Conversion Engine — Build
 * 
 * Converts locked asset → target asset using live oracle rates.
 * Treasury acts as the counterparty: receives locked asset, sends target asset.
 * 
 * Math (BigInt, no floating point):
 *   convertedAmount = sendAmount * lockedScaledPrice / targetScaledPrice
 * 
 * Two payment ops in one atomic tx:
 *   Op 1: Receiver → Treasury (locked asset)  [source: receiver]
 *   Op 2: Treasury → Receiver (target asset)  [source: treasury]
 */
export async function POST(request: Request) {
  try {
    const { receiverPublicKey, sendAmount, lockedAssetCode, targetAssetCode } = await request.json()

    const lockedAssetInfo = ASSETS[lockedAssetCode as keyof typeof ASSETS]
    const targetAssetInfo = ASSETS[targetAssetCode as keyof typeof ASSETS]

    if (!lockedAssetInfo || !targetAssetInfo) {
      return NextResponse.json({ error: 'Invalid asset code' }, { status: 400 })
    }

    if (lockedAssetCode === targetAssetCode) {
      return NextResponse.json({ error: 'No conversion needed for same asset' }, { status: 400 })
    }

    // Fetch live oracle prices for BOTH assets (same Binance source as contract attestation)
    const lockedPriceData = await getAttestedPriceData(lockedAssetCode)
    const targetPriceData = await getAttestedPriceData(targetAssetCode)

    const lockedScaledPrice = BigInt(lockedPriceData.scaledPrice)
    const targetScaledPrice = BigInt(targetPriceData.scaledPrice)
    const sendAmountBig = BigInt(sendAmount)

    if (lockedScaledPrice <= 0n || targetScaledPrice <= 0n) {
      return NextResponse.json({ error: 'Invalid oracle prices' }, { status: 500 })
    }

    // Convert using BigInt integer math (no floating point, no rounding errors)
    // Formula: convertedAmount = sendAmount * lockedPrice / targetPrice
    // Example: 25000000 USDC stroops * 10000000 / 11200000 = 22321428 EURC stroops
    const convertedAmount = sendAmountBig * lockedScaledPrice / targetScaledPrice

    if (convertedAmount <= 0n) {
      return NextResponse.json({ error: 'Converted amount is zero' }, { status: 400 })
    }

    const lockedClassicAsset = new StellarSdk.Asset(lockedAssetInfo.code, lockedAssetInfo.issuer!)
    const targetClassicAsset = new StellarSdk.Asset(targetAssetInfo.code, targetAssetInfo.issuer!)

    const treasuryKeypair = getTreasuryKeypair()
    const treasuryPublicKey = treasuryKeypair.publicKey()

    // Treasury is the tx source (pays fees). Two operations:
    // Op 1: Receiver sends locked asset to Treasury
    // Op 2: Treasury sends target asset to Receiver at oracle rate
    const treasuryAccount = await server.loadAccount(treasuryPublicKey)

    const sendAmountStr = (Number(sendAmountBig) / 10_000_000).toFixed(7)
    const convertedAmountStr = (Number(convertedAmount) / 10_000_000).toFixed(7)

    const swapTx = new StellarSdk.TransactionBuilder(treasuryAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: StellarSdk.Networks.TESTNET,
    })
      .addOperation(
        StellarSdk.Operation.payment({
          source: receiverPublicKey,
          destination: treasuryPublicKey,
          asset: lockedClassicAsset,
          amount: sendAmountStr,
        })
      )
      .addOperation(
        StellarSdk.Operation.payment({
          destination: receiverPublicKey,
          asset: targetClassicAsset,
          amount: convertedAmountStr,
        })
      )
      .setTimeout(300)
      .build()

    // Treasury signs for: tx source + op 2
    swapTx.sign(treasuryKeypair)

    // Return partially-signed XDR — receiver still needs to sign for op 1
    return NextResponse.json({
      xdr: swapTx.toXDR(),
      convertedAmount: convertedAmountStr,
      lockedPrice: lockedPriceData.scaledPrice,
      targetPrice: targetPriceData.scaledPrice,
      rate: (Number(lockedScaledPrice) / Number(targetScaledPrice)).toFixed(6),
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An error occurred' },
      { status: 500 }
    )
  }
}
