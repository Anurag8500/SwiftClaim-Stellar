import * as StellarSdk from '@stellar/stellar-sdk'

const server = new StellarSdk.Horizon.Server('https://horizon-testnet.stellar.org')

export const TESTNET_USDC = new StellarSdk.Asset(
  'USDC',
  'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5'
)

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

export async function fetchVaultData(vaultId: string) {
  const balance = await server.claimableBalances().claimableBalance(vaultId).call()
  return {
    amount: balance.amount,
    claimant: balance.claimants[0].destination,
  }
}
