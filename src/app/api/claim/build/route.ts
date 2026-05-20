import { NextResponse } from 'next/server'
import * as StellarSdk from '@stellar/stellar-sdk'
import { server, TESTNET_USDC } from '@/lib/stellar'
import { getTreasuryKeypair } from '@/lib/treasury'

export async function POST(request: Request) {
  try {
    const { receiverPublicKey, vaultId, amount } = await request.json()

    const fee = Math.min(Math.max(parseFloat(amount) * 0.01, 0.50), 5.00).toFixed(2)

    const treasuryKeypair = getTreasuryKeypair()
    const treasuryPublicKey = treasuryKeypair.publicKey()
    const sourceAccount = await server.loadAccount(treasuryPublicKey)

    const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: StellarSdk.Networks.TESTNET,
    })
      .addOperation(
        StellarSdk.Operation.createAccount({
          destination: receiverPublicKey,
          startingBalance: '1.51',
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
        StellarSdk.Operation.payment({
          destination: treasuryPublicKey,
          asset: TESTNET_USDC,
          amount: fee,
          source: receiverPublicKey,
        })
      )
      .setTimeout(StellarSdk.TimeoutInfinite)
      .build()

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
