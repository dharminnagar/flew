use anchor_lang::prelude::*;
use crate::state::GlobalState;

pub fn initialize_protocol(ctx: Context<InitializeProtocol>, fee_rate: u16) -> Result<()> {
    let global_state = &mut ctx.accounts.global_state;
    global_state.market_counter = 0;
    global_state.fee_rate = fee_rate;
    global_state.protocol_treasury = ctx.accounts.protocol_treasury.key();
    global_state.admin = ctx.accounts.admin.key();
    
    global_state.bump = ctx.bumps.global_state;
    
    Ok(())
}


#[derive(Accounts)]
pub struct InitializeProtocol<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    
    #[account(
        init,
        payer = admin,
        space = 8 + GlobalState::INIT_SPACE,
        seeds = [b"global_state"],
        bump
    )]
    pub global_state: Account<'info, GlobalState>,

    /// CHECK: This account is not read or written, just stored as the treasury address
    pub protocol_treasury: SystemAccount<'info>,
    
    pub system_program: Program<'info, System>,
}