use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};
use crate::state::{GlobalState, Market, Position, LPPosition, MarketState};
use crate::errors::ErrorCode;

// TODO: Write the place_bet handler
pub fn place_bet(
    ctx: Context<PlaceBet>,
    side: bool, 
    amount: u64,
) -> Result<()> {
    
    Ok(())
}

#[derive(Accounts)]
pub struct PlaceBet<'info> {
    #[account(
        seeds = [b"global_state"],
        bump = global_state.bump
    )]
    pub global_state: Account<'info, GlobalState>,
    
    #[account(
        mut,
        seeds = [b"market", &market.market_id.to_le_bytes()],
        bump = market.bump,
    )]
    pub market: Account<'info, Market>,
    
    #[account(
        mut,
        seeds = [b"market_vault", market.key().as_ref()],
        bump = market.vault_bump
    )]
    pub market_vault: SystemAccount<'info>,
    
    #[account(
        init_if_needed,
        payer = user,
        space = 8 + Position::INIT_SPACE,
        seeds = [b"position", market.key().as_ref(), user.key().as_ref()],
        bump
    )]
    pub position: Account<'info, Position>,

    #[account(
        mut,
        seeds = [b"lp-position", market.key().as_ref(), market.creator.as_ref()],
        bump = market.lp_bump
    )]
    pub lp_position: Account<'info, LPPosition>,

    #[account(
        mut,
        address = global_state.protocol_treasury
    )]
    pub protocol_treasury: SystemAccount<'info>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub system_program: Program<'info, System>
}