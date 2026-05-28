import { NextResponse } from 'next/server'
import * as StellarSdk from '@stellar/stellar-sdk'
import { sorobanServer } from '@/lib/stellar'
import { getTreasuryKeypair } from '@/lib/treasury'

export async function POST(request: Request) {
  try {
    const { signedXdr } = await request.json()

    const treasuryKeypair = getTreasuryKeypair()

    // The inner tx was signed by the receiver (as tx source + Soroban auth entries).
    // Wrap it in a fee bump transaction so the treasury pays all fees.
    const innerTx = StellarSdk.TransactionBuilder.fromXDR(
      signedXdr,
      StellarSdk.Networks.TESTNET
    ) as StellarSdk.Transaction

    // Fee bump: treasury pays. Set fee higher than inner tx's fee.
    const feeBumpTx = StellarSdk.TransactionBuilder.buildFeeBumpTransaction(
      treasuryKeypair.publicKey(),
      (Number(innerTx.fee) + 10000).toString(),
      innerTx,
      StellarSdk.Networks.TESTNET
    )
    feeBumpTx.sign(treasuryKeypair)

    const sendResult = await sorobanServer.sendTransaction(feeBumpTx)
    if (sendResult.status === 'ERROR') {
      throw new Error(`Soroban send failed: ${JSON.stringify(sendResult.errorResult)}`)
    }

    const transactionHash = sendResult.hash

    // Poll for transaction confirmation
    let receipt
    let attempts = 0
    const maxAttempts = 30
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000))
      receipt = await sorobanServer.getTransaction(transactionHash)

      if (receipt.status === StellarSdk.rpc.Api.GetTransactionStatus.SUCCESS) {
        break
      } else if (receipt.status === StellarSdk.rpc.Api.GetTransactionStatus.FAILED) {
        throw new Error('Claim transaction failed on-chain')
      }
      attempts++
    }

    if (attempts >= maxAttempts) {
      throw new Error('Transaction confirmation timed out')
    }

    return NextResponse.json({ success: true, hash: transactionHash })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An error occurred' },
      { status: 500 }
    )
  }
}
