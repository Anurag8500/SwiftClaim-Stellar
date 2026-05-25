import { NextResponse } from 'next/server'
import * as StellarSdk from '@stellar/stellar-sdk'
import { server } from '@/lib/stellar'
import { getTreasuryKeypair } from '@/lib/treasury'

export async function POST(request: Request) {
  try {
    const { signedXdr } = await request.json()

    const treasuryKeypair = getTreasuryKeypair()

    const innerTx = StellarSdk.TransactionBuilder.fromXDR(
      signedXdr,
      StellarSdk.Networks.TESTNET
    ) as StellarSdk.Transaction

    const feeBumpTx = (StellarSdk.TransactionBuilder as any).buildFeeBumpTransaction(
      treasuryKeypair,
      innerTx,
      StellarSdk.BASE_FEE,
      StellarSdk.Networks.TESTNET
    )

    feeBumpTx.sign(treasuryKeypair)

    await server.submitTransaction(feeBumpTx)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An error occurred' },
      { status: 500 }
    )
  }
}
