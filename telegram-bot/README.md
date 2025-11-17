# 🏎️ F1 Prediction Market - Telegram Bot

A Telegram bot frontend for the F1 Prediction Market built on Solana. This bot provides a mobile-first, user-friendly interface for betting on F1 race outcomes without requiring users to understand crypto wallets or blockchain technology.

## Features

- **Privy Embedded Wallets**: Self-custodial wallets powered by Privy.io, created automatically for each user
- **Easy Betting**: Simple inline buttons to place bets with SOL
- **Market Discovery**: Browse active prediction markets
- **Position Tracking**: View all your open positions
- **Claim Rewards**: Easily claim winnings from resolved markets
- **Market Creation**: Create your own prediction markets
- **Secure Signing**: All transactions signed via Privy's secure API

## Architecture

```
telegram-bot/
├── src/
│   ├── index.ts           # Main bot logic & Telegram commands
│   ├── privy-wallet.ts    # Privy wallet management & API integration
│   ├── solana.ts          # Solana/Anchor program integration
│   ├── utils.ts           # Formatting utilities
│   └── idl.json           # Anchor program IDL
├── wallets/  # User ID to Privy wallet mappings (auto-generated)
└── .env                   # Configuration (includes Privy credentials)
```

## Setup

### 1. Install Dependencies

```bash
cd telegram-bot
npm install
```

### 2. Create a Telegram Bot

