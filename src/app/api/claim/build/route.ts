import { NextResponse } from 'next/server'
import * as StellarSdk from '@stellar/stellar-sdk'
import { server, sorobanServer, SWIFTVAULT_CONTRACT_ID } from '@/lib/stellar'
import { getAttestedPriceData, signPriceData } from '@/lib/oracle'
import { formatAttestationToXDR } from '@/lib/soroban'
import { getTreasuryKeypair } from '@/lib/treasury'

export async function POST(request: Request) {
  try {
    const { receiverPublicKey, routerAddress, usdcAddress, targetAsset, minPrincipalOut, minFeeOut, deadline, amount, assetCode = 'USDC' } = await request.json()

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

    const treasuryKeypair = getTreasuryKeypair()
    const treasuryPublicKey = treasuryKeypair.publicKey()
    const sourceAccount = await server.loadAccount(treasuryPublicKey)

    // Build contract invocation
    const contract = new StellarSdk.Contract(SWIFTVAULT_CONTRACT_ID)
    const invokeOp = contract.call(
      'claim_and_swap',
      StellarSdk.nativeToScVal(new StellarSdk.Address(receiverPublicKey)),
      StellarSdk.nativeToScVal(new StellarSdk.Address(routerAddress)),
      StellarSdk.nativeToScVal(new StellarSdk.Address(usdcAddress)),
      StellarSdk.nativeToScVal(new StellarSdk.Address(targetAsset)),
      StellarSdk.nativeToScVal(BigInt(minPrincipalOut)),
      StellarSdk.nativeToScVal(BigInt(minFeeOut)),
      StellarSdk.nativeToScVal(BigInt(deadline)),
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
    const signedTx = assembledTxBuilder.build()
    signedTx.sign(treasuryKeypair)

    return NextResponse.json({ xdr: signedTx.toXDR(), attestationPayload })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An error occurred' },
      { status: 500 }
    )
  }
}
