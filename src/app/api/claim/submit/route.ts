import { NextResponse } from 'next/server'
import * as StellarSdk from '@stellar/stellar-sdk'
import { server } from '@/lib/stellar'

export async function POST(request: Request) {
  try {
    const { signedXdr } = await request.json()

    const transaction = StellarSdk.TransactionBuilder.fromXDR(
      signedXdr,
      StellarSdk.Networks.TESTNET
    ) as StellarSdk.Transaction

    await server.submitTransaction(transaction)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An error occurred' },
      { status: 500 }
    )
  }
}
