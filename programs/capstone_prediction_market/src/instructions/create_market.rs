use anchor_lang::prelude::*;
use anchor_lang::system_program::{Transfer, transfer};
use crate::state::{GlobalState, Market, LPPosition, MarketState};
use crate::errors::ErrorCode;

const MIN_LIQUIDITY: u64 = 1_000_000_000; // 1 SOL in lamports

pub fn create_market(
    ctx: Context<CreateMarket>,
    question: [u8; 200],
    initial_liquidity: u64,
    close_time: i64,
) -> Result<()> {
    // validations
    require!(ctx.accounts.creator.lamports() > 0, ErrorCode::InsufficientBalance);
    require!(initial_liquidity > 0, ErrorCode::InvalidLiquidity);
    require!(initial_liquidity >= MIN_LIQUIDITY, ErrorCode::LiquidityTooLow);
    
    let current_time = Clock::get()?.unix_timestamp;
    require!(close_time > current_time, ErrorCode::InvalidCloseTime);
    
    require!(question[0] != 0, ErrorCode::EmptyQuestion);

    let global_state = &mut ctx.accounts.global_state;
    let market = &mut ctx.accounts.market;
    let lp_position = &mut ctx.accounts.lp_position;

    global_state.market_counter += 1;

    // initialise -> market
    market.market_id = global_state.market_counter;
    market.creator = ctx.accounts.creator.key();
    market.question = question;
    market.state = MarketState::Active;
    
    market.yes_pool = initial_liquidity / 2;
    market.no_pool = initial_liquidity / 2;
    market.total_liquidity = initial_liquidity;
    market.resolver = ctx.accounts.creator.key();
    market.lp_bump = ctx.bumps.lp_position;
    
    market.close_time = close_time;
    market.outcome = None;
    market.payout_ratio = 0;
    market.bump = ctx.bumps.market;
    market.vault_bump = ctx.bumps.market_vault;
    market.resolution_time = None;
    
    // initialize -> LP position
    lp_position.market = market.key();
    lp_position.lp_provider = ctx.accounts.creator.key();
    lp_position.liquidity_provided = initial_liquidity;
    lp_position.fees_earned = 0;
    lp_position.fees_claimed = false;
    lp_position.fees_claimed_amount = 0;
    lp_position.bump = ctx.bumps.lp_position;

    let transfer_accounts = Transfer {
        from: ctx.accounts.creator.to_account_info(),
        to: ctx.accounts.market_vault.to_account_info()
    };

    let cpi_ctx = CpiContext::new(ctx.accounts.system_program.to_account_info(), transfer_accounts);

    transfer(cpi_ctx, initial_liquidity)
}

#[derive(Accounts)]
pub struct CreateMarket<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(mut)]
    pub global_state: Account<'info, GlobalState>,
    
    #[account(
        init,
        payer = creator,
        space = 8 + Market::INIT_SPACE,
        seeds = [b"market", (global_state.market_counter + 1).to_le_bytes().as_ref()],
        bump
    )]
    pub market: Account<'info, Market>,

    #[account(
        init,
        payer = creator,
        space = 8 + LPPosition::INIT_SPACE,
        seeds = [b"lp-position", market.key().as_ref(), creator.key().as_ref()],
        bump
    )]
    pub lp_position: Account<'info, LPPosition>,

    #[account(
        mut,
        seeds = [b"market_vault", market.key().as_ref()],
        bump
    )]
    pub market_vault: SystemAccount<'info>,

    pub system_program: Program<'info, System>,
}
