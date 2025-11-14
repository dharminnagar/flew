use anchor_lang::prelude::*;
use anchor_lang::system_program::{Transfer, transfer};

use crate::state::{LPPosition, Market};
use crate::errors::ErrorCode;

pub fn claim_lp_fees(
    ctx: Context<ClaimLPFees>
) -> Result<()> {
    
    let market = &ctx.accounts.market;
    let lp_position = &mut ctx.accounts.lp_position;
    let system_program = &ctx.accounts.system_program;

    require!(lp_position.fees_earned > 0, ErrorCode::NoFeesToClaim);
    
    let fees_to_claim = lp_position.fees_earned;

    let transfer_accounts = Transfer {
        from: ctx.accounts.market_vault.to_account_info(),
        to: ctx.accounts.creator.to_account_info(),
    };

    let signer_seeds: &[&[&[u8]]] = &[
        &[
            b"market_vault",
            market.to_account_info().key.as_ref(),
            &[market.vault_bump],
        ]
    ];

    let cpi_ctx = CpiContext::new_with_signer(system_program.to_account_info(), transfer_accounts, signer_seeds);

    lp_position.fees_claimed = true;
    lp_position.fees_claimed_amount = lp_position.fees_claimed_amount
        .checked_add(fees_to_claim)
        .ok_or(ErrorCode::Overflow)?;
    lp_position.fees_earned = 0;
    
    transfer(cpi_ctx, fees_to_claim)
}

#[derive(Accounts)]
pub struct ClaimLPFees<'info> {
    #[account(
        seeds = [b"market", &market.market_id.to_le_bytes()],
        bump = market.bump,
    )]
    pub market: Account<'info, Market>,
    
    #[account(
        mut,
        seeds = [b"lp-position", market.key().as_ref(), market.creator.key().as_ref()],
        bump = market.lp_bump,
    )]
    pub lp_position: Account<'info, LPPosition>,

    #[account(
        mut,
        seeds = [b"market_vault", market.key().as_ref()],
        bump = market.vault_bump
    )]
    pub market_vault: SystemAccount<'info>,

    #[account(
        mut,
        address = market.creator
    )]
    pub creator: Signer<'info>,

    pub system_program: Program<'info, System>,
}