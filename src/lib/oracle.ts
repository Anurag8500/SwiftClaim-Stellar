import * as StellarSdk from '@stellar/stellar-sdk'

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

  // Construct raw buffers in exact order using modern APIs
  const encoder = new TextEncoder()
  const assetBytes = encoder.encode(assetCode)

  // 16-byte buffer for scaled_price (i128), write to lower 8 bytes as Big-Endian
  const priceBuffer = new Uint8Array(16)
  const priceView = new DataView(priceBuffer.buffer)
  priceView.setBigInt64(8, BigInt(scaledPrice), false) // Big-Endian

  // 8-byte buffer for expiration_timestamp (u64) as Big-Endian
  const timeBuffer = new Uint8Array(8)
  const timeView = new DataView(timeBuffer.buffer)
  timeView.setBigUint64(0, BigInt(expirationTimestamp), false) // Big-Endian

  // Concatenate all buffers
  const combinedBuffer = new Uint8Array(assetBytes.length + priceBuffer.length + timeBuffer.length)
  combinedBuffer.set(assetBytes, 0)
  combinedBuffer.set(priceBuffer, assetBytes.length)
  combinedBuffer.set(timeBuffer, assetBytes.length + priceBuffer.length)

  // Sign raw buffer — keypair.sign accepts Buffer or Uint8Array
  const signatureRaw = keypair.sign(Buffer.from(combinedBuffer))

  // Convert signature to hex string
  const signature = Array.from(signatureRaw)
    .map((b: number) => b.toString(16).padStart(2, '0'))
    .join('')

  return {
    signature,
    oraclePublicKey: keypair.publicKey()
  }
}
