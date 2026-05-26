import { NextResponse } from 'next/server'
import * as StellarSdk from '@stellar/stellar-sdk'
import { server, sorobanServer, SWIFTVAULT_CONTRACT_ID } from '@/lib/stellar'
import { getAttestedPriceData, signPriceData } from '@/lib/oracle'
import { formatAttestationToXDR } from '@/lib/soroban'

export async function POST(request: Request) {
  try {
    const { senderPublicKey, receiverPublicKey, amount, assetCode = 'USDC', assetAddress } = await request.json()

    const priceData = await getAttestedPriceData(assetCode)
    const livePrice = parseInt(priceData.scaledPrice) / 10_000_000

    if (amount * livePrice < 1.00) {
      return NextResponse.json(
        { error: 'Transfer amount must be at least $1.00 USD equivalent.' },
        { status: 400 }
      )
    }

    const signatureData = signPriceData(priceData.assetCode, priceData.scaledPrice, priceData.expirationTimestamp)
    const attestationPayload = {
      ...priceData,
      ...signatureData
    }

    const sourceAccount = await server.loadAccount(senderPublicKey)

    // Build contract invocation
    const contract = new StellarSdk.Contract(SWIFTVAULT_CONTRACT_ID)
    const invokeOp = contract.call(
      'direct_send',
      StellarSdk.nativeToScVal(new StellarSdk.Address(senderPublicKey)),
      StellarSdk.nativeToScVal(new StellarSdk.Address(receiverPublicKey)),
      StellarSdk.nativeToScVal(new StellarSdk.Address(assetAddress)),
      StellarSdk.nativeToScVal(BigInt(amount)),
      formatAttestationToXDR(attestationPayload)
    )

    const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: StellarSdk.Networks.TESTNET,
    })
      .addOperation(invokeOp)
      .setTimeout(300)
      .build()

    // Simulate transaction
    const simulation = await sorobanServer.simulateTransaction(transaction)
    if ('error' in simulation) {
      throw new Error(simulation.error.toString())
    }

    // Assemble transaction
    const assembledTxBuilder = StellarSdk.rpc.assembleTransaction(transaction, simulation)
    const assembledTx = assembledTxBuilder.build()

    return NextResponse.json({ xdr: assembledTx.toXDR(), attestationPayload })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An error occurred' },
      { status: 500 }
    )
  }
}
