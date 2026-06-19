import * as StellarSdk from '@stellar/stellar-sdk'

// Map of asset codes to their Binance trading pair symbols for generic fallback.
const BINANCE_SYMBOL_MAP: Record<string, string> = {
  EURC: 'EURUSDT',
}

// Helpers to fetch prices from individual APIs with caching disabled.
async function fetchBinancePrice(): Promise<number> {
  const response = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=EURUSDT', {
    cache: 'no-store'
  })
  if (!response.ok) {
    throw new Error(`Binance API returned HTTP ${response.status}`)
  }
  const data = await response.json()
  const price = parseFloat(data.price)
  if (isNaN(price) || price <= 0) {
    throw new Error(`Invalid Binance price: ${data.price}`)
  }
  return price
}

async function fetchCoinbasePrice(): Promise<number> {
  const response = await fetch('https://api.coinbase.com/v2/prices/EURC-USDC/spot', {
    cache: 'no-store'
  })
  if (!response.ok) {
    throw new Error(`Coinbase API returned HTTP ${response.status}`)
  }
  const data = await response.json()
  const price = parseFloat(data.data?.amount)
  if (isNaN(price) || price <= 0) {
    throw new Error(`Invalid Coinbase price: ${data.data?.amount}`)
  }
  return price
}

async function fetchKrakenPrice(): Promise<number> {
  const response = await fetch('https://api.kraken.com/0/public/Ticker?pair=EURCUSDC', {
    cache: 'no-store'
  })
  if (!response.ok) {
    throw new Error(`Kraken API returned HTTP ${response.status}`)
  }
  const data = await response.json()
  const pairData = data.result?.EURCUSDC || data.result?.EEURCUSDC
  const price = parseFloat(pairData?.c?.[0])
  if (isNaN(price) || price <= 0) {
    throw new Error(`Invalid Kraken price: ${pairData?.c?.[0]}`)
  }
  return price
}

export async function getAttestedPriceData(assetCode: string) {
  let price: number

  if (assetCode === 'USDC') {
    price = 1.0
  } else if (assetCode === 'EURC') {
    console.log('[Oracle] Fetching real-time EURC rates from Coinbase, Binance, and Kraken...')
    
    const results = await Promise.allSettled([
      fetchCoinbasePrice(),
      fetchBinancePrice(),
      fetchKrakenPrice()
    ])

    const validPrices: number[] = []
    const sources = ['Coinbase', 'Binance', 'Kraken']

    results.forEach((res, index) => {
      const source = sources[index]
      if (res.status === 'fulfilled') {
        validPrices.push(res.value)
        console.log(`[Oracle] ${source} EURC price: ${res.value}`)
      } else {
        console.warn(`[Oracle] ${source} fetch failed:`, res.reason instanceof Error ? res.reason.message : res.reason)
      }
    })

    if (validPrices.length === 0) {
      throw new Error('Failed to fetch EURC price from all sources (Coinbase, Binance, Kraken)')
    }

    const sum = validPrices.reduce((a, b) => a + b, 0)
    price = sum / validPrices.length
    console.log(`[Oracle] EURC combined index price (avg of ${validPrices.length} source(s)): ${price.toFixed(6)}`)
  } else {
    const symbol = BINANCE_SYMBOL_MAP[assetCode] || `${assetCode}USDC`
    console.log(`[Oracle] Fetching fallback price for ${assetCode} (Binance: ${symbol})...`)
    const response = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`, {
      cache: 'no-store'
    })
    if (!response.ok) {
      throw new Error(`Binance API returned ${response.status} for symbol ${symbol}`)
    }
    const data = await response.json()
    price = parseFloat(data.price)
    if (isNaN(price) || price <= 0) {
      throw new Error(`Invalid price received for ${assetCode} (symbol: ${symbol}): ${data.price}`)
    }
    console.log(`[Oracle] Fallback price for ${assetCode}: ${price}`)
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

  const encoder = new TextEncoder()

  // Domain separator — MUST match DOMAIN_SEPARATOR in contracts/swiftvault/src/lib.rs
  const DOMAIN_SEPARATOR = 'SwiftClaim:OracleAttestation:v1:'
  const domainBytes = encoder.encode(DOMAIN_SEPARATOR)

  const assetBytes = encoder.encode(assetCode)

  // 16-byte buffer for scaled_price (i128), written to bytes 8–15 as big-endian i64.
  // Bytes 0–7 remain 0x00 (high bits of i128, zero for normal prices).
  const priceBuffer = new Uint8Array(16)
  const priceView = new DataView(priceBuffer.buffer)
  priceView.setBigInt64(8, BigInt(scaledPrice), false) // offset 8, big-endian

  // 8-byte buffer for expiration_timestamp (u64) as big-endian
  const timeBuffer = new Uint8Array(8)
  const timeView = new DataView(timeBuffer.buffer)
  timeView.setBigUint64(0, BigInt(expirationTimestamp), false)

  // Concatenate: domain || asset_code || scaled_price(16B) || expiration(8B)
  const combinedBuffer = new Uint8Array(
    domainBytes.length + assetBytes.length + priceBuffer.length + timeBuffer.length
  )
  combinedBuffer.set(domainBytes, 0)
  combinedBuffer.set(assetBytes, domainBytes.length)
  combinedBuffer.set(priceBuffer, domainBytes.length + assetBytes.length)
  combinedBuffer.set(timeBuffer, domainBytes.length + assetBytes.length + priceBuffer.length)

  const signatureRaw = keypair.sign(Buffer.from(combinedBuffer))

  const signature = Array.from(signatureRaw)
    .map((b: number) => b.toString(16).padStart(2, '0'))
    .join('')

  return {
    signature,
    oraclePublicKey: keypair.publicKey()
  }
}
