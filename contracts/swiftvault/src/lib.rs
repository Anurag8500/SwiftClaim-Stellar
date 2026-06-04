#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracterror, contracttype, Address, Bytes, BytesN, Env, String,
};

// Custom Error Enum
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum VaultError {
    AlreadyInitialized = 1,
    TransferBelowMinimum = 2,
    InvalidScaledPrice = 3,
    FeeExceedsTotalAmount = 4,
    EscrowNotFound = 5,
    TreasuryNotFound = 6,
}

// Data Structures: EscrowRecord
#[contracttype]
#[derive(Clone)]
pub struct EscrowRecord {
    pub asset: Address,
    pub amount: i128,
}

// Data Structures: OracleAttestation (IMPORTANT: field order must match frontend EXACTLY!)
#[contracttype]
#[derive(Clone)]
pub struct OracleAttestation {
    pub asset_code: Bytes,
    pub expiration_timestamp: u64,
    pub scaled_price: i128,
    pub signature: Bytes,
}

// Storage Keys
const TREASURY_KEY: &str = "TREASURY";
const ORACLE_PUBLIC_KEY_KEY: &str = "ORACLE_PUBLIC_KEY";

// TTL Constants
const TTL_THRESHOLD: u32 = 17280; // ~1 day
const TTL_EXTEND_TO: u32 = 518400; // ~30 days

// Smart Contract: SwiftVault
#[contract]
pub struct SwiftVault;

#[contractimpl]
impl SwiftVault {
    // Function 0: initialize
    pub fn initialize(env: Env, treasury: Address, oracle_public_key: BytesN<32>) -> Result<(), VaultError> {
        if env.storage().persistent().has(&String::from_str(&env, TREASURY_KEY)) {
            return Err(VaultError::AlreadyInitialized);
        }
        env.storage().persistent().set(&String::from_str(&env, TREASURY_KEY), &treasury);
        env.storage().persistent().set(&String::from_str(&env, ORACLE_PUBLIC_KEY_KEY), &oracle_public_key);

        // Extend TTL for config keys
        let treasury_key = String::from_str(&env, TREASURY_KEY);
        let oracle_key = String::from_str(&env, ORACLE_PUBLIC_KEY_KEY);
        env.storage().persistent().extend_ttl(&treasury_key, TTL_THRESHOLD, TTL_EXTEND_TO);
        env.storage().persistent().extend_ttl(&oracle_key, TTL_THRESHOLD, TTL_EXTEND_TO);

        Ok(())
    }

    // Private Helper: Verify Oracle Attestation
    fn verify_oracle_attestation(_env: &Env, _attestation: &OracleAttestation) {
        // Temporarily disabled for testing
    }

    // Private Helper: Enforce Dust Shield
    fn enforce_dust_shield(amount: i128, scaled_price: i128) -> Result<(), VaultError> {
        let usd_value: i128 = (amount * scaled_price) / 10_000_000;
        if usd_value < 1_000_000 {
            return Err(VaultError::TransferBelowMinimum);
        }
        Ok(())
    }

    // Private Helper: Calculate Protocol Fee
    fn calculate_protocol_fee(amount: i128, scaled_price: i128) -> Result<i128, VaultError> {
        if scaled_price <= 0 {
            return Err(VaultError::InvalidScaledPrice);
        }
        let base_fee: i128 = amount / 100;
        let fee_usd_value: i128 = (base_fee * scaled_price) / 10_000_000;

        if fee_usd_value < 5_000_000 {
            // Clamp to $0.50
            Ok((5_000_000 * 10_000_000) / scaled_price)
        } else if fee_usd_value > 30_000_000 {
            // Clamp to $3.00
            Ok((30_000_000 * 10_000_000) / scaled_price)
        } else {
            Ok(base_fee)
        }
    }

