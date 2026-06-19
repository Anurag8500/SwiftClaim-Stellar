import { NextResponse } from 'next/server'
import * as StellarSdk from '@stellar/stellar-sdk'
import { server, sorobanServer, SWIFTVAULT_CONTRACT_ID, ASSETS } from '@/lib/stellar'
import { getAttestedPriceData, signPriceData } from '@/lib/oracle'

export async function POST(request: Request) {
  try {
    const { senderPublicKey, receiverPublicKey, assetAddress, assetCode = 'USDC', amount } = await request.json()

    const sourceAccount = await server.loadAccount(senderPublicKey)

    // ── BigInt math — eliminates float rounding for financial amounts ──
    const [whole, frac = ''] = (amount as string).split('.')
    const fracPadded = frac.padEnd(7, '0').slice(0, 7)
    const amountInStroops = BigInt(whole) * 10_000_000n + BigInt(fracPadded)

    // Validate minimum ($1 equivalent) — match contract dust shield
    const priceData = await getAttestedPriceData(assetCode)
    const scaledPrice = BigInt(priceData.scaledPrice)
    const usdValue = (amountInStroops * scaledPrice) / 10_000_000n
    if (usdValue < 1_000_000n) {
      return NextResponse.json(
        { error: 'Transfer amount must be at least $1.00 USD equivalent.' },
        { status: 400 }
      )
    }

    // Build asset_code as Bytes ScVal (UTF-8)
    const assetCodeScVal = StellarSdk.xdr.ScVal.scvBytes(Buffer.from(assetCode, 'utf-8'))

    const contract = new StellarSdk.Contract(SWIFTVAULT_CONTRACT_ID)
    const invokeOp = contract.call(
      'lock_funds',
      new StellarSdk.Address(senderPublicKey).toScVal(),
      new StellarSdk.Address(receiverPublicKey).toScVal(),
      new StellarSdk.Address(assetAddress).toScVal(),
      assetCodeScVal,
      StellarSdk.nativeToScVal(amountInStroops, { type: 'i128' })
    )

    const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: StellarSdk.Networks.TESTNET,
    })
      .addOperation(invokeOp)
      .setTimeout(300)
      .build()

    const simulation = await sorobanServer.simulateTransaction(transaction)
    if (StellarSdk.rpc.Api.isSimulationError(simulation)) {
      throw new Error(simulation.error)
    }

    const assembledTx = StellarSdk.rpc.assembleTransaction(transaction, simulation).build()

    return NextResponse.json({ xdr: assembledTx.toXDR() })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An error occurred' },
      { status: 500 }
    )
  }
}
