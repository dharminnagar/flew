use anchor_lang::prelude::*;

use crate::state::{Market, MarketState};
use crate::errors::ErrorCode;


pub fn resolve_market(
    ctx: Context<ResolveMarket>,
    outcome: bool,  // true = YES won, false = NO won
) -> Result<()> {

    let market = &mut ctx.accounts.market;

    let current_time = Clock::get()?;

    require!(market.state == MarketState::Active, ErrorCode::MarketNotActive);
    require!(current_time.unix_timestamp > market.close_time, ErrorCode::MarketStillOpen);

    market.outcome = Some(outcome);

    market.state = MarketState::Resolved;

    Ok(())
}

#[derive(Accounts)]
pub struct ResolveMarket<'info> {
    #[account(
        mut,
        seeds = [b"market", &market.market_id.to_le_bytes()],
        bump = market.bump,
    )]
    pub market: Account<'info, Market>,

    #[account(

        address = market.resolver,
    )]
    pub resolver: Signer<'info>,
}