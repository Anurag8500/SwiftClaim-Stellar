import * as StellarSdk from '@stellar/stellar-sdk'

export function formatAttestationToXDR(payload: any): StellarSdk.xdr.ScVal {
  const entries: StellarSdk.xdr.ScMapEntry[] = []

  // MUST BE SORTED LEXICOGRAPHICALLY!
  // 1. asset_code
  entries.push(
    new StellarSdk.xdr.ScMapEntry({
      key: StellarSdk.nativeToScVal('asset_code', { type: 'symbol' }),
      val: StellarSdk.xdr.ScVal.scvBytes(Buffer.from(payload.assetCode, 'utf-8')),
    })
  )

  // 2. expiration_timestamp
  entries.push(
    new StellarSdk.xdr.ScMapEntry({
      key: StellarSdk.nativeToScVal('expiration_timestamp', { type: 'symbol' }),
      val: StellarSdk.nativeToScVal(payload.expirationTimestamp, { type: 'u64' }),
    })
  )

  // 3. scaled_price
  entries.push(
    new StellarSdk.xdr.ScMapEntry({
      key: StellarSdk.nativeToScVal('scaled_price', { type: 'symbol' }),
      val: StellarSdk.nativeToScVal(BigInt(payload.scaledPrice), { type: 'i128' }),
    })
  )

  // 4. signature
  entries.push(
    new StellarSdk.xdr.ScMapEntry({
      key: StellarSdk.nativeToScVal('signature', { type: 'symbol' }),
      val: StellarSdk.xdr.ScVal.scvBytes(Buffer.from(payload.signature, 'hex')),
    })
  )

  return StellarSdk.xdr.ScVal.scvMap(entries)
}
