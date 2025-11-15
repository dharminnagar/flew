use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Insufficient balance to place bet")]
    InsufficientBalance,
    
    #[msg("Market is not in active state")]
    MarketNotActive,
    
    #[msg("Market has closed, no more bets allowed")]
    MarketClosed,
    
    #[msg("Market is still open, cannot resolve yet")]
    MarketStillOpen,
    
    #[msg("Only designated resolver can resolve this market")]
    UnauthorizedResolver,
    
    #[msg("Market has already been resolved")]
    AlreadyResolved,
    
    #[msg("Market has not been resolved yet")]
    NotResolved,
    
    #[msg("Position has already been claimed")]
    AlreadyClaimed,
    
    #[msg("This position is on the losing side")]
    PositionLost,
    
    #[msg("Insufficient vault balance for payout")]
    InsufficientVaultBalance,
    
    #[msg("Integer overflow in calculation")]
    Overflow,
    
    #[msg("Cannot bet on both sides")]
    CannotBetBothSides,
    
    #[msg("No fees to claim")]
    NoFeesToClaim,
    
    #[msg("Initial liquidity must be greater than zero")]
    InvalidLiquidity,
    
    #[msg("Close time must be in the future")]
    InvalidCloseTime,
    
    #[msg("Question cannot be empty")]
    EmptyQuestion,
    
    #[msg("Initial liquidity below minimum required (1 SOL)")]
    LiquidityTooLow,
}