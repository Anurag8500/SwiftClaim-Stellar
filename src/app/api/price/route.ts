import { NextResponse } from 'next/server'
import { getAttestedPriceData } from '@/lib/oracle'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const assetCode = searchParams.get('asset') || 'USDC'

    const priceData = await getAttestedPriceData(assetCode)
    const price = parseInt(priceData.scaledPrice) / 10_000_000

    return NextResponse.json({ price, scaledPrice: priceData.scaledPrice })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An error occurred' },
      { status: 500 }
    )
  }
}
