import * as StellarSdk from '@stellar/stellar-sdk'
import crypto from 'crypto'

export async function getAttestedPriceData(assetCode: string) {
  let price: number

  if (assetCode === 'USDC') {
    price = 1.0
  } else {
    const symbol = `${assetCode}USDC`
    const response = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`, {
      next: { revalidate: 60 }
    })
    const data = await response.json()
    price = parseFloat(data.price)
  }

  const scaledPrice = Math.floor(price * 10_000_000).toString()
  const expirationTimestamp = Math.floor(Date.now() / 1000) + 300

  return { assetCode, scaledPrice, expirationTimestamp }
}

export function signPriceData(assetCode: string, scaledPrice: string, expirationTimestamp: number) {
  const oracleSecret = process.env.ORACLE_ADMIN_SECRET
  if (!oracleSecret) {
    throw new Error('ORACLE_ADMIN_SECRET is not set in environment variables')
  }

  const keypair = StellarSdk.Keypair.fromSecret(oracleSecret)

  // Construct raw buffers in exact order
  const assetBuffer = Buffer.from(assetCode, 'utf-8')
  
  // 16-byte buffer for scaled_price (i128), write to lower 8 bytes as Big-Endian
  const priceBuffer = Buffer.alloc(16)
  priceBuffer.writeBigInt64BE(BigInt(scaledPrice), 8)
  
  // 8-byte buffer for expiration_timestamp (u64) as Big-Endian
  const timeBuffer = Buffer.alloc(8)
  timeBuffer.writeBigUInt64BE(BigInt(expirationTimestamp), 0)

  // Concatenate all buffers
  const combinedBuffer = Buffer.concat([assetBuffer, priceBuffer, timeBuffer])
  
  // Sign raw buffer without pre-hashing
  const signature = keypair.sign(combinedBuffer).toString('hex')

  return {
    signature,
    oraclePublicKey: keypair.publicKey()
  }
}
