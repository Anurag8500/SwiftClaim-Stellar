import { NextResponse } from 'next/server'
import * as StellarSdk from '@stellar/stellar-sdk'
import { server, sorobanServer, SWIFTVAULT_CONTRACT_ID } from '@/lib/stellar'

export async function POST(request: Request) {
  try {
    const { senderPublicKey, receiverPublicKey, assetAddress, amount } = await request.json()

    const sourceAccount = await server.loadAccount(senderPublicKey)
    const amountInStroops = Math.floor(parseFloat(amount) * 10_000_000)

    const contract = new StellarSdk.Contract(SWIFTVAULT_CONTRACT_ID)
    const invokeOp = contract.call(
      'lock_funds',
      new StellarSdk.Address(senderPublicKey).toScVal(),
      new StellarSdk.Address(receiverPublicKey).toScVal(),
      new StellarSdk.Address(assetAddress).toScVal(),
      StellarSdk.nativeToScVal(BigInt(amountInStroops), { type: 'i128' })
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
