#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracterror, contracttype,
    Address, Bytes, BytesN, Env, Vec,
};

// ─── Error Enum ────────────────────────────────────────────────────────────
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
    AttestationExpired = 7,
    NoAttestationForAsset = 8,
}

// ─── Storage Keys ───────────────────────────────────────────────────────────
// Using a typed enum for all persistent storage keys.
// BREAKING CHANGE from v1: VaultCount + Vault replace the old receiver-address key.
#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Treasury,                    // → Address
    OraclePublicKey,             // → BytesN<32>
    VaultCount(Address),         // receiver → u32
    Vault(Address, u32),         // (receiver, index) → EscrowRecord
}

// ─── Data Structures ────────────────────────────────────────────────────────
#[contracttype]
#[derive(Clone)]
pub struct EscrowRecord {
    pub asset: Address,      // token contract ID
    pub asset_code: Bytes,   // e.g. b"USDC" or b"EURC"
    pub amount: i128,        // in stroops (7-decimal asset)
}

// IMPORTANT: field order must be lexicographic so it matches frontend XDR serialization
#[contracttype]
#[derive(Clone)]
pub struct OracleAttestation {
    pub asset_code: Bytes,
    pub expiration_timestamp: u64,
    pub scaled_price: i128,
    pub signature: Bytes,
}

// ─── Domain Separator ───────────────────────────────────────────────────────
// Must match the constant in src/lib/oracle.ts → signPriceData exactly.
const DOMAIN_SEPARATOR: &[u8] = b"SwiftClaim:OracleAttestation:v1:";

// ─── TTL Constants ─────────────────────────────────────────────────────────
const TTL_THRESHOLD: u32 = 17280;   // ~1 day in ledgers
const TTL_EXTEND_TO: u32 = 518400;  // ~30 days in ledgers

// ─── Contract ───────────────────────────────────────────────────────────────
#[contract]
pub struct SwiftVault;

#[contractimpl]
impl SwiftVault {

    // ── Function 0: initialize ──────────────────────────────────────────────
    pub fn initialize(
        env: Env,
        treasury: Address,
        oracle_public_key: BytesN<32>,
    ) -> Result<(), VaultError> {
        if env.storage().persistent().has(&DataKey::Treasury) {
            return Err(VaultError::AlreadyInitialized);
        }
        env.storage().persistent().set(&DataKey::Treasury, &treasury);
        env.storage().persistent().set(&DataKey::OraclePublicKey, &oracle_public_key);
        env.storage().persistent().extend_ttl(&DataKey::Treasury, TTL_THRESHOLD, TTL_EXTEND_TO);
        env.storage().persistent().extend_ttl(&DataKey::OraclePublicKey, TTL_THRESHOLD, TTL_EXTEND_TO);
        Ok(())
    }

    // ── Private: Verify Oracle Attestation (signature + expiry) ────────────
    fn verify_oracle_attestation(env: &Env, attestation: &OracleAttestation) -> Result<(), VaultError> {
        // 1. Check expiry first — cheap, fail-fast
        if attestation.expiration_timestamp <= env.ledger().timestamp() {
            return Err(VaultError::AttestationExpired);
        }

        // 2. Load stored oracle public key
        let oracle_public_key: BytesN<32> = env
            .storage()
            .persistent()
            .get(&DataKey::OraclePublicKey)
            .unwrap_or_else(|| panic!("Oracle public key not initialized"));

        // 3. Reconstruct the signed message buffer.
        //    Layout: DOMAIN_SEPARATOR || asset_code || scaled_price(16B) || expiration(8B)
        //    Must match oracle.ts → signPriceData exactly.
        let mut message = Bytes::new(env);

        // Domain separator prefix
        for &byte in DOMAIN_SEPARATOR.iter() {
            message.push_back(byte);
        }

        // Asset code (UTF-8 bytes of "USDC" or "EURC")
        message.append(&attestation.asset_code);

        // scaled_price as 16-byte big-endian i128.
        // JS writes: priceView.setBigInt64(8, BigInt(scaledPrice), false)
        // → bytes 0–7 are 0x00, bytes 8–15 are the i64 value (big-endian).
        let price_high: i64 = (attestation.scaled_price >> 64) as i64; // zero for normal prices
        let price_low: i64 = attestation.scaled_price as i64;
        // High 8 bytes
        message.push_back(((price_high >> 56) & 0xFF) as u8);
        message.push_back(((price_high >> 48) & 0xFF) as u8);
        message.push_back(((price_high >> 40) & 0xFF) as u8);
        message.push_back(((price_high >> 32) & 0xFF) as u8);
        message.push_back(((price_high >> 24) & 0xFF) as u8);
        message.push_back(((price_high >> 16) & 0xFF) as u8);
        message.push_back(((price_high >> 8) & 0xFF) as u8);
        message.push_back((price_high & 0xFF) as u8);
        // Low 8 bytes
        message.push_back(((price_low >> 56) & 0xFF) as u8);
        message.push_back(((price_low >> 48) & 0xFF) as u8);
        message.push_back(((price_low >> 40) & 0xFF) as u8);
        message.push_back(((price_low >> 32) & 0xFF) as u8);
        message.push_back(((price_low >> 24) & 0xFF) as u8);
        message.push_back(((price_low >> 16) & 0xFF) as u8);
        message.push_back(((price_low >> 8) & 0xFF) as u8);
        message.push_back((price_low & 0xFF) as u8);

        // expiration_timestamp as 8-byte big-endian u64
        let ts = attestation.expiration_timestamp;
        message.push_back(((ts >> 56) & 0xFF) as u8);
        message.push_back(((ts >> 48) & 0xFF) as u8);
        message.push_back(((ts >> 40) & 0xFF) as u8);
        message.push_back(((ts >> 32) & 0xFF) as u8);
        message.push_back(((ts >> 24) & 0xFF) as u8);
        message.push_back(((ts >> 16) & 0xFF) as u8);
        message.push_back(((ts >> 8) & 0xFF) as u8);
        message.push_back((ts & 0xFF) as u8);

        // 4. Convert Bytes signature → BytesN<64>, then verify Ed25519.
        //    env.crypto().ed25519_verify panics (traps) if invalid — expected behavior.
        let sig: BytesN<64> = BytesN::try_from(attestation.signature.clone())
            .unwrap_or_else(|_| panic!("Invalid signature length"));
        env.crypto().ed25519_verify(&oracle_public_key, &message, &sig);

        Ok(())
    }

