import { NextResponse } from 'next/server'
import * as StellarSdk from '@stellar/stellar-sdk'
import { sorobanServer } from '@/lib/stellar'

export async function POST(request: Request) {
  try {
    const { signedXdr } = await request.json()

    const transaction = StellarSdk.TransactionBuilder.fromXDR(
      signedXdr,
      StellarSdk.Networks.TESTNET
    ) as StellarSdk.Transaction

    const sendResult = await sorobanServer.sendTransaction(transaction)
    const transactionHash = sendResult.hash

    let receipt
    let attempts = 0
    const maxAttempts = 30
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000))
      receipt = await sorobanServer.getTransaction(transactionHash)

      if (receipt.status === StellarSdk.rpc.Api.GetTransactionStatus.SUCCESS) {
        break
      } else if (receipt.status === StellarSdk.rpc.Api.GetTransactionStatus.FAILED) {
        throw new Error('Transaction failed')
      }
      attempts++
    }

    if (attempts >= maxAttempts) {
      throw new Error('Transaction confirmation timed out after 60 seconds')
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
