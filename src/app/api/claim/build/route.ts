import { NextResponse } from 'next/server'
import * as StellarSdk from '@stellar/stellar-sdk'
import { server, sorobanServer, SWIFTVAULT_CONTRACT_ID } from '@/lib/stellar'
import { getAttestedPriceData, signPriceData } from '@/lib/oracle'
import { formatAttestationToXDR } from '@/lib/soroban'

export async function POST(request: Request) {
  try {
    const {
      receiverPublicKey,
      amount,
      assetCode = 'USDC',
    } = await request.json()

    const priceData = await getAttestedPriceData(assetCode)
    const livePrice = parseInt(priceData.scaledPrice) / 10_000_000
    const standardAmount = Number(amount) / 10_000_000

    if (standardAmount * livePrice < 1.00) {
      return NextResponse.json(
        { error: 'Transfer amount must be at least $1.00 USD equivalent.' },
        { status: 400 }
      )
    }

    const signatureData = signPriceData(
      priceData.assetCode,
      priceData.scaledPrice,
      priceData.expirationTimestamp
    )
    const attestationPayload = { ...priceData, ...signatureData }

    // Use RECEIVER as the tx source. The receiver's wallet will sign
    // this tx classically (as source) AND sign the Soroban auth entries.
    // Treasury pays fees via a fee bump wrapper in the submit step.
    const sourceAccount = await server.loadAccount(receiverPublicKey)

    // Build single Soroban operation — simplified claim (no router, no swap)
    // The contract releases principal → receiver, fee → treasury, both in locked asset.
    const contract = new StellarSdk.Contract(SWIFTVAULT_CONTRACT_ID)
    const invokeOp = contract.call(
      'claim',
      new StellarSdk.Address(receiverPublicKey).toScVal(),
      formatAttestationToXDR(attestationPayload)
    )

    const claimTx = new StellarSdk.TransactionBuilder(sourceAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: StellarSdk.Networks.TESTNET,
    })
      .addOperation(invokeOp)
      .setTimeout(300)
      .build()

    // Simulate — single op, works with Soroban RPC
    const simulation = await sorobanServer.simulateTransaction(claimTx)
    if (StellarSdk.rpc.Api.isSimulationError(simulation)) {
      throw new Error(simulation.error)
    }

    // assembleTransaction injects Soroban auth entries for receiver.require_auth()
    const assembledClaimTx = StellarSdk.rpc.assembleTransaction(claimTx, simulation).build()
    // DO NOT sign here — receiver signs in frontend, treasury wraps in fee bump in submit

    return NextResponse.json({
      xdr: assembledClaimTx.toXDR(),
      attestationPayload,
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An error occurred' },
      { status: 500 }
    )
  }
}
