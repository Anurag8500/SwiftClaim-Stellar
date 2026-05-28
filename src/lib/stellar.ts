import * as StellarSdk from '@stellar/stellar-sdk'

const server = new StellarSdk.Horizon.Server('https://horizon-testnet.stellar.org')
export const sorobanServer = new StellarSdk.rpc.Server('https://soroban-testnet.stellar.org')

export { server }

export async function submitToNetwork(transaction: StellarSdk.Transaction) {
  return await server.submitTransaction(transaction)
}

export async function checkIfGhost(publicKey: string): Promise<boolean> {
  try {
    await server.loadAccount(publicKey)
    return false
  } catch (error: unknown) {
    // Horizon throws NotFoundError when account doesn't exist
    // The error message is "Not Found" and/or response.status is 404
    const err = error as Record<string, unknown>
    if (
      (error instanceof Error && (error.message.includes('Not Found') || error.message.includes('404'))) ||
      (err?.response && (err.response as Record<string, unknown>)?.status === 404) ||
      (typeof err?.status === 'number' && err.status === 404)
    ) {
      return true
    }
    console.error('Unexpected error checking ghost status:', error)
    return true // Treat as ghost by default if there's an error
  }
}

export const TESTNET_USDC = StellarSdk.Asset.native()

export async function fetchVaultData(vaultId: string) {
  const ledgerKey = StellarSdk.xdr.LedgerKey.contractData(
    new StellarSdk.xdr.LedgerKeyContractData({
      contract: new StellarSdk.Address(SWIFTVAULT_CONTRACT_ID).toScAddress(),
      key: new StellarSdk.Address(vaultId).toScVal(),
      durability: StellarSdk.xdr.ContractDataDurability.persistent(),
    })
  )

  const entries = await sorobanServer.getLedgerEntries(ledgerKey)

  if (entries.entries.length === 0) {
    throw new Error('Vault not found')
  }

  const record = StellarSdk.scValToNative(entries.entries[0].val.contractData().val()) as any
  const amount = record.amount.toString()
  const assetAddress = record.asset.toString()
  let assetCode = 'USDC'
  
  for (const [key, asset] of Object.entries(ASSETS)) {
    if (asset.contractId === assetAddress) {
      assetCode = asset.code
      break
    }
  }

  return { amount, claimant: vaultId, assetCode, assetAddress }
}

export const SWIFTVAULT_CONTRACT_ID = 'CCO33MBBJDNMECWBYTJ4BLLYKMMKGNAQBOVDQNGWHUVXGHWG7P742B6A'

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
