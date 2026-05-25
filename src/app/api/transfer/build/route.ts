import { NextResponse } from 'next/server'
import * as StellarSdk from '@stellar/stellar-sdk'
import { server, TESTNET_USDC } from '@/lib/stellar'
import { getTreasuryKeypair } from '@/lib/treasury'

export async function POST(request: Request) {
  try {
    const { senderPublicKey, receiverPublicKey, amount } = await request.json()

    const treasuryKeypair = getTreasuryKeypair()
    const treasuryPublicKey = treasuryKeypair.publicKey()

    const sourceAccount = await server.loadAccount(senderPublicKey)

    const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: StellarSdk.Networks.TESTNET,
    })
      .addOperation(
        StellarSdk.Operation.payment({
          destination: receiverPublicKey,
          asset: TESTNET_USDC,
          amount: amount.toString(),
        })
      )
      .addOperation(
        StellarSdk.Operation.payment({
          destination: treasuryPublicKey,
          asset: TESTNET_USDC,
          amount: '0.001',
        })
      )
      .setTimeout(StellarSdk.TimeoutInfinite)
      .build()

    return NextResponse.json({ xdr: transaction.toXDR() })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An error occurred' },
      { status: 500 }
    )
  }
}
