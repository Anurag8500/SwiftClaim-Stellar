import { NextResponse } from 'next/server'
import * as StellarSdk from '@stellar/stellar-sdk'
import { server, sorobanServer, SWIFTVAULT_CONTRACT_ID, ASSETS } from '@/lib/stellar'
import { getAttestedPriceData, signPriceData } from '@/lib/oracle'
import { formatAttestationToXDR } from '@/lib/soroban'

export async function POST(request: Request) {
  try {
    const { senderPublicKey, receiverPublicKey, amount, assetCode = 'USDC', assetAddress } = await request.json()

    // ── All financial math uses BigInt to match contract i128 arithmetic ──
    const priceData = await getAttestedPriceData(assetCode)
    const scaledPrice = BigInt(priceData.scaledPrice)

    // Parse amount string → stroops (7-decimal asset) without float
    const [whole, frac = ''] = (amount as string).split('.')
    const fracPadded = frac.padEnd(7, '0').slice(0, 7)
    const amountInStroops = BigInt(whole) * 10_000_000n + BigInt(fracPadded)

    // Dust shield check matching contract enforce_dust_shield
    const usdValue = (amountInStroops * scaledPrice) / 10_000_000n
    if (usdValue < 1_000_000n) {
      return NextResponse.json(
        { error: 'Transfer amount must be at least $1.00 USD equivalent.' },
        { status: 400 }
      )
    }

    // Calculate fee in token units for UI display (BigInt → float only for JSON response)
    const USDC_FEE_STROOPS = 10_000n // 0.001 USDC
    const feeInTokenStroops = assetCode === 'USDC'
      ? USDC_FEE_STROOPS
      : (USDC_FEE_STROOPS * 10_000_000n) / scaledPrice
    const feeInToken = Number(feeInTokenStroops) / 10_000_000
    const livePrice = Number(scaledPrice) / 10_000_000

    const signatureData = signPriceData(priceData.assetCode, priceData.scaledPrice, priceData.expirationTimestamp)
    const attestationPayload = { ...priceData, ...signatureData }

    const sourceAccount = await server.loadAccount(senderPublicKey)

    const contract = new StellarSdk.Contract(SWIFTVAULT_CONTRACT_ID)
    const invokeOp = contract.call(
      'direct_send',
      new StellarSdk.Address(senderPublicKey).toScVal(),
      new StellarSdk.Address(receiverPublicKey).toScVal(),
      new StellarSdk.Address(assetAddress).toScVal(),
      StellarSdk.nativeToScVal(amountInStroops, { type: 'i128' }),
      new StellarSdk.Address(ASSETS.USDC.contractId).toScVal(),
      formatAttestationToXDR(attestationPayload)
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

    return NextResponse.json({
      xdr: assembledTx.toXDR(),
      attestationPayload,
      feeInToken,
      livePrice,
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An error occurred' },
      { status: 500 }
    )
  }
}
