import { NextResponse } from 'next/server'
import * as StellarSdk from '@stellar/stellar-sdk'
import { server } from '@/lib/stellar'

/**
 * Treasury Conversion Engine — Submit
 * 
 * The tx was already signed by treasury (build step) and receiver (frontend).
 * Treasury is the tx source, so it pays fees. Just submit directly.
 */
export async function POST(request: Request) {
  try {
    const { signedXdr } = await request.json()

    const tx = StellarSdk.TransactionBuilder.fromXDR(
      signedXdr,
      StellarSdk.Networks.TESTNET
    ) as StellarSdk.Transaction

    // Submit directly via Horizon — treasury already signed and pays fees
    const result = await server.submitTransaction(tx)

    return NextResponse.json({ success: true, hash: result.hash })
  } catch (error) {
    console.error(error)
    let message = error instanceof Error ? error.message : 'An error occurred'
    if ((error as any)?.response?.data?.extras?.result_codes) {
      const codes = (error as any).response.data.extras.result_codes
      message = `Conversion failed: ${JSON.stringify(codes)}`
    }
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
