use anchor_lang::prelude::*;
use anchor_lang::system_program::{Transfer, transfer};

use crate::state::{Market, MarketState, Position};
use crate::errors::ErrorCode;

pub fn claim_payout(
    ctx: Context<ClaimPayout>,
) -> Result<()> {

    let market = &ctx.accounts.market;
    let position = &mut ctx.accounts.position;
    let system_program = &ctx.accounts.system_program;

    let outcome = market.outcome.ok_or(ErrorCode::NotResolved)?;

    require!(market.state == MarketState::Resolved, ErrorCode::NotResolved);
    require!(!position.claimed, ErrorCode::AlreadyClaimed);
    require!(position.side == outcome, ErrorCode::PositionLost);
    
    let (winning_pool, losing_pool) = if outcome {
        (market.yes_pool, market.no_pool)
    } else {
        (market.no_pool, market.yes_pool)
    };

    // Calculate payout using u128 to prevent overflow, then convert back to u64
    let position_amount_u128 = position.amount as u128;
    let losing_pool_u128 = losing_pool as u128;
    let winning_pool_u128 = winning_pool as u128;

    let winner_share_u128 = position_amount_u128
        .checked_mul(losing_pool_u128)
        .ok_or(ErrorCode::Overflow)?
        .checked_div(winning_pool_u128)
        .ok_or(ErrorCode::Overflow)?;
    
    let winner_share = u64::try_from(winner_share_u128)
        .map_err(|_| ErrorCode::Overflow)?;

    let total_payout = position.amount.checked_add(winner_share)
        .ok_or(ErrorCode::Overflow)?;

    let signer_seeds: &[&[&[u8]]] = &[
        &[
            b"market_vault",
            market.to_account_info().key.as_ref(),
            &[market.vault_bump],
        ],
    ];

    let transfer_accounts = Transfer {
        from: ctx.accounts.market_vault.to_account_info(),
        to: ctx.accounts.user.to_account_info(),
    };

    let cpi_ctx = CpiContext::new_with_signer(system_program.to_account_info(), transfer_accounts, signer_seeds);

    transfer(cpi_ctx, total_payout)?;

    position.claimed = true;

    Ok(())
}

#[derive(Accounts)]
pub struct ClaimPayout<'info> {
    #[account(
        seeds = [b"market", &market.market_id.to_le_bytes()],
        bump = market.bump,
    )]
    pub market: Account<'info, Market>,

    #[account(
        mut,
        seeds = [b"position", market.key().as_ref(), user.key().as_ref()],
        bump = position.bump
    )]
    pub position: Account<'info, Position>,

    #[account(
        mut,
        seeds = [b"market_vault", market.key().as_ref()],
        bump = market.vault_bump
    )]
    pub market_vault: SystemAccount<'info>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub system_program: Program<'info, System>,
}