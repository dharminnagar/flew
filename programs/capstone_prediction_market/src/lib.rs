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
    use crate::instructions::{InitializeProtocol, initialize_protocol};

    use super::*;

    pub fn initialize(ctx: Context<InitializeProtocol>, fee_rate: u16) -> Result<()> {
        initialize_protocol(ctx, fee_rate)
    }
}

// #[derive(Accounts)]
// pub struct Initialize {}
