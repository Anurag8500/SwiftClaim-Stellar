import { NextResponse } from 'next/server'
import * as StellarSdk from '@stellar/stellar-sdk'
import { server, sorobanServer, SWIFTVAULT_CONTRACT_ID } from '@/lib/stellar'

export async function POST(request: Request) {
  try {
    const { senderPublicKey, receiverPublicKey, assetAddress, amount } = await request.json()

    const sourceAccount = await server.loadAccount(senderPublicKey)

    const contract = new StellarSdk.Contract(SWIFTVAULT_CONTRACT_ID)
    const invokeOp = contract.call(
      'lock_funds',
      StellarSdk.nativeToScVal(new StellarSdk.Address(senderPublicKey)),
      StellarSdk.nativeToScVal(new StellarSdk.Address(receiverPublicKey)),
      StellarSdk.nativeToScVal(new StellarSdk.Address(assetAddress)),
      StellarSdk.nativeToScVal(BigInt(amount))
    )

    const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: StellarSdk.Networks.TESTNET,
    })
      .addOperation(invokeOp)
      .setTimeout(300)
      .build()

    const simulation = await sorobanServer.simulateTransaction(transaction)
    if ('error' in simulation) {
      throw new Error(simulation.error.toString())
    }

    const assembledTxBuilder = StellarSdk.rpc.assembleTransaction(transaction, simulation)
    const assembledTx = assembledTxBuilder.build()

    return NextResponse.json({ xdr: assembledTx.toXDR() })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An error occurred' },
      { status: 500 }
    )
  }
}
