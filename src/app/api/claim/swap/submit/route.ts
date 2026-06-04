import { NextResponse } from 'next/server'
import * as StellarSdk from '@stellar/stellar-sdk'
import { server } from '@/lib/stellar'

export async function POST(request: Request) {
  try {
    const { signedXdr } = await request.json()

    // The tx was already signed by treasury in the build step.
    // The receiver added their signature in the frontend.
    // Treasury is the tx source, so it already pays fees — no fee bump needed.
    const tx = StellarSdk.TransactionBuilder.fromXDR(
      signedXdr,
      StellarSdk.Networks.TESTNET
    ) as StellarSdk.Transaction

    // Submit directly via Horizon (classic tx)
    const result = await server.submitTransaction(tx)

    return NextResponse.json({ success: true, hash: result.hash })
  } catch (error) {
    console.error(error)
    // Extract Horizon error details if available
    let message = error instanceof Error ? error.message : 'An error occurred'
    if ((error as any)?.response?.data?.extras?.result_codes) {
      const codes = (error as any).response.data.extras.result_codes
      message = `Swap failed: ${JSON.stringify(codes)}`
    }
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
