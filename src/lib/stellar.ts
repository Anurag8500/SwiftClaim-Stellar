import * as StellarSdk from '@stellar/stellar-sdk'

const server = new StellarSdk.Horizon.Server('https://horizon-testnet.stellar.org')
export const sorobanServer = new StellarSdk.rpc.Server('https://soroban-testnet.stellar.org')

export { server }

export async function submitToNetwork(transaction: StellarSdk.Transaction) {
  return await server.submitTransaction(transaction)
}

/**
 * Checks if a Stellar public key belongs to a ghost (non-existent / unactivated) wallet.
 * Throws on network errors instead of silently defaulting to true — prevents misrouting funds.
 */
export async function checkIfGhost(publicKey: string): Promise<boolean> {
  try {
    await server.loadAccount(publicKey)
    return false
  } catch (error: unknown) {
    const err = error as Record<string, unknown>
    if (
      (error instanceof Error && (error.message.includes('Not Found') || error.message.includes('404'))) ||
      (err?.response && (err.response as Record<string, unknown>)?.status === 404) ||
      (typeof err?.status === 'number' && err.status === 404)
    ) {
      return true // Account genuinely does not exist
    }
    // Do NOT default to true on unexpected errors — propagate so caller can show an error
    console.error('Unexpected error checking ghost status:', error)
    throw new Error(
      'Unable to determine account status. Check your network connection and try again.'
    )
  }
}

/**
 * Validates a Stellar public key using the actual Ed25519 checksum,
 * not just length/prefix heuristics.
 */
export function isValidPublicKey(key: string): boolean {
  try {
    StellarSdk.Keypair.fromPublicKey(key)
    return true
  } catch {
    return false
  }
}

export const SWIFTVAULT_CONTRACT_ID = 'CAPN3ZQ2BKYRE65LPVYGGPIOH5R5ZZXAVEE6P7AX4DPJEA67TCI24VYL'

const usdcAsset = new StellarSdk.Asset('USDC', 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5')
const eurcAsset = new StellarSdk.Asset('EURC', 'GB3Q6QDZYTHWT7E5PVS3W7FUT5GVAFC5KSZFFLPU25GO7VTC3NM2ZTVO')

export const ASSETS = {
  USDC: {
    code: 'USDC',
    issuer: usdcAsset.issuer,
    contractId: usdcAsset.contractId(StellarSdk.Networks.TESTNET),
    decimals: 7,
  },
  EURC: {
    code: 'EURC',
    issuer: eurcAsset.issuer,
    contractId: eurcAsset.contractId(StellarSdk.Networks.TESTNET),
    decimals: 7,
  },
}
