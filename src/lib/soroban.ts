import * as StellarSdk from '@stellar/stellar-sdk'

/**
 * Formats a single OracleAttestation payload into an XDR ScVal (ScvMap).
 * Fields MUST be in lexicographic order to match the Soroban #[contracttype] struct.
 */
export function formatAttestationToXDR(payload: any): StellarSdk.xdr.ScVal {
  const entries: StellarSdk.xdr.ScMapEntry[] = []

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

/**
 * Formats an array of OracleAttestation payloads into a Soroban Vec<OracleAttestation> ScVal.
 * Used for the updated claim() function which accepts Vec<OracleAttestation>.
 */
export function formatAttestationsVecToXDR(attestationPayloads: any[]): StellarSdk.xdr.ScVal {
  return StellarSdk.xdr.ScVal.scvVec(
    attestationPayloads.map(p => formatAttestationToXDR(p))
  )
}