    // ── Private: Enforce $1 USD minimum (dust shield) ────────────────────────
    fn enforce_dust_shield(amount: i128, scaled_price: i128) -> Result<(), VaultError> {
        let usd_value: i128 = (amount * scaled_price) / 10_000_000;
        if usd_value < 1_000_000 {
            return Err(VaultError::TransferBelowMinimum);
        }
        Ok(())
    }


    // ── Function 1: direct_send (active-wallet transfer) ────────────────────
    // Fee model: sender pays receiver the EXACT principal_amount.
    // A fixed 0.001 USDC equivalent fee is charged ON TOP from sender → treasury.
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

        env.storage().persistent().extend_ttl(&DataKey::Treasury, TTL_THRESHOLD, TTL_EXTEND_TO);

        // Verify oracle and dust shield
        Self::verify_oracle_attestation(&env, &attestation)?;
        Self::enforce_dust_shield(principal_amount, attestation.scaled_price)?;

        let treasury: Address = env
            .storage()
            .persistent()
            .get(&DataKey::Treasury)
            .ok_or(VaultError::TreasuryNotFound)?;

        let token_client = soroban_sdk::token::Client::new(&env, &asset);

        // Transfer exact principal to receiver (no deduction)
        token_client.transfer(&sender, &receiver, &principal_amount);

        // Collect fixed fee: 0.001 USDC or equivalent in locked asset
        if asset == usdc_address {
            let usdc_fee: i128 = 10_000; // 0.001 USDC in stroops
            token_client.transfer(&sender, &treasury, &usdc_fee);
        } else {
            if attestation.scaled_price <= 0 {
                return Err(VaultError::InvalidScaledPrice);
            }
            let fee_in_token: i128 = (10_000_i128 * 10_000_000) / attestation.scaled_price;
            token_client.transfer(&sender, &treasury, &fee_in_token);
        }

