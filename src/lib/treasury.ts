import * as StellarSdk from '@stellar/stellar-sdk'

export function getTreasuryKeypair() {
  const secret = process.env.TREASURY_SECRET_KEY
  if (!secret) {
    throw new Error(
      'TREASURY_SECRET_KEY environment variable is not configured. ' +
      'Check your .env.local file.'
    )
  }
  return StellarSdk.Keypair.fromSecret(secret)
}
