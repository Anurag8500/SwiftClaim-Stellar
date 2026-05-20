import * as StellarSdk from '@stellar/stellar-sdk'

const server = new StellarSdk.Horizon.Server('https://horizon-testnet.stellar.org')

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
