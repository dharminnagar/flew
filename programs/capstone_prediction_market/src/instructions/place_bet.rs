use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};
use crate::state::{GlobalState, Market, Position, LPPosition, MarketState};
use crate::errors::ErrorCode;

pub fn place_bet(
    ctx: Context<PlaceBet>,
    side: bool,  // true = YES, false = NO
    amount: u64,
) -> Result<()> {
    let market = &mut ctx.accounts.market;
    let global_state = &ctx.accounts.global_state;
    let lp_position = &mut ctx.accounts.lp_position;
    let position = &mut ctx.accounts.position;
    
    let current_time = Clock::get()?;
    
    require!(market.state == MarketState::Active, ErrorCode::MarketNotActive);
    require!(current_time.unix_timestamp < market.close_time, ErrorCode::MarketClosed);
    
    let total_fee = amount
        .checked_mul(global_state.fee_rate as u64)
        .ok_or(ErrorCode::Overflow)?
        .checked_div(10_000)
        .ok_or(ErrorCode::Overflow)?;
    let protocol_fee = total_fee
        .checked_mul(20)
        .ok_or(ErrorCode::Overflow)?
        .checked_div(100)
        .ok_or(ErrorCode::Overflow)?;
    let lp_fee = total_fee
        .checked_mul(80)
        .ok_or(ErrorCode::Overflow)?
        .checked_div(100)
        .ok_or(ErrorCode::Overflow)?;
    let net_bet = amount
        .checked_sub(total_fee)
        .ok_or(ErrorCode::Overflow)?;
    
    let transfer_accounts = Transfer {
        from: ctx.accounts.user.to_account_info(),
        to: ctx.accounts.protocol_treasury.to_account_info(),
    };

    let cpi_ctx = CpiContext::new(ctx.accounts.system_program.to_account_info(), transfer_accounts);

    transfer(cpi_ctx, protocol_fee)?;
    
    let transfer_accounts = Transfer {
        from: ctx.accounts.user.to_account_info(),
        to: ctx.accounts.market_vault.to_account_info(),
    };

    let cpi_ctx = CpiContext::new(ctx.accounts.system_program.to_account_info(), transfer_accounts);

    transfer(cpi_ctx, net_bet)?;


    let entry_odds ;
    let total_pool = market.yes_pool + market.no_pool;
    if side {
        entry_odds = (market.yes_pool.checked_mul(1_000_000_000)
            .ok_or(ErrorCode::Overflow)?)
            .checked_div(total_pool)
            .ok_or(ErrorCode::Overflow)?;
    } else {
        entry_odds = market.no_pool.checked_mul(1_000_000_000)
            .ok_or(ErrorCode::Overflow)?
            .checked_div(total_pool)
            .ok_or(ErrorCode::Overflow)?;
    }
    
    if side {
        market.yes_pool = market.yes_pool.checked_add(net_bet).ok_or(ErrorCode::Overflow)?;
    } else {
        market.no_pool = market.no_pool.checked_add(net_bet).ok_or(ErrorCode::Overflow)?;
    }
    
    market.total_liquidity = market.total_liquidity.checked_add(net_bet).ok_or(ErrorCode::Overflow)?;
    

    lp_position.fees_earned = lp_position.fees_earned.checked_add(lp_fee).ok_or(ErrorCode::Overflow)?;
    
    if position.amount == 0 {
        position.user = ctx.accounts.user.key();
        position.market = market.key();
        position.side = side;
        position.amount = net_bet;
        position.entry_odds = entry_odds;
        position.claimed = false;
        position.bump = ctx.bumps.position;
    } else {
        require!(position.side == side, ErrorCode::CannotBetBothSides);
        position.amount = position.amount.checked_add(net_bet).ok_or(ErrorCode::Overflow)?;
    }
    
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