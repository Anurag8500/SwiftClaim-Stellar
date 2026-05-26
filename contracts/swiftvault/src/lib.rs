#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, Address, Bytes, BytesN, Env, String, Vec,
};

// External Interfaces: SoroswapRouter
#[soroban_sdk::contractclient(name = "SoroswapRouterClient")]
pub trait SoroswapRouterTrait {
    fn swap_exact_tokens_for_tokens(
        env: Env,
        amount_in: i128,
        amount_out_min: i128,
        path: Vec<Address>,
        to: Address,
        deadline: u64,
    ) -> Vec<i128>;
}

// Data Structures: EscrowRecord
#[contracttype]
#[derive(Clone)]
pub struct EscrowRecord {
    pub asset: Address,
    pub amount: i128,
}

// Data Structures: OracleAttestation
#[contracttype]
#[derive(Clone)]
pub struct OracleAttestation {
    pub asset_code: Bytes,
    pub scaled_price: i128,
    pub expiration_timestamp: u64,
    pub signature: BytesN<64>,
}

// Storage Keys
const TREASURY_KEY: &str = "TREASURY";
const ORACLE_PUBLIC_KEY_KEY: &str = "ORACLE_PUBLIC_KEY";

// Smart Contract: SwiftVault
#[contract]
pub struct SwiftVault;

#[contractimpl]
impl SwiftVault {
    // Function 0: initialize
    pub fn initialize(env: Env, treasury: Address, oracle_public_key: BytesN<32>) {
        if env.storage().persistent().has(&String::from_str(&env, TREASURY_KEY)) {
            panic!("Contract is already initialized");
        }
        env.storage().persistent().set(&String::from_str(&env, TREASURY_KEY), &treasury);
        env.storage().persistent().set(&String::from_str(&env, ORACLE_PUBLIC_KEY_KEY), &oracle_public_key);
    }

    // Private Helper: Verify Oracle Attestation
    fn verify_oracle_attestation(env: &Env, attestation: &OracleAttestation) {
        // Time Check
        let current_timestamp = env.ledger().timestamp();
        if current_timestamp > attestation.expiration_timestamp {
            panic!("Signature Expired");
        }

        // Retrieve Oracle Public Key from Storage
        let oracle_public_key: BytesN<32> = env
            .storage()
            .persistent()
            .get(&String::from_str(env, ORACLE_PUBLIC_KEY_KEY))
            .unwrap();

        // Reconstruct Raw Payload
        let mut payload = soroban_sdk::Bytes::new(env);
        payload.append(&attestation.asset_code);
        
        // Append scaled_price as 16-byte Big-Endian
        let price_bytes = attestation.scaled_price.to_be_bytes();
        payload.extend_from_slice(&price_bytes);
        
        // Append expiration_timestamp as 8-byte Big-Endian
        let time_bytes = attestation.expiration_timestamp.to_be_bytes();
        payload.extend_from_slice(&time_bytes);

        // Verify Signature (No Pre-hashing)
        env.crypto().ed25519_verify(
            &oracle_public_key,
            &payload,
            &attestation.signature,
        );
    }

    // Private Helper: Enforce Dust Shield
    fn enforce_dust_shield(amount: i128, scaled_price: i128) {
        let usd_value: i128 = (amount * scaled_price) / 10_000_000;
        if usd_value < 1_000_000 {
            panic!("Transfer under $1.00 minimum");
        }
    }

    // Private Helper: Calculate Protocol Fee
    fn calculate_protocol_fee(amount: i128, scaled_price: i128) -> i128 {
        let base_fee: i128 = amount / 100;
        let fee_usd_value: i128 = (base_fee * scaled_price) / 10_000_000;

        if fee_usd_value < 5_000_000 {
            // Clamp to $0.50
            (5_000_000 * 10_000_000) / scaled_price
        } else if fee_usd_value > 30_000_000 {
            // Clamp to $3.00
            (30_000_000 * 10_000_000) / scaled_price
        } else {
            base_fee
        }
    }

    // Function 1: direct_send
    pub fn direct_send(
        env: Env,
        sender: Address,
        receiver: Address,
        asset: Address,
        total_amount: i128,
        attestation: OracleAttestation,
    ) {
        sender.require_auth();

        // Step 1: Verify Oracle Attestation
        Self::verify_oracle_attestation(&env, &attestation);

        // Step 2: Enforce Dust Shield
        Self::enforce_dust_shield(total_amount, attestation.scaled_price);

        // Step 3: Calculate Protocol Fee
        let fee_amount = Self::calculate_protocol_fee(total_amount, attestation.scaled_price);
        let principal = total_amount - fee_amount;

        // Retrieve Treasury Address
        let treasury: Address = env
            .storage()
            .persistent()
            .get(&String::from_str(&env, TREASURY_KEY))
            .unwrap();

        // Transfer fee to treasury
        let token_client = soroban_sdk::token::Client::new(&env, &asset);
        token_client.transfer(&sender, &treasury, &fee_amount);

        // Transfer principal to receiver
        token_client.transfer(&sender, &receiver, &principal);
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
    }

    // Function 3: claim_and_swap
    pub fn claim_and_swap(
        env: Env,
        receiver: Address,
        router_address: Address,
        usdc_address: Address,
        target_asset: Address,
        min_principal_out: i128,
        min_fee_out: i128,
        deadline: u64,
        attestation: OracleAttestation,
    ) {
        receiver.require_auth();

        // Step 1: Verify Oracle Attestation
        Self::verify_oracle_attestation(&env, &attestation);

        // Get and remove EscrowRecord
        let record: EscrowRecord = env.storage().persistent().get(&receiver).unwrap();
        env.storage().persistent().remove(&receiver);

        // Step 2: Enforce Dust Shield
        Self::enforce_dust_shield(record.amount, attestation.scaled_price);

        // Step 3: Calculate Protocol Fee
        let fee_amount = Self::calculate_protocol_fee(record.amount, attestation.scaled_price);
        let principal_amount = record.amount - fee_amount;

        // Retrieve Treasury Address
        let treasury: Address = env
            .storage()
            .persistent()
            .get(&String::from_str(&env, TREASURY_KEY))
            .unwrap();

        let contract_address = env.current_contract_address();
        let token_client = soroban_sdk::token::Client::new(&env, &record.asset);

        // Approve router to spend record.amount
        let ledger_sequence = env.ledger().sequence();
        token_client.approve(
            &contract_address,
            &router_address,
            &record.amount,
            &(ledger_sequence + 1000),
        );

        // Swap 1: Principal
        if record.asset != target_asset {
            let path = Vec::from_array(&env, [record.asset.clone(), target_asset.clone()]);
            let router_client = SoroswapRouterClient::new(&env, &router_address);
            router_client.swap_exact_tokens_for_tokens(
                &principal_amount,
                &min_principal_out,
                &path,
                &receiver,
                &deadline,
            );
        } else {
            token_client.transfer(&contract_address, &receiver, &principal_amount);
        }

        // Swap 2: Fee
        if record.asset != usdc_address {
            let path = Vec::from_array(&env, [record.asset.clone(), usdc_address.clone()]);
            let router_client = SoroswapRouterClient::new(&env, &router_address);
            router_client.swap_exact_tokens_for_tokens(
                &fee_amount,
                &min_fee_out,
                &path,
                &treasury,
                &deadline,
            );
        } else {
            token_client.transfer(&contract_address, &treasury, &fee_amount);
        }
    }
}
