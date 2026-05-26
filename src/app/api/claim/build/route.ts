import { NextResponse } from 'next/server'
import * as StellarSdk from '@stellar/stellar-sdk'
import { server, TESTNET_USDC } from '@/lib/stellar'
import { getTreasuryKeypair } from '@/lib/treasury'
import { getAttestedPriceData, signPriceData } from '@/lib/oracle'

export async function POST(request: Request) {
  try {
    const { receiverPublicKey, vaultId, amount, assetCode = 'USDC' } = await request.json()

    const priceData = await getAttestedPriceData(assetCode)
    const livePrice = parseInt(priceData.scaledPrice) / 10_000_000

    if (amount * livePrice < 1.00) {
      return NextResponse.json(
        { error: 'Transfer amount must be at least $1.00 USD equivalent.' },
        { status: 400 }
      )
    }

    const signatureData = signPriceData(priceData.assetCode, priceData.scaledPrice, priceData.expirationTimestamp)
    const attestationPayload = {
      ...priceData,
      ...signatureData
    }

    const treasuryKeypair = getTreasuryKeypair()
    const treasuryPublicKey = treasuryKeypair.publicKey()
    const sourceAccount = await server.loadAccount(treasuryPublicKey)

    const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
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
      .addOperation(
        StellarSdk.Operation.changeTrust({
          asset: TESTNET_USDC,
          source: receiverPublicKey,
        })
      )
      .addOperation(
        StellarSdk.Operation.claimClaimableBalance({
          balanceId: vaultId,
          source: receiverPublicKey,
        })
      )
      .addOperation(
        StellarSdk.Operation.endSponsoringFutureReserves({
          source: receiverPublicKey,
        })
      )
      .setTimeout(StellarSdk.TimeoutInfinite)
      .build()

    transaction.sign(treasuryKeypair)

    return NextResponse.json({ xdr: transaction.toXDR(), attestationPayload })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An error occurred' },
      { status: 500 }
    )
  }
}
