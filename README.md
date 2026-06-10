<div align="center">

# 🌌 SwiftClaim

**Zero-Gas Escrows & Gasless Cross-Asset Payouts on Stellar powered by Soroban Smart Contracts**

[![Next.js](https://img.shields.io/badge/Next.js-16.2-blue?logo=nextdotjs&color=05060f)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript&color=2f343e)](https://www.typescriptlang.org/)
[![Stellar](https://img.shields.io/badge/Stellar-Testnet-blue?logo=stellar&color=3f4959)](https://stellar.org/)
[![Soroban](https://img.shields.io/badge/Soroban-Smart%20Contracts-orange?logo=rust&color=663af3)](https://soroban.stellar.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-cyan?logo=tailwindcss&color=269684)](https://tailwindcss.com/)

> SwiftClaim is a decentralized, non-custodial escrow and payment protocol built on **Stellar** using **Soroban smart contracts** and **Next.js 16**. It allows users to send stablecoins (USDC/EURC) to active wallets or lock funds for unregistered/empty "ghost" wallets via secure, shareable **SwiftLinks**, completely sponsoring account activation and gas costs for the recipient.

</div>

---

🎨 **Design System:** Midnight Glass Blueprint — A technical, high-fidelity dark-mode interface utilizing a near-black canvas (`#05060f`), cool blue-gray typography, and a single high-contrast `electric-iris` purple highlight accent (`#663af3`).

🌐 **Network Integration:** Connects natively to Stellar Testnet Horizon and Soroban RPC nodes for real-time validation and submission.

---

## 📋 Table of Contents

1. [Protocol Overview](#-protocol-overview)
2. [Key Architecture Primitives](#-key-architecture-primitives)
3. [System Workflows](#-system-workflows)
   - [Flow A: Direct Send (Active Wallets)](#flow-a-direct-send-active-wallets)
   - [Flow B: SwiftLink Escrow & Claim (Ghost Wallets)](#flow-b-swiftlink-escrow--claim-ghost-wallets)
4. [Smart Contract Architecture](#-smart-contract-architecture)
   - [Custom Errors](#custom-errors)
   - [Data Structures](#data-structures)
   - [Contract Methods](#contract-methods)
5. [Real-Time Price Oracle Index](#-real-time-price-oracle-index)
6. [API Route References](#-api-route-references)
7. [Environment Variables](#-environment-variables)
8. [Project Directory Layout](#-project-directory-layout)
9. [Getting Started & Installation](#-getting-started--installation)
10. [Treasury & Security Mechanics](#-treasury--security-mechanics)

---

## 🚀 Protocol Overview

Sending crypto to non-crypto users usually hits an onboarding wall: they have no active wallet, no trustlines established, and no native gas (XLM) to pay transaction fees. 

**SwiftClaim solves this by utilizing three core innovations:**
- **Zero-Gas UX:** The recipient never pays for gas. Transactions are structured as sponsored operations where the treasury co-signs and pays the fee using Stellar fee-bumps.
- **Ghost Wallet Sponsorship:** Empty or unregistered destination wallets are activated on-chain dynamically using Stellar's `beginSponsoringFutureReserves` and `endSponsoringFutureReserves` mechanics, setting up trustlines for stablecoins without requiring native deposits.
- **Treasury-Backed Conversion:** Recipient claims can be made in the original locked asset or swapped automatically. If a swap is chosen, the treasury executes an atomic multi-payment clearing operation at the live oracle rate, bypassing public AMM pool slippage.

---

## ⚠️ The Problem & The Solution

| The Web3 UX Problem | SwiftClaim's Solution |
| :--- | :--- |
| **High Onboarding Friction**<br>Recipients must set up a wallet, undergo KYC, buy native crypto on exchanges, and transfer it just to claim a stablecoin transfer. | **Ghost Wallet Escrow (SwiftLinks)**<br>Send stablecoins to anyone. Recipients just click a secure shareable link (SwiftLink) to claim funds instantly with no pre-requisites. |
| **Gas Dependency (No XLM)**<br>Recipients with brand-new empty wallets cannot claim funds or set up trustlines because they have zero native gas tokens (XLM) for network fees. | **Zero-Gas Treasury Sponsorship**<br>The treasury co-signs and sponsors account creation, trustline establishment, and transaction fees (via Stellar fee-bumps). |
| **DEX Slippage & Frontrunning**<br>Traditional AMM route swaps on DEXes introduce heavy slippage, price impact, and frontrunning risks during cross-asset claims. | **Treasury-Backed Atomic Swap**<br>Multi-source pricing oracle (Coinbase + Binance + Kraken index) powers direct atomic swaps against the Treasury desk with zero slippage or pool fees. |
| **Wallet Setup Complexities**<br>Unregistered users need custom instruction sets to build trustlines for assets like USDC and EURC before receiving payments. | **Automated Ledger Reserve Sponsorship**<br>One-click claim dynamically sponsors future ledger reserves on-the-fly (`beginSponsoringFutureReserves`), configuring trustlines automatically. |

---

## 🛠️ Key Architecture Primitives

SwiftClaim operates around two primary payment routes depending on the status of the destination address:

| Scenario | Mode | Flow | Fee Structure |
|---|---|---|---|
| **Active Wallet** | **Direct Send** | Client-to-client transfer through the Soroban contract. | Flat **0.001 USDC equivalent** (paid by sender on top of amount). |
| **Empty/Ghost Wallet** | **SwiftLink (Escrow)** | Lock funds in the vault contract, generate a link, recipient claims. | **1% protocol fee** (clamped to **min $0.50 / max $3.00 USD value**, deducted from principal). |

---

## 🔄 System Workflows

### Flow A: Direct Send (Active Wallets)
This is a standard direct payment optimized for active users. The sender inputs a registered public key and submits a single transaction.

```
[Sender Wallet] ──(Authenticates require_auth)──> [direct_send in Contract]
                                                         │
                                        ┌────────────────┴────────────────┐
                       (Sends Principal)│                                 │(Sends Flat Fee)
                                        ▼                                 ▼
                                [Recipient Wallet]               [Treasury Account]
```

1. Frontend checks the destination key via Horizon. If the account is active, **VeteranSend** is displayed.
2. The user inputs amount and chooses an asset (`USDC` or `EURC`).
3. Frontend queries `/api/transfer/build` to get the live price, calculate the token-denominated fee, and format the attestation.
4. Senders co-sign the built transaction containing the `direct_send` contract call.
5. The signed transaction is sent to `/api/transfer/submit`, which wraps it in a **Fee-Bump Transaction** paid by the Treasury and submits it to the Stellar network.

---

### Flow B: SwiftLink Escrow & Claim (Ghost Wallets)
For empty accounts or unregistered users. Senders lock funds into the contract vault, generating a secure claim link.

```
1. SENDER LOCKS FUNDS:
[Sender Wallet] ──(lock_funds)──> [SwiftVault Contract] (Creates Escrow Record)

2. RECIPIENT CLAIMS (Ghost Wallet Activation + Claim + Swap):
[Claim Page] ──(API: /claim/activate)──> [Horizon: beginSponsoringFutureReserves] (Wallet active, trustlines set)
     │
     ├──(API: /claim/build & /claim/submit)──> [SwiftVault Contract: claim()] (Fee to Treasury, Principal released)
     │
     └──(API: /claim/swap & /claim/swap/submit)──> [Atomic Payments (Target swap at Oracle rate)]
```

#### Step 1: Lock Funds & Generate Link
* Senders input the unregistered public key.
* Senders submit `lock_funds` through the dashboard. The assets are transferred from the sender's wallet directly to the `SwiftVault` smart contract.
* The contract stores a persistent `EscrowRecord` mapped to the recipient's public key.
* Senders copy the generated link: `https://swiftclaim.app/claim?vault=G...`

#### Step 2: Ghost Wallet Activation (Phase 1)
* Recipient opens the link. The frontend checks if the wallet exists. Since it is a ghost account, the UI guides them through a **Gas-Free Activation**.
* The API builds an activation transaction that calls `beginSponsoringFutureReserves` (Treasury), `createAccount` (Receiver), `changeTrust` (for target assets), and `endSponsoringFutureReserves`.
* The receiver co-signs client-side, and the Treasury co-signs as the transaction source (sponsoring the ledger reserves).

#### Step 3: Secure Claim (Phase 2)
* The recipient executes the claim transaction. The contract reads the price attestation from the oracle, computes the sponsoring fee, transfers the fee to the treasury, and releases the principal to the receiver (all in the locked asset).

#### Step 4: Atomic Treasury Swap (Phase 3 - Optional)
* If the user selected a target asset different from the locked asset, an atomic swap is executed. 
* The API builds a transaction with two operations:
  1. Receiver sends locked principal to Treasury.
  2. Treasury sends target asset to Receiver at the live averaged oracle price.
* Treasury signs for the transaction fee and the second payment; the receiver signs for the first payment. The transaction is submitted to Horizon.

---

## 📝 Smart Contract Architecture

The core contract is located at `contracts/swiftvault/src/lib.rs`.

### Custom Errors
* `AlreadyInitialized` (1): The contract has already been configured with a treasury and oracle.
* `TransferBelowMinimum` (2): The USD value of the transfer falls below the $1.00 dust shield.
* `InvalidScaledPrice` (3): The price provided by the oracle attestation is zero or negative.
* `FeeExceedsTotalAmount` (4): The computed protocol fee exceeds the locked escrow amount.
* `EscrowNotFound` (5): No escrow record exists for the calling claimant.
* `TreasuryNotFound` (6): Persistent storage is missing the configured treasury address.

### Data Structures

#### `EscrowRecord`
Represents locked funds stored in the contract.
```rust
pub struct EscrowRecord {
    pub asset: Address,
    pub amount: i128, // in stroops (7 decimals)
}
```

#### `OracleAttestation`
Attested price data containing signature details.
```rust
pub struct OracleAttestation {
    pub asset_code: Bytes,
    pub expiration_timestamp: u64,
    pub scaled_price: i128, // price * 10,000,000
    pub signature: Bytes,
}
```

### Contract Methods

```rust
// Configures the contract's immutable state.
pub fn initialize(env: Env, treasury: Address, oracle_public_key: BytesN<32>) -> Result<(), VaultError>;

// Direct transfer between active wallets with flat 0.001 USDC equivalent fee charged on top.
pub fn direct_send(
    env: Env,
    sender: Address,
    receiver: Address,
    asset: Address,
    principal_amount: i128,
    usdc_address: Address,
    attestation: OracleAttestation,
) -> Result<(), VaultError>;

// Lock sender's assets in the contract to create a new escrow.
pub fn lock_funds(env: Env, sender: Address, receiver: Address, asset: Address, amount: i128);

// Claimant withdraws escrow. Calculates fee (1% clamped $0.50-$3.00 USD), releases remaining principal.
pub fn claim(env: Env, receiver: Address, attestation: OracleAttestation) -> Result<(), VaultError>;
```

---

## 📈 Real-Time Price Oracle Index

To ensure accurate, manipulation-resistant conversion rates without Next.js fetch caching delays, the oracle queries three public price APIs in parallel:

1. **Coinbase API:** Direct `EURC-USDC` trading spot rate.
2. **Binance API:** `EURUSDT` spot ticker rate (acting as a stablecoin proxy).
3. **Kraken API:** `EURCUSDC` last closed trade rate.

* **Pricing Index Logic:** The helper in `src/lib/oracle.ts` averages all successfully completed API price feeds. If one or two APIs are offline, it falls back to the active ones. It logs the individual and combined averaged rates to the server.
* **Attestation Signing:** The oracle signs the computed price using the private key specified in `ORACLE_ADMIN_SECRET`. The smart contract verifies this attestation to enforce the dust shield ($1.00 USD minimum) and calculate protocol fees.

---

## ⚡ API Route References

| Endpoint | Method | Body Parameters | Description |
|---|---|---|---|
| `/api/price` | `GET` | `?asset=EURC` | Returns the current real-time averaged price index and scaled representation. Forced dynamic. |
| `/api/treasury` | `GET` | — | Returns treasury balances in USDC, EURC, and native XLM along with the total USD portfolio value. Forced dynamic. |
| `/api/lock/build` | `POST` | `{ senderPublicKey, receiverPublicKey, assetAddress, amount }` | Simulates and builds the `lock_funds` transaction XDR. |
| `/api/lock/submit` | `POST` | `{ signedXdr }` | Submits the locked funds transaction to the Horizon network. |
| `/api/claim/activate` | `POST` | `{ receiverPublicKey, targetAsset, lockedAssetContractId }` | Builds the sponsored classic activation transaction for ghost wallets. |
| `/api/claim/activate/submit` | `POST` | `{ signedXdr }` | Co-signs and submits the sponsored activation to Horizon. |
| `/api/claim/build` | `POST` | `{ receiverPublicKey, amount, assetCode }` | Simulates the Soroban claim call, generates the oracle attestation signature, and builds the claim transaction. |
| `/api/claim/submit` | `POST` | `{ signedXdr }` | Submits the Soroban claim transaction to Horizon. |
| `/api/claim/swap` | `POST` | `{ receiverPublicKey, sendAmount, lockedAssetCode, targetAssetCode }` | Builds the treasury-backed atomic swap transaction co-signed by the Treasury. |
| `/api/claim/swap/submit` | `POST` | `{ signedXdr }` | Submits the dual-payment atomic swap transaction. |
| `/api/transfer/build` | `POST` | `{ senderPublicKey, receiverPublicKey, amount, assetCode, assetAddress }` | Simulates the `direct_send` call, computes the token-denominated fee, and builds the transaction. |
| `/api/transfer/submit` | `POST` | `{ signedXdr }` | Wraps the direct send transaction in a Treasury-funded fee-bump and submits it. |

---

## 🔑 Environment Variables

To run the Next.js server locally, create a `.env.local` file in the project root:

```env
# SAKQE7... - The private key of the treasury wallet (funds activations, swaps, and fee bumps)
TREASURY_SECRET_KEY=SAKQE7AUFQRGBWWJ6CQ5KS4EQHIOGWOQV2WCZ75YNQNMXRTQHQDQBSZU

# SCACY3... - The private key of the oracle administrative account (signs price attestations)
ORACLE_ADMIN_SECRET=SCACY32UJ7LMAWKESAJ2SXS34DTKIMF7445PHLUSIB3PC7NRG7IF2MVL

# GDJ6CB... - The public key corresponding to the oracle admin (used to verify attestations)
NEXT_PUBLIC_ORACLE_PUBLIC_KEY=GDJ6CBRKMTUW577QUFRLFAPRCCNGASOHVO6Q7T5554UZDDKMYTL4NPU3
```

---

## 📂 Project Directory Layout

```
swiftclaim-stellar/
├── contracts/
│   └── swiftvault/                   # Soroban smart contract source code
│       ├── src/
│       │   └── lib.rs                # Core vault, lock, fee calculation, and direct-send methods
│       └── Cargo.toml                # Rust dependencies and contract specifications
│
├── scripts/
│   └── setup-pool.ts                 # Deprecated pool setup script (replaced by Treasury Swap)
│
├── src/
│   ├── app/                          # Next.js App Router Pages & API Routes
│   │   ├── api/                      # REST API Endpoints
│   │   │   ├── claim/                # Activation, claim building, and swap execution APIs
│   │   │   ├── lock/                 # Building and submitting lock transactions
│   │   │   ├── price/                # Real-time averaged price index endpoint
│   │   │   ├── transfer/             # Direct send building and fee-bump submission
│   │   │   └── treasury/             # Monitoring balances and portfolio values
│   │   │
│   │   ├── claim/
│   │   │   └── page.tsx              # Claims routing page (renders live fee calculations & success receipts)
│   │   │
│   │   ├── dashboard/
│   │   │   └── page.tsx              # Main dashboard wrapper (switches between Send and Lock)
│   │   │
│   │   ├── globals.css               # Global styling, Tailwind imports, resets
│   │   ├── layout.tsx                # App shell provider
│   │   └── page.tsx                  # Landing page
│   │
│   ├── components/                   # React components
│   │   ├── dashboard/
│   │   │   ├── GenerateLink.tsx      # Link generator UI form
│   │   │   └── VeteranSend.tsx       # Direct wallet transfer UI form
│   │   └── layout/
│   │       └── Navbar.tsx            # Navigation header with wallet details
│   │
│   ├── contexts/
│   │   └── WalletContext.tsx         # Connection state management (Stellar Wallets Kit integration)
│   │
│   └── lib/                          # Core helpers & integration code
│       ├── oracle.ts                 # Coinbase, Binance, and Kraken price feed indexing & signing
│       ├── soroban.ts                # Attestation-to-XDR translation serialization utilities
│       ├── stellar.ts                # Horizon and Soroban RPC server clients and asset records
│       └── treasury.ts               # Keypair loading utilities for the treasury account
│
├── tsconfig.json                     # TypeScript target config (configured to ES2022 for BigInt support)
├── package.json                      # Next.js framework and library dependencies
└── README.md                         # Project documentation
```

---

## 📥 Getting Started & Installation

### 1. Prerequisites
Ensure you have the following installed on your machine:
* **Node.js:** version ≥ 18.x
* **Rust & Cargo:** (for building and editing the Soroban contract)
* **Stellar Wallets Kit / Freighter Extension:** Installed in your web browser.

### 2. Install Dependencies
Clone the repository and install the project's JavaScript modules:
```bash
git clone https://github.com/Anurag8500/SwiftClaim-Stellar.git
cd swiftclaim-stellar
npm install
```

### 3. Setup Environment Variables
Configure the local `.env.local` file with the keys specified in the [Environment Variables](#-environment-variables) section.

### 4. Running the Development Server
Launch the development server:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Compiling & Testing Smart Contracts
To build and verify the Rust Soroban contract:
```bash
cd contracts/swiftvault
cargo build --target wasm32-unknown-unknown --release
```

---

## 🔒 Treasury & Security Mechanics

1. **Non-Custodial Escrow:** Senders' locked funds are held entirely inside the compiled WASM contract bytecode on-chain. The treasury cannot unilaterally withdraw escrowed funds without the recipient's signature.
2. **Oracle Verification:** The contract checks the cryptographic signature of the attestation payload using the configured `oracle_public_key` to prevent fake price feeds from manipulating fee thresholds.
3. **Dust Shield:** The protocol enforces a `$1.00 USD` minimum transfer value. Bids/sends below this amount are rejected by both the API validation layers and the smart contract logic (`VaultError::TransferBelowMinimum`).
4. **Periodic Rebalancing:** Since fees are collected as-is (USDC fees are collected in USDC; EURC fees are collected in EURC) and stored directly in the treasury, the treasury periodically executes manual swap rebalancing to maintain correct collateral ratios.

---

<div align="center">

**Built for the Stellar Web3 ecosystem**

*Zero Gas. Instant Settlements. Borderless Value.*

</div>