1. Open Telegram and message [@BotFather](https://t.me/BotFather)
2. Send `/newbot` and follow the prompts
3. Choose a name (e.g., "F1 Prediction Market")
4. Choose a username (e.g., "f1_prediction_bot")
5. Copy the bot token (looks like `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)

### 3. Configure Environment

Create a `.env` file:

```bash
cp .env.example .env
```

Edit `.env` and add:
- `BOT_TOKEN`: Your bot token from BotFather
- `ADMIN_TELEGRAM_ID`: Your Telegram user ID (get from [@userinfobot](https://t.me/userinfobot))
- `PRIVY_APP_ID`: Your Privy App ID from [dashboard.privy.io](https://dashboard.privy.io)
- `PRIVY_APP_SECRET`: Your Privy App Secret
- `PRIVY_AUTHORIZATION_PRIVATE_KEY`: Your Privy authorization private key (wallet-auth format)

### 4. Deploy the Solana Program (if not already deployed)

```bash
cd ..  # Back to project root
anchor build
anchor deploy --provider.cluster devnet
```

Update `PROGRAM_ID` in `.env` if it changed.

### 5. Get Privy Credentials

If you haven't already:

1. Go to [dashboard.privy.io](https://dashboard.privy.io) and sign in
2. Select your app or create a new one
3. Go to Settings → Wallet Configurations
4. Ensure "Solana" is enabled
5. Copy your App ID, App Secret, and Authorization Private Key
6. Verify these are correctly set in your `.env` file

### 6. Initialize the Program

The program needs to be initialized once:

```bash
# Use the test script or manually call initialize
anchor run init-devnet
```

### 7. Run the Bot

Development mode (with auto-reload):
```bash
npm run dev
```****

Production mode:
```bash
npm run build
npm start
```

## Bot Commands

### Wallet Commands
- `/start` - Create your Privy wallet and get started
- `/wallet` - View wallet address and balance
- `/deposit` - Get deposit instructions
- `/withdraw <address> <amount>` - Send SOL to an external wallet

### Market Commands
- `/markets` - View all active prediction markets
- `/create` - Create a new prediction market

### Betting Commands
- `/bet <id> <yes/no> <amount>` - Place a bet on a market
- `/positions` - View your positions and LP rewards
- `/claim <id>` - Claim winnings or LP fees

### Resolution Commands
- `/resolve <id> <yes/no>` - Resolve a market (creator only)

### Info Commands
- `/help` - Show all commands

## Usage Examples

### Creating a Market

```
/create Will Max Verstappen win Monaco GP 2025? | 2 | 48
```

This creates a market with:
- Question: "Will Max Verstappen win Monaco GP 2025?"
- Initial liquidity: 2 SOL
- Closes in 48 hours

### Placing a Bet

1. Use `/markets` to see available markets
2. Click "Bet YES" or "Bet NO" button
3. Select amount (0.5, 1, 2, 5, or 10 SOL)
4. Confirm transaction

### Claiming Winnings

1. Use `/positions` to see your positions
2. Wait for market to be resolved
3. Use `/claim <market_id>` to claim your payout

## Development

### File Structure

**index.ts** - Main bot controller
- Command handlers (`/start`, `/wallet`, `/markets`, etc.)
- Callback handlers (inline button clicks)
- User interaction flow

**privy-wallet.ts** - Privy wallet management
- Create wallets via Privy API
- Sign transactions via Privy API
- User-to-wallet mapping persistence
- Secure key management through Privy

**solana.ts** - Blockchain integration
- Anchor program wrapper
- PDA derivation
- Transaction building with Privy signing
- All methods accept `userId` instead of keypairs

**utils.ts** - Formatting helpers
- Convert lamports to SOL
- Format market data
- Format positions

### Adding New Commands

1. Add command handler in `setupCommands()`:
```typescript
this.bot.command('mycommand', async (ctx) => {
  // Your logic here
});
```

2. Add to help text in `/help` command

3. Implement the handler function

### Error Handling

All blockchain operations are wrapped in try-catch blocks. Errors are logged to console and user-friendly messages are sent to Telegram.

## Security Considerations

### Current Implementation (Privy Integration)
- ✅ Self-custodial wallets (users control via Privy)
- ✅ Private keys managed securely by Privy infrastructure
- ✅ API-based transaction signing (keys never exposed to bot server)
- ✅ Enterprise-grade key management
- ✅ Users can claim wallets in web app for direct access

### Production Recommendations
- 🔐 Implement rate limiting on commands
- 🔐 Monitor for suspicious activity
- 🔐 Add transaction amount limits
- 🔐 Implement withdrawal confirmations for large amounts
- 🔐 Regular security audits of Privy integration

## Troubleshooting

### Bot doesn't respond
- Check `BOT_TOKEN` is correct in `.env`
- Ensure bot is running (`npm run dev`)
- Check console for error messages

### Transactions fail
- Check wallet has sufficient balance
- Verify `PROGRAM_ID` matches deployed program
- Ensure program is initialized
- Check Solana RPC is responsive

### Markets not showing
- Verify program is deployed on devnet
- Check at least one market exists
- Use Solana Explorer to verify program state

## Testing

### Get Devnet SOL

Use the Solana faucet to get devnet SOL:

```bash
# Get your wallet address from /wallet command
solana airdrop 2 <YOUR_WALLET_ADDRESS> --url devnet
```

Or use the [Solana Faucet](https://faucet.solana.com/)

### Test Flow

1. Create wallet with `/start`
2. Get devnet SOL (airdrop)
3. Create a test market with `/create`
4. Place bets with different accounts
5. Wait for market to close
6. Resolve market (as resolver)
7. Claim payouts with `/claim`

## Deployment

### Heroku

```bash
heroku create f1-prediction-bot
heroku config:set BOT_TOKEN=your_token
heroku config:set PROGRAM_ID=your_program_id
git push heroku main
```

### Docker

```bash
docker build -t f1-prediction-bot .
docker run -d --env-file .env f1-prediction-bot
```

### VPS (Ubuntu)

```bash
# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Clone and setup
git clone <your-repo>
cd telegram-bot
npm install
npm run build

# Use PM2 for process management
npm install -g pm2
pm2 start dist/index.js --name f1-bot
pm2 save
pm2 startup
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For issues or questions:
- Open an issue on GitHub
- Contact [@your_telegram] on Telegram
- Email: your@email.com

---

Built with ❤️ for F1 fans | Powered by Solana ⚡
