import * as StellarSdk from '@stellar/stellar-sdk'

export function formatAttestationToXDR(payload: any): StellarSdk.xdr.ScVal {
  const entries: StellarSdk.xdr.ScMapEntry[] = []

  // asset_code
  entries.push(
    new StellarSdk.xdr.ScMapEntry({
      key: StellarSdk.nativeToScVal('asset_code'),
      val: StellarSdk.nativeToScVal(Buffer.from(payload.assetCode, 'utf-8')),
    })
  )

  // expiration_timestamp
  entries.push(
    new StellarSdk.xdr.ScMapEntry({
      key: StellarSdk.nativeToScVal('expiration_timestamp'),
      val: StellarSdk.xdr.ScVal.scvU64(new StellarSdk.xdr.Uint64(payload.expirationTimestamp)),
    })
  )

  // scaled_price
  entries.push(
    new StellarSdk.xdr.ScMapEntry({
      key: StellarSdk.nativeToScVal('scaled_price'),
      val: StellarSdk.xdr.ScVal.scvI128(
        new StellarSdk.xdr.Int128Parts({
          lo: new StellarSdk.xdr.Uint64(BigInt(payload.scaledPrice) & BigInt('0xffffffffffffffff')),
          hi: new StellarSdk.xdr.Int64(BigInt(payload.scaledPrice) >> BigInt(64)),
        })
      ),
    })
  )

  // signature
  entries.push(
    new StellarSdk.xdr.ScMapEntry({
      key: StellarSdk.nativeToScVal('signature'),
      val: StellarSdk.xdr.ScVal.scvBytes(Buffer.from(payload.signature, 'hex')),
    })
  )

  return StellarSdk.xdr.ScVal.scvMap(entries)
}