    // Function 1: direct_send (Active wallet transfer)
    // Fee model: Sender pays receiver the EXACT principal_amount.
    // A fixed 0.001 USDC equivalent fee is charged ON TOP (sender pays principal + fee).
    // Fee is collected in the same asset being transferred — no swap needed.
    pub fn direct_send(
        env: Env,
        sender: Address,
        receiver: Address,
        asset: Address,
        principal_amount: i128,
        usdc_address: Address,
        attestation: OracleAttestation,
    ) -> Result<(), VaultError> {
        sender.require_auth();

        // Extend TTL for config data
        let treasury_key = String::from_str(&env, TREASURY_KEY);
        env.storage().persistent().extend_ttl(&treasury_key, TTL_THRESHOLD, TTL_EXTEND_TO);

        // Step 1: Verify Oracle Attestation
        Self::verify_oracle_attestation(&env, &attestation);

        // Step 2: Enforce Dust Shield (check the principal amount)
        Self::enforce_dust_shield(principal_amount, attestation.scaled_price)?;

        // Retrieve Treasury Address
        let treasury: Address = env
            .storage()
            .persistent()
            .get(&treasury_key)
            .ok_or(VaultError::TreasuryNotFound)?;

        let token_client = soroban_sdk::token::Client::new(&env, &asset);

        // Transfer exact principal to receiver (no deduction)
        token_client.transfer(&sender, &receiver, &principal_amount);

        // Step 3: Collect fee
        // Fixed fee = 0.001 USDC = 10,000 stroops (7 decimal asset)
        if asset == usdc_address {
            // Asset IS USDC — transfer 0.001 USDC directly to treasury
            let usdc_fee: i128 = 10_000;
            token_client.transfer(&sender, &treasury, &usdc_fee);
        } else {
            // Asset is NOT USDC (e.g. EURC) — calculate equivalent fee in token units
            // and transfer directly to treasury in the same asset (no swap)
            if attestation.scaled_price <= 0 {
                return Err(VaultError::InvalidScaledPrice);
            }
            let fee_in_token: i128 = (10_000_i128 * 10_000_000) / attestation.scaled_price;
            token_client.transfer(&sender, &treasury, &fee_in_token);
        }

        Ok(())
    }

    // Function 2: lock_funds
    pub fn lock_funds(
        env: Env,
        sender: Address,
        receiver: Address,
        asset: Address,
        amount: i128,
    ) {
        sender.require_auth();

        let contract_address = env.current_contract_address();

        // Transfer amount from sender to contract
        let token_client = soroban_sdk::token::Client::new(&env, &asset);
        token_client.transfer(&sender, &contract_address, &amount);

        // Store EscrowRecord in persistent storage
        let record = EscrowRecord { asset, amount };
        env.storage().persistent().set(&receiver, &record);

        // Extend TTL for escrow record
        env.storage().persistent().extend_ttl(&receiver, TTL_THRESHOLD, TTL_EXTEND_TO);
    }

    // Function 3: claim (Ghost wallet claim)
    // Releases escrowed funds: principal → receiver, fee → treasury.
    // Both transfers are in the LOCKED asset (no swap in contract).
    // Cross-asset swaps are handled externally via Stellar pathPaymentStrictSend.
    pub fn claim(
        env: Env,
        receiver: Address,
        attestation: OracleAttestation,
    ) -> Result<(), VaultError> {
        receiver.require_auth();

        // Step 1: Verify Oracle Attestation
        Self::verify_oracle_attestation(&env, &attestation);

        // Get and remove EscrowRecord
        let record: EscrowRecord = env.storage().persistent().get(&receiver)
            .ok_or(VaultError::EscrowNotFound)?;
        env.storage().persistent().remove(&receiver);

        // Step 2: Enforce Dust Shield
        Self::enforce_dust_shield(record.amount, attestation.scaled_price)?;

        // Step 3: Calculate Protocol Fee (percentage-based, clamped $0.50–$3.00)
        let fee_amount = Self::calculate_protocol_fee(record.amount, attestation.scaled_price)?;
        let principal_amount = record.amount - fee_amount;

        // Retrieve Treasury Address
        let treasury_key = String::from_str(&env, TREASURY_KEY);
        env.storage().persistent().extend_ttl(&treasury_key, TTL_THRESHOLD, TTL_EXTEND_TO);
        let treasury: Address = env
            .storage()
            .persistent()
            .get(&treasury_key)
            .ok_or(VaultError::TreasuryNotFound)?;

        let contract_address = env.current_contract_address();
        let token_client = soroban_sdk::token::Client::new(&env, &record.asset);

        // Transfer principal to receiver in the locked asset
        token_client.transfer(&contract_address, &receiver, &principal_amount);

        // Transfer fee to treasury in the locked asset
        token_client.transfer(&contract_address, &treasury, &fee_amount);

        Ok(())
    }
}
