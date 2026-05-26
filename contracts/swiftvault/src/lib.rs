#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, Address, Env, Vec,
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

// Smart Contract: SwiftVault
#[contract]
pub struct SwiftVault;

#[contractimpl]
impl SwiftVault {
    // Function 1: direct_send
    pub fn direct_send(
        env: Env,
        sender: Address,
        receiver: Address,
        asset: Address,
        total_amount: i128,
        fee_amount: i128,
        treasury: Address,
    ) {
        sender.require_auth();

        let principal = total_amount - fee_amount;

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
        treasury: Address,
        fee_amount: i128,
        min_principal_out: i128,
        min_fee_out: i128,
        deadline: u64,
    ) {
        receiver.require_auth();

        // Get and remove EscrowRecord
        let record: EscrowRecord = env.storage().persistent().get(&receiver).unwrap();
        env.storage().persistent().remove(&receiver);

        let principal_amount = record.amount - fee_amount;

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
