import { NextResponse } from 'next/server'
import * as StellarSdk from '@stellar/stellar-sdk'
import { sorobanServer, SWIFTVAULT_CONTRACT_ID, ASSETS } from '@/lib/stellar'
import { getAttestedPriceData } from '@/lib/oracle'
import { getTreasuryKeypair } from '@/lib/treasury'

/**
 * Multi-Vault Reader — uses contract simulation to read vault data.
 *
 * Why simulation instead of getLedgerEntries?
 * Soroban #[contracttype] enum serialization uses ScvVec([Symbol, fields...]),
 * not ScvMap. Constructing the XDR key manually is fragile and error-prone.
 * Simulating get_vault_count / get_vault is reliable, version-proof, and
 * will always produce exactly what the contract reads.
 */

/** Simulate a read-only contract call and return the retval ScVal, or null on failure. */
async function simulateRead(
  fnName: string,
  args: StellarSdk.xdr.ScVal[],
  sourcePublicKey: string
): Promise<StellarSdk.xdr.ScVal | null> {
  // Fresh Account object per simulation — sequence number is irrelevant for sim.
  const source = new StellarSdk.Account(sourcePublicKey, '100')
  const contract = new StellarSdk.Contract(SWIFTVAULT_CONTRACT_ID)

  const tx = new StellarSdk.TransactionBuilder(source, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: StellarSdk.Networks.TESTNET,
  })
    .addOperation(contract.call(fnName, ...args))
    .setTimeout(30)
    .build()

  const sim = await sorobanServer.simulateTransaction(tx)

  if (StellarSdk.rpc.Api.isSimulationError(sim)) {
    // Contract panic (e.g. vault slot not found) or other error — treat as empty
    console.warn(`[vault] simulateRead error for ${fnName}:`, sim.error)
    return null
  }

  return sim.result?.retval ?? null
}


/** Format stroops to a clean display string (removes trailing zeros). */
function toDisplay(stroops: bigint): string {
  const full = (Number(stroops) / 10_000_000).toFixed(7)
  return full.replace(/\.?0+$/, '') || '0'
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const receiver = searchParams.get('receiver')
    if (!receiver) {
      return NextResponse.json({ error: 'receiver query parameter is required' }, { status: 400 })
    }

    // Validate receiver is a valid Stellar public key
    try {
      StellarSdk.Keypair.fromPublicKey(receiver)
    } catch {
      return NextResponse.json({ error: 'Invalid receiver public key' }, { status: 400 })
    }

    // Get a server-side public key to use as the simulation source account
    const sourcePublicKey = getTreasuryKeypair().publicKey()

    // ── Step 1: get_vault_count(receiver) ────────────────────────────────
    const countRetval = await simulateRead(
      'get_vault_count',
      [new StellarSdk.Address(receiver).toScVal()],
      sourcePublicKey
    )

    if (countRetval === null) {
      return NextResponse.json({ receiver, deposits: [] })
    }

    const count = StellarSdk.scValToNative(countRetval) as number
    console.log(`[vault] Vault count for ${receiver.slice(0, 8)}...: ${count}`)

    if (!count || count === 0) {
      return NextResponse.json({ receiver, deposits: [] })
    }

    // ── Step 2: Fetch oracle prices for fee estimation ────────────────────
    const priceCache: Record<string, bigint> = {}
    for (const [, assetInfo] of Object.entries(ASSETS)) {
      try {
        const priceData = await getAttestedPriceData(assetInfo.code)
        priceCache[assetInfo.code] = BigInt(priceData.scaledPrice)
      } catch {
        priceCache[assetInfo.code] = assetInfo.code === 'USDC' ? 10_000_000n : 11_000_000n
      }
    }

    // ── Step 3: get_vault(receiver, i) for each slot ─────────────────────
    const deposits = []
    const assetTotalsMap: Record<string, {
      asset: string
      assetCode: string
      totalAmount: bigint
    }> = {}

    for (let i = 0; i < count; i++) {
      const vaultRetval = await simulateRead(
        'get_vault',
        [
          new StellarSdk.Address(receiver).toScVal(),
          StellarSdk.nativeToScVal(i, { type: 'u32' }),
        ],
        sourcePublicKey
      )

      if (vaultRetval === null) {
        console.warn(`[vault] Slot ${i} returned null — skipping`)
        continue
      }

      // EscrowRecord { asset: Address, asset_code: Bytes, amount: i128 }
      const record = StellarSdk.scValToNative(vaultRetval) as {
        asset: string | unknown
        asset_code: Uint8Array | Buffer
        amount: bigint
      }

      const assetCode = Buffer.from(record.asset_code as Uint8Array).toString('utf-8').trim()
      const amount = BigInt(record.amount.toString())
      const assetAddress = String(record.asset)

      deposits.push({
        index: i,
        asset: assetAddress,
        assetCode,
        amount: amount.toString(),
        amountDisplay: toDisplay(amount),
      })

      if (!assetTotalsMap[assetCode]) {
        assetTotalsMap[assetCode] = {
          asset: assetAddress,
          assetCode,
          totalAmount: 0n,
        }
      }
      assetTotalsMap[assetCode].totalAmount += amount
    }

    // Calculate combined total USD value across all assets
    let totalUsdValue = 0n
    for (const [code, info] of Object.entries(assetTotalsMap)) {
      const scaledPrice = priceCache[code] ?? 10_000_000n
      const usdVal = (info.totalAmount * scaledPrice) / 10_000_000n
      totalUsdValue += usdVal
    }

    // Calculate combined protocol fee in USD (1%, clamped $0.50–$3.00)
    let totalFeeUsd = totalUsdValue / 100n
    if (totalFeeUsd < 5_000_000n) {
      totalFeeUsd = 5_000_000n // $0.50 min
    } else if (totalFeeUsd > 30_000_000n) {
      totalFeeUsd = 30_000_000n // $3.00 max
    }

    // Distribute fee and calculate principal for each unique asset
    const assetTotals = []
    for (const [code, info] of Object.entries(assetTotalsMap)) {
      const feeAmount = totalUsdValue > 0n ? (info.totalAmount * totalFeeUsd) / totalUsdValue : 0n
      const principal = info.totalAmount - feeAmount

      console.log(`[vault] Asset ${code}: total ${toDisplay(info.totalAmount)} → fee ${toDisplay(feeAmount)} → net ${toDisplay(principal)}`)

      assetTotals.push({
        asset: info.asset,
        assetCode: code,
        amount: info.totalAmount.toString(),
        feeAmount: feeAmount.toString(),
        principal: principal.toString(),
        amountDisplay: toDisplay(info.totalAmount),
        feeDisplay: toDisplay(feeAmount),
        principalDisplay: toDisplay(principal),
      })
    }

    return NextResponse.json({ receiver, deposits, assetTotals })
  } catch (error) {
    console.error('[vault] Unexpected error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to read vault data' },
      { status: 500 }
    )
  }
}
