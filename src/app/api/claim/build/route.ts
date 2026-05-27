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
    const standardAmount = Number(amount) / 10_000_000

    if (standardAmount * livePrice < 1.00) {
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
      new StellarSdk.Address(receiverPublicKey).toScVal(),
      new StellarSdk.Address(routerAddress).toScVal(),
      new StellarSdk.Address(usdcAddress).toScVal(),
      new StellarSdk.Address(targetAsset).toScVal(),
      StellarSdk.nativeToScVal(BigInt(minPrincipalOut), { type: 'i128' }),
      StellarSdk.nativeToScVal(BigInt(minFeeOut), { type: 'i128' }),
      StellarSdk.nativeToScVal(BigInt(deadline), { type: 'u64' }),
      formatAttestationToXDR(attestationPayload)
    )

    const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: StellarSdk.Networks.TESTNET,
    })
      .addOperation(
        StellarSdk.Operation.beginSponsoringFutureReserves({
          sponsoredId: receiverPublicKey,
        })
      )
      .addOperation(
        StellarSdk.Operation.createAccount({
          destination: receiverPublicKey,
          startingBalance: '0',
        })
      )
      .addOperation(
        StellarSdk.Operation.changeTrust({
          asset: new StellarSdk.Address(targetAsset).toString() === 'native' 
            ? StellarSdk.Asset.native() 
            : new StellarSdk.Asset(assetCode, targetAsset),
          source: receiverPublicKey,
        })
      )
      .addOperation(invokeOp)
      .addOperation(
        StellarSdk.Operation.endSponsoringFutureReserves({
          source: receiverPublicKey,
        })
      )
      .setTimeout(300)
      .build()

    // Simulate transaction
    const simulation = await sorobanServer.simulateTransaction(transaction)
    if (StellarSdk.rpc.Api.isSimulationError(simulation)) {
      throw new Error(simulation.error)
    }

    // Assemble transaction
    const signedTx = StellarSdk.rpc.assembleTransaction(transaction, simulation).build()
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
