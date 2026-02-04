# 🏎️ Decentralized Permissionless F1 Prediction Market

> **Built as part of Solana Turbine Builder's Cohort**

A decentralized prediction market platform for Formula 1 races built on Solana, featuring an automated market maker (AMM) with dynamic odds, liquidity provider fees, and a user-friendly Telegram bot interface.

## Overview

F1 Prediction Market allows users to bet on F1 race outcomes using SOL. The platform uses a constant product AMM algorithm to automatically adjust odds based on bet distribution, ensuring fair pricing and deep liquidity. Liquidity providers earn fees from trading activity.

### Key Features

- **Automated Market Maker**: Dynamic odds that adjust based on betting activity
- **Liquidity Provision**: Earn fees by providing initial market liquidity
- **Telegram Bot**: Mobile-first betting interface with Privy embedded wallets
- **Self-Custodial**: Users maintain full control of their funds
- **Real-time Odds**: Live odds calculation based on pool ratios
- **Binary Markets**: Simple YES/NO outcome prediction markets

## Important Links

- **Program ID (Devnet)**: `72jWpfijYJqBf8L69Qw92o7tNKDBDKaiYUziDco7vMZL`
- **Telegram Bot**: [@flew_f1_bot](https://t.me/flew_f1_bot)
- **Solana Explorer**: [View Program](https://explorer.solana.com/address/72jWpfijYJqBf8L69Qw92o7tNKDBDKaiYUziDco7vMZL?cluster=devnet)
- **Network**: Solana Devnet
- **RPC**: `https://api.devnet.solana.com`

## Demo Video

https://github.com/user-attachments/assets/f583a47b-8ccc-4916-bc09-fc72a9038ccd



## Architecture Diagram

### System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        F1 Prediction Market                     │
└─────────────────────────────────────────────────────────────────┘
                                  │
                ┌─────────────────┴─────────────────┐
                │                                   │
        ┌───────▼────────┐                  ┌──────▼──────┐
        │  Telegram Bot  │                  │  Web App    │
        │   Frontend     │                  │  (Future)   │
        └───────┬────────┘                  └──────┬──────┘
                │                                   │
                │    ┌─────────────────────┐       │
                └────►   Privy Wallet API  ◄───────┘
                     │  (MPC Signing)      │
                     └──────────┬──────────┘
                                │
                     ┌──────────▼───────────┐
                     │   Solana Blockchain  │
                     │                      │
                     │  ┌────────────────┐  │
                     │  │ Prediction     │  │
                     │  │ Market Program │  │
                     │  │ (Anchor)       │  │
                     │  └────────────────┘  │
                     │                      │
                     │  State Accounts:     │
                     │  • Global State      │
                     │  • Markets           │
                     │  • Positions         │
                     │  • LP Positions      │
                     │  • Market Vaults     │
                     └──────────────────────┘
```

### Smart Contract Architecture

![Architecture Diagram](./docs/Dharmin_Capstone%20Architecture%20Diagram.png)

### Component Breakdown

#### **Solana Program (Anchor)**
- Written in Rust using Anchor framework v0.32.1
- Manages market creation, betting, resolution, and payouts
- Implements AMM algorithm with protocol fees (2.5%) and LP fees (2.5%)
- Handles all on-chain state and fund custody

#### **Telegram Bot**
- Node.js/TypeScript bot using Telegraf framework
- Privy integration for embedded wallet management
- 11 streamlined commands for betting, market creation, and fund management
- Real-time market data and position tracking

#### **Privy Wallet Management**
- MPC (Multi-Party Computation) for secure key management
- API-based transaction signing
- Self-custodial wallets with enterprise-grade security
- Seamless wallet creation for new users

## AMM Algorithm

The platform uses a constant product AMM formula to calculate odds:

```
Price(YES) = yesPool / (yesPool + noPool)
Price(NO) = noPool / (yesPool + noPool)

Odds(YES) = (yesPool + noPool) / yesPool
Odds(NO) = (yesPool + noPool) / noPool
```

When a user bets:
1. Their bet amount (minus fees) goes into one pool
2. Odds automatically adjust based on new pool ratio
3. Potential payout calculated based on odds at entry

### Fee Structure

- **Protocol Fee**: 2.5% of each bet → Goes to protocol treasury
- **LP Fee**: 2.5% of each bet → Goes to market creator (liquidity provider)
- **Total Fee**: 5% per bet

## Project Structure

```
capstone_prediction_market/
├── programs/
│   └── capstone_prediction_market/
│       └── src/
│           └── lib.rs              # Main Solana program (Anchor)
├── telegram-bot/
│   ├── src/
│   │   ├── index.ts               # Bot commands & handlers
│   │   ├── privy-wallet.ts        # Privy wallet integration
│   │   ├── solana.ts              # Blockchain interactions
│   │   └── utils.ts               # Formatting utilities
│   ├── package.json
│   └── README.md                  # Bot-specific documentation
├── tests/
│   └── capstone_prediction_market.ts  # Anchor tests
├── migrations/
│   └── deploy.ts                  # Deployment script
├── Anchor.toml                    # Anchor configuration
└── README.md                      # This file
```

## Quick Start

### Prerequisites

- Node.js 18+ and npm/yarn
- Rust 1.70+
- Solana CLI 1.18+
- Anchor CLI 0.32.1+

### 1. Clone the Repository

```bash
git clone <repository-url>
cd capstone_prediction_market
```

### 2. Install Dependencies

```bash
# Install Anchor dependencies
npm install

# Install bot dependencies
cd telegram-bot
npm install
cd ..
```

### 3. Build the Program

```bash
anchor build
```

### 4. Deploy to Devnet

```bash
# Configure Solana CLI for devnet
solana config set --url devnet

# Airdrop SOL for deployment
solana airdrop 2

# Deploy the program
anchor deploy
```

### 5. Initialize the Program

The program needs to be initialized once after deployment:

```bash
anchor run init-devnet
```

This creates the global state account and sets up the protocol treasury.

### 6. Setup Telegram Bot

See [telegram-bot/README.md](./telegram-bot/README.md) for detailed bot setup instructions.

Quick setup:
```bash
cd telegram-bot

# Copy environment template
cp .env.example .env

# Edit .env with your credentials:
# - BOT_TOKEN (from @BotFather)
# - PRIVY credentials (from dashboard.privy.io)
# - PROGRAM_ID (from deployment)

# Run the bot
npm run build
npm start
```

## How to Use

### Via Telegram Bot

1. **Start**: Message the bot and use `/start` to create your wallet
2. **Create**: Use `/create` to create new prediction markets
3. **Fund**: Use `/deposit` to get your wallet address and send devnet SOL
4. **Browse**: Use `/markets` to see active prediction markets
5. **Bet**: Click "Bet YES" or "Bet NO" buttons and select amount
6. **Track**: Use `/positions` to view your open positions
7. **Claim**: After market resolution, use `/claim <market_id>` to claim winnings

### Bot Commands

- `/start` - Create wallet and get started
- `/help` - Show all commands
- `/wallet` - View wallet address and balance
- `/deposit` - Get deposit instructions
- `/withdraw` - Send SOL to external wallet
- `/markets` - View active prediction markets
- `/create` - Create a new prediction market
- `/bet` - Place a bet on a market
- `/positions` - View your open positions
- `/claim` - Claim your winnings
- `/resolve` - Resolve a market (creator only)

## Security Features

- **Non-custodial**: Users control their funds via Privy wallets
- **MPC Security**: Private keys split using multi-party computation
- **On-chain Settlement**: All transactions verified on Solana blockchain
- **Time-locks**: Markets can only be resolved after close time
- **Creator Authority**: Only market creator can resolve outcomes
- **Claim-once**: Positions can only be claimed once to prevent double-claims

## Program Instructions

1. **Initialize**: Set up global state and protocol treasury
2. **Create Market**: Create new prediction market with initial liquidity
3. **Place Bet**: Bet on YES or NO outcome
4. **Resolve Market**: Resolve market outcome (creator only, after close time)
5. **Claim Payout**: Claim winnings from resolved market
6. **Claim LP Fees**: Claim accumulated LP fees (creator only)

## Testing

Run the Anchor test suite:

```bash
anchor test
```

The tests cover:
- Market creation with various parameters
- Bet placement and odds calculation
- Market resolution and payout claims
- LP fee accumulation and claims
- Edge cases and error conditions

## Future Enhancements

- [ ] Web app interface with React/Next.js
- [ ] Multi-outcome markets (not just binary YES/NO)
- [ ] Time-weighted LP fees
- [ ] Automated market resolution via oracles
- [ ] Mainnet deployment
- [ ] Market discovery and search
- [ ] Social features (leaderboards, sharing)
- [ ] Advanced charting and analytics
- [ ] Mobile app (iOS/Android)

## Contributing

This project was built as part of the Solana Turbine Builder's Cohort. Contributions, issues, and feature requests are welcome!

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is open source and available under the MIT License.

## Acknowledgments
- **Solana Foundation** for the Turbine Builder's Cohort
- **Anchor Framework** for simplifying Solana development
- **Privy** for secure wallet infrastructure
- **Telegraf** for the Telegram bot framework

## Contact & Support

- **GitHub Issues**: For bug reports and feature requests
- **Telegram**: [@flew_f1_bot](https://t.me/flew_f1_bot) - Try the live bot!
- **Twitter**: [@dharminnagar](https://x.com/dharminnagar) - Follow for updates

---

**Built with ❤️ by [@dharminnagar](https://github.com/dharminnagar) | Powered by Solana ⚡**

**Part of [Solana Turbine Builder's Cohort](https://www.turbine.so/)**
