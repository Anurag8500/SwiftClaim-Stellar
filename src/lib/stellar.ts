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
  const claimableBalance = await server.claimableBalances().claimableBalance(vaultId).call()
  const amount = claimableBalance.amount
  const claimant = claimableBalance.claimants[0].destination
  return { amount, claimant }
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
