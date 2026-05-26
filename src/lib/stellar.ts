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
  } catch (error) {
    if (error instanceof Error && error.message.includes('404')) {
      return true
    }
    throw error
  }
}

export const TESTNET_USDC = StellarSdk.Asset.native()

export async function fetchVaultData(vaultId: string) {
  const ledgerKey = StellarSdk.xdr.LedgerKey.contractData(
    new StellarSdk.xdr.LedgerKeyContractData({
      contract: new StellarSdk.Address(SWIFTVAULT_CONTRACT_ID).toScAddress(),
      key: StellarSdk.nativeToScVal(new StellarSdk.Address(vaultId)),
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

export const SWIFTVAULT_CONTRACT_ID = 'CC4KLUJ2OW3FGHEY52NXP7IKXPGN6HFM3BXPUAKDJ2FFGGCUOVCKBMMP'

export const ASSETS = {
  USDC: {
    code: 'USDC',
    contractId: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
    decimals: 7,
  },
  EURC: {
    code: 'EURC',
    contractId: 'GB3Q6QDZYTHWT7E5PVS3W7FUT5GVAFC5KSZFFLPU25GO7VTC3NM2ZTVO',
    decimals: 7,
  },
}
