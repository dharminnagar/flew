use anchor_lang::prelude::*;
use anchor_lang::system_program::{Transfer, transfer};
use crate::state::{GlobalState, Market, LPPosition, MarketState};

// TODO: Define the handler function
pub fn create_market(
    ctx: Context<CreateMarket>,
    question: [u8; 200],
    initial_liquidity: u64,
    close_time: i64,
) -> Result<()> {
    // Think about what you need to do:
    // 1. Get mutable references to global_state, market, lp_position
    // 2. Increment market counter
    // 3. Initialize the Market:
    //    - market_id from incremented counter
    //    - question from parameter
    //    - creator = who's calling this?
    //    - resolver = same as creator (for now)
    //    - yes_pool = initial_liquidity / 2
    //    - no_pool = initial_liquidity / 2
    //    - total_liquidity = initial_liquidity
    //    - state = Active
    //    - outcome = None (not resolved yet)
    //    - close_time from parameter
    //    - resolution_time = None
    //    - payout_ratio = 0 (will be calculated on resolution)
    //    - bump from ctx.bumps
    // 4. Initialize the LP Position:
    //    - lp_provider = creator
    //    - market = market's key
    //    - liquidity_provided = initial_liquidity
    //    - fees_earned = 0
    //    - fees_claimed = false
    //    - fees_claimed_amount = 0
    //    - bump from ctx.bumps
    // 5. Transfer SOL from creator to market_vault
    //    Use: system_program::transfer()
    //    Need: CpiContext::new() with Transfer struct

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
