import * as StellarSdk from '@stellar/stellar-sdk'

export function getTreasuryKeypair() {
  return StellarSdk.Keypair.fromSecret(
    process.env.TREASURY_SECRET_KEY as string
  )
}
