import { NextResponse } from 'next/server'
import * as StellarSdk from '@stellar/stellar-sdk'
import { server, sorobanServer, SWIFTVAULT_CONTRACT_ID } from '@/lib/stellar'
import { getAttestedPriceData, signPriceData } from '@/lib/oracle'
import { formatAttestationToXDR } from '@/lib/soroban'

/**
 * Replicate the contract's fee calculation using the SAME integer math.
 * Must match contracts/swiftvault/src/lib.rs::calculate_protocol_fee exactly.
 */
function calculateProtocolFee(amount: bigint, scaledPrice: bigint): bigint {
  const baseFee = amount / 100n
  const feeUsdValue = (baseFee * scaledPrice) / 10_000_000n

  if (feeUsdValue < 5_000_000n) {
    // Clamp to $0.50 equivalent
    return (5_000_000n * 10_000_000n) / scaledPrice
  } else if (feeUsdValue > 30_000_000n) {
    // Clamp to $3.00 equivalent
    return (30_000_000n * 10_000_000n) / scaledPrice
  } else {
    return baseFee
  }
}

export async function POST(request: Request) {
  try {
    const {
      receiverPublicKey,
      amount,
      assetCode = 'USDC',
    } = await request.json()

    const priceData = await getAttestedPriceData(assetCode)
    const scaledPrice = BigInt(priceData.scaledPrice)
    const livePrice = Number(scaledPrice) / 10_000_000
    const rawAmount = BigInt(amount)
    const standardAmount = Number(rawAmount) / 10_000_000

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

    // Calculate fee and principal using EXACT same BigInt math as the contract
    const feeAmount = calculateProtocolFee(rawAmount, scaledPrice)
    const principalAmount = rawAmount - feeAmount

    // Use RECEIVER as the tx source. Treasury pays fees via fee bump in submit step.
    const sourceAccount = await server.loadAccount(receiverPublicKey)

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

    const simulation = await sorobanServer.simulateTransaction(claimTx)
    if (StellarSdk.rpc.Api.isSimulationError(simulation)) {
      throw new Error(simulation.error)
    }

    const assembledClaimTx = StellarSdk.rpc.assembleTransaction(claimTx, simulation).build()

    return NextResponse.json({
      xdr: assembledClaimTx.toXDR(),
      attestationPayload,
      // Return exact amounts so frontend doesn't need to recalculate
      principalAmount: principalAmount.toString(),
      feeAmount: feeAmount.toString(),
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An error occurred' },
      { status: 500 }
    )
  }
}
