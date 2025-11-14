use anchor_lang::prelude::*;

pub mod state;
pub mod errors;
pub mod instructions;

use state::*;
use errors::*;
use instructions::*;

declare_id!("72jWpfijYJqBf8L69Qw92o7tNKDBDKaiYUziDco7vMZL");

#[program]
pub mod capstone_prediction_market {
    use super::*;

    pub fn initialize(ctx: Context<InitializeProtocol>, fee_rate: u16) -> Result<()> {
        initialize_protocol(ctx, fee_rate)
    }

    pub fn create_market(
        ctx: Context<CreateMarket>,
        question: [u8; 200],
        initial_liquidity: u64,
        close_time: i64,
    ) -> Result<()> {
        instructions::create_market(ctx, question, initial_liquidity, close_time)
    }

    pub fn place_bet(ctx: Context<PlaceBet>, side: bool, amount: u64) -> Result<()> {
        instructions::place_bet(ctx, side, amount)
    }
}

// #[derive(Accounts)]
// pub struct Initialize {}
