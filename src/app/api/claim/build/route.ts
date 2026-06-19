import { NextResponse } from 'next/server'
import * as StellarSdk from '@stellar/stellar-sdk'
import { server, sorobanServer, SWIFTVAULT_CONTRACT_ID, ASSETS } from '@/lib/stellar'
import { getAttestedPriceData, signPriceData } from '@/lib/oracle'
import { formatAttestationsVecToXDR } from '@/lib/soroban'

/**
 * Claim Build — Multi-Vault
 * 
 * Fetches oracle attestations for ALL supported assets and builds the
 * claim(receiver, Vec<OracleAttestation>) Soroban transaction.
 * 
 * The contract processes all pending deposits in one atomic call.
 * Fee breakdown is computed by /api/vault before this step.
 */
export async function POST(request: Request) {
  try {
    const { receiverPublicKey } = await request.json()

    // Fetch and sign attestations for every supported asset
    const attestationPayloads = []
    for (const [, assetInfo] of Object.entries(ASSETS)) {
      const priceData = await getAttestedPriceData(assetInfo.code)
      const signatureData = signPriceData(
        priceData.assetCode,
        priceData.scaledPrice,
        priceData.expirationTimestamp
      )
      attestationPayloads.push({ ...priceData, ...signatureData })
    }

    // Use RECEIVER as the tx source — treasury fee-bumps in the submit step
    const sourceAccount = await server.loadAccount(receiverPublicKey)

    const contract = new StellarSdk.Contract(SWIFTVAULT_CONTRACT_ID)
    const invokeOp = contract.call(
      'claim',
      new StellarSdk.Address(receiverPublicKey).toScVal(),
      formatAttestationsVecToXDR(attestationPayloads)
    )

    const claimTx = new StellarSdk.TransactionBuilder(sourceAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: StellarSdk.Networks.TESTNET,
    })
      .addOperation(invokeOp)
      .setTimeout(300)
      .build()

    const simulation = await sorobanServer.simulateTransaction(claimTx)
    if (StellarSdk.rpc.Api.isSimulationError(simulation)) {
      throw new Error(simulation.error)
    }

    const assembledClaimTx = StellarSdk.rpc.assembleTransaction(claimTx, simulation).build()

    return NextResponse.json({
      xdr: assembledClaimTx.toXDR(),
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An error occurred' },
      { status: 500 }
    )
  }
}
