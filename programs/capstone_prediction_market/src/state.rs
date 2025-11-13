use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct GlobalState {
    pub market_counter: u64,
    pub fee_rate: u16,
    pub protocol_treasury: Pubkey,
    pub admin: Pubkey,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Market {
    pub market_id: u64,
    pub question: [u8; 200],         
    pub creator: Pubkey,              
    pub resolver: Pubkey,            
    pub yes_pool: u64,               
    pub no_pool: u64,                
    pub total_liquidity: u64,          
    pub state: MarketState,          
    pub outcome: Option<bool>,         
    pub close_time: i64,              
    pub resolution_time: Option<i64>,
    pub payout_ratio: u64,           
    pub bump: u8,
    pub vault_bump: u8,
    pub lp_bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, InitSpace)]
pub enum MarketState {
    Active,    // Accepting bets
    Closed,    // Past close_time, no more bets
    Resolved,  // Outcome submitted
    Finalized, // All claims processed (optional)
}

#[account]
#[derive(InitSpace)]
pub struct Position {
    pub user: Pubkey,           // Who placed the bet
    pub market: Pubkey,         // Which market
    pub side: bool,             // true = YES, false = NO
    pub amount: u64,            // SOL bet in lamports
    pub entry_odds: u64,        // Odds when bet was placed (for display)
    pub claimed: bool,          // Prevent double-claiming
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct LPPosition {
    pub lp_provider: Pubkey,
    pub market: Pubkey,
    pub liquidity_provided: u64,
    pub fees_earned: u64,
    pub fees_claimed: bool,
    pub fees_claimed_amount: u64,
    pub bump: u8,
}