        Ok(())
    }

    // ── Function 2: lock_funds ───────────────────────────────────────────────
    // Stores a NEW deposit at the next available slot for this receiver.
    // Multiple senders can deposit to the same receiver independently.
    // Returns the vault index (used internally; claim link stays receiver pubkey).
    pub fn lock_funds(
        env: Env,
        sender: Address,
        receiver: Address,
        asset: Address,
        asset_code: Bytes,   // UTF-8 bytes of "USDC" or "EURC"
        amount: i128,
    ) -> u32 {
        sender.require_auth();

        let contract_address = env.current_contract_address();
        let token_client = soroban_sdk::token::Client::new(&env, &asset);
        token_client.transfer(&sender, &contract_address, &amount);

        // Get current vault count for this receiver (default 0)
        let count_key = DataKey::VaultCount(receiver.clone());
        let current_count: u32 = env
            .storage()
            .persistent()
            .get(&count_key)
            .unwrap_or(0u32);

        // Store deposit at the next available index
        let vault_key = DataKey::Vault(receiver.clone(), current_count);
        let record = EscrowRecord { asset, asset_code, amount };
        env.storage().persistent().set(&vault_key, &record);
        env.storage().persistent().extend_ttl(&vault_key, TTL_THRESHOLD, TTL_EXTEND_TO);

        // Increment count
        let new_count = current_count + 1;
        env.storage().persistent().set(&count_key, &new_count);
        env.storage().persistent().extend_ttl(&count_key, TTL_THRESHOLD, TTL_EXTEND_TO);

        current_count // return the index used for this deposit
    }

    // ── Function 3: get_vault_count (read-only) ──────────────────────────────
    // Returns the number of pending deposits for a receiver.
    pub fn get_vault_count(env: Env, receiver: Address) -> u32 {
        let count_key = DataKey::VaultCount(receiver);
        env.storage().persistent().get(&count_key).unwrap_or(0u32)
    }

    // ── Function 4: get_vault (read-only) ────────────────────────────────────
    // Returns a single deposit record by index.
    pub fn get_vault(env: Env, receiver: Address, index: u32) -> EscrowRecord {
        let vault_key = DataKey::Vault(receiver, index);
        env.storage()
            .persistent()
            .get(&vault_key)
            .unwrap_or_else(|| panic!("Vault slot not found"))
    }

    // ── Function 5: claim ────────────────────────────────────────────────────
    // Claims ALL pending deposits for the receiver in one atomic call.
    // Each deposit is released in its original locked asset (no swap in contract).
    // attestations: one per unique asset (USDC + EURC). Each deposit finds its
    // matching attestation by asset_code comparison.
    pub fn claim(
        env: Env,
        receiver: Address,
        attestations: Vec<OracleAttestation>,
    ) -> Result<(), VaultError> {
        receiver.require_auth();

        // Verify ALL provided attestations up-front (signature + expiry)
        for i in 0..attestations.len() {
            let att = attestations.get_unchecked(i);
            Self::verify_oracle_attestation(&env, &att)?;
        }

        // Retrieve vault count — must exist
        let count_key = DataKey::VaultCount(receiver.clone());
        let count: u32 = env
            .storage()
            .persistent()
            .get(&count_key)
            .ok_or(VaultError::EscrowNotFound)?;

        if count == 0 {
            return Err(VaultError::EscrowNotFound);
        }

        // Retrieve treasury address
        env.storage().persistent().extend_ttl(&DataKey::Treasury, TTL_THRESHOLD, TTL_EXTEND_TO);
        let treasury: Address = env
            .storage()
            .persistent()
            .get(&DataKey::Treasury)
            .ok_or(VaultError::TreasuryNotFound)?;

        let contract_address = env.current_contract_address();

        // Accumulate total amount per unique asset using existing EscrowRecord struct
        let mut asset_totals: Vec<EscrowRecord> = Vec::new(&env);

        // Read all records, accumulate amounts, and delete storage slots
        for i in 0..count {
            let vault_key = DataKey::Vault(receiver.clone(), i);
            let record: EscrowRecord = env
                .storage()
                .persistent()
                .get(&vault_key)
                .ok_or(VaultError::EscrowNotFound)?;

            let mut found = false;
            for j in 0..asset_totals.len() {
                let mut total_record = asset_totals.get_unchecked(j);
                if total_record.asset == record.asset {
                    total_record.amount += record.amount;
                    asset_totals.set(j, total_record);
                    found = true;
                    break;
                }
            }
            if !found {
                asset_totals.push_back(record);
            }

            // Remove this vault slot
            env.storage().persistent().remove(&vault_key);
        }

        // Remove the vault count key — vault is now fully claimed
        env.storage().persistent().remove(&count_key);

        // Calculate combined total USD value across all assets
        let mut total_usd_value: i128 = 0;
        for i in 0..asset_totals.len() {
            let record = asset_totals.get_unchecked(i);

            // Find matching attestation
            let mut matched_attestation: Option<OracleAttestation> = None;
            for j in 0..attestations.len() {
                let att = attestations.get_unchecked(j);
                if att.asset_code == record.asset_code {
                    matched_attestation = Some(att);
                    break;
                }
            }
            let attestation = matched_attestation.ok_or(VaultError::NoAttestationForAsset)?;
            if attestation.scaled_price <= 0 {
                return Err(VaultError::InvalidScaledPrice);
            }

            let asset_usd = (record.amount * attestation.scaled_price) / 10_000_000;
            total_usd_value += asset_usd;
        }

        // Enforce dust shield ($1.00 USD minimum combined)
        if total_usd_value < 1_000_000 {
            return Err(VaultError::TransferBelowMinimum);
        }

        // Calculate combined protocol fee in USD (1%, clamped $0.50–$3.00)
        let base_fee_usd = total_usd_value / 100;
        let mut total_fee_usd = base_fee_usd;
        if total_fee_usd < 5_000_000 {
            total_fee_usd = 5_000_000; // $0.50 min
        } else if total_fee_usd > 30_000_000 {
            total_fee_usd = 30_000_000; // $3.00 max
        }

        if total_fee_usd > total_usd_value {
            return Err(VaultError::FeeExceedsTotalAmount);
        }

        // Distribute fee and transfer funds for each asset
        for i in 0..asset_totals.len() {
            let record = asset_totals.get_unchecked(i);

            // fee_amount = (record.amount * total_fee_usd) / total_usd_value
            let fee_amount = (record.amount * total_fee_usd) / total_usd_value;
            let principal_amount = record.amount - fee_amount;

            let token_client = soroban_sdk::token::Client::new(&env, &record.asset);

            // Release principal → receiver
            token_client.transfer(&contract_address, &receiver, &principal_amount);

            // Release fee → treasury
            token_client.transfer(&contract_address, &treasury, &fee_amount);
        }

        Ok(())
    }
}
