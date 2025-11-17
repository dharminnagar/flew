import { Telegraf, Context, Markup } from 'telegraf';
import { Connection, PublicKey, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { Program, AnchorProvider, Wallet, web3 } from '@coral-xyz/anchor';
import dotenv from 'dotenv';
import { WalletManager } from './wallet';
import { SolanaService } from './solana';
import { formatSOL, formatMarket, formatPosition } from './utils';

dotenv.config();

const BOT_TOKEN = process.env.BOT_TOKEN!;
const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const PROGRAM_ID = process.env.PROGRAM_ID!;

class F1PredictionBot {
  private bot: Telegraf;
  private connection: Connection;
  private walletManager: WalletManager;
  private solanaService: SolanaService;

  constructor() {
    if (!BOT_TOKEN) {
      throw new Error('BOT_TOKEN is not set in .env file');
    }
    
    this.bot = new Telegraf(BOT_TOKEN);
    this.connection = new Connection(RPC_URL, 'confirmed');
    this.walletManager = new WalletManager();
    this.solanaService = new SolanaService(this.connection, PROGRAM_ID);

    this.setupCommands();
    this.setupCallbacks();
    this.setBotCommands();
  }

  private setupCommands() {
    // Start command
    this.bot.start(async (ctx) => {
      try {
        console.log(`📩 /start from user ${ctx.from.id}`);
        const userId = ctx.from.id.toString();
        const username = ctx.from.username || ctx.from.first_name;

        await ctx.reply(
          `🏎️ Welcome to F1 Prediction Market, ${username}! 🏎️\n\n` +
          `Bet on Formula 1 race outcomes with SOL on Solana.\n\n` +
          `Use /help to see all available commands.`
        );

        // Create wallet if doesn't exist
        if (!this.walletManager.hasWallet(userId)) {
          await this.createWallet(ctx, userId);
        }
      } catch (error) {
        console.error('Error in /start:', error);
        await ctx.reply('❌ An error occurred. Please try again.');
      }
    });

    // Help command
    this.bot.help((ctx) => {
      try {
        console.log(`📩 /help from user ${ctx.from.id}`);
        ctx.reply(
          `📖 *F1 Prediction Market Commands*\n\n` +
          `*Wallet:*\n` +
          `/wallet - View your wallet address and balance\n` +
          `/deposit - Get deposit instructions\n` +
          `/export - Export your private key (DM only)\n\n` +
          `*Markets:*\n` +
          `/markets - View active prediction markets\n` +
          `/market <id> - View specific market details\n` +
          `/create - Create a new prediction market\n` +
          `/resolve <id> <yes/no> - Resolve a market (creator only)\n\n` +
          `*Betting:*\n` +
          `/bet <id> <yes/no> <amount> - Place a bet\n` +
          `/positions - View your open positions\n\n` +
          `*Claims:*\n` +
          `/claim <id> - Claim your winnings\n` +
          `/rewards - View claimable LP fees\n` +
          `/claimfees <id> - Claim LP fees (creators)\n\n` +
          `*Info:*\n` +
          `/help - Show this help message\n` +
          `/about - About the platform`,
          { parse_mode: 'Markdown' }
        );
      } catch (error) {
        console.error('Error in /help:', error);
      }
    });

    // Wallet command
    this.bot.command('wallet', async (ctx) => {
      const userId = ctx.from.id.toString();
      
      if (!this.walletManager.hasWallet(userId)) {
        await this.createWallet(ctx, userId);
        return;
      }

      const keypair = this.walletManager.getWallet(userId);
      const balance = await this.connection.getBalance(keypair.publicKey);

      await ctx.reply(
        `💰 *Your Wallet*\n\n` +
        `Address: \`${keypair.publicKey.toString()}\`\n` +
        `Balance: *${formatSOL(balance)}* SOL\n\n` +
        `Use /deposit to add funds`,
        { parse_mode: 'Markdown' }
      );
    });

    // Deposit command
    this.bot.command('deposit', async (ctx) => {
      const userId = ctx.from.id.toString();
      
      if (!this.walletManager.hasWallet(userId)) {
        await ctx.reply('❌ Please use /start first to create your wallet.');
        return;
      }

      const keypair = this.walletManager.getWallet(userId);
      
      await ctx.reply(
        `📥 *Deposit SOL*\n\n` +
        `Send SOL to this address:\n\n` +
        `\`${keypair.publicKey.toString()}\`\n\n` +
        `⚠️ DEVNET ONLY - Use /wallet to check balance`,
        { parse_mode: 'Markdown' }
      );
    });

    // Markets command
    this.bot.command('markets', async (ctx) => {
      await ctx.reply('🔄 Fetching active markets...');
      
      try {
        const markets = await this.solanaService.getActiveMarkets();
        
        if (markets.length === 0) {
          await ctx.reply('📭 No active markets found. Use /create to create one!');
          return;
        }

        for (const market of markets.slice(0, 5)) {
          const buttons = [
            Markup.button.callback('Bet YES ✅', `bet_yes_${market.marketId}`),
            Markup.button.callback('Bet NO ❌', `bet_no_${market.marketId}`),
          ];

          await ctx.reply(
            formatMarket(market),
            {
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: [buttons]
              }
            }
          );
        }

        if (markets.length > 5) {
          await ctx.reply(`... and ${markets.length - 5} more markets`);
        }
      } catch (error) {
        console.error('Error in /markets:', error);
        await ctx.reply('❌ Error fetching markets. Please try again.');
      }
    });

    // Market detail command
    this.bot.command('market', async (ctx) => {
      const args = ctx.message.text.split(' ');
      
      if (args.length < 2) {
        await ctx.reply('Usage: /market <id>\nExample: /market 0');
        return;
      }

      const marketId = parseInt(args[1]);
      if (isNaN(marketId)) {
        await ctx.reply('❌ Invalid market ID. Please provide a number.');
        return;
      }

      await ctx.reply('🔄 Fetching market details...');

      try {
        const market = await this.solanaService.getMarket(marketId);
        
        if (!market) {
          await ctx.reply('❌ Market not found.');
          return;
        }

        const buttons = [
          Markup.button.callback('Bet YES ✅', `bet_yes_${marketId}`),
          Markup.button.callback('Bet NO ❌', `bet_no_${marketId}`),
        ];

        await ctx.reply(
          formatMarket(market),
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [buttons]
            }
          }
        );
      } catch (error) {
        console.error('Error in /market:', error);
        await ctx.reply('❌ Error fetching market. Please try again.');
      }
    });

    // Positions command
    this.bot.command('positions', async (ctx) => {
      const userId = ctx.from.id.toString();
      
      if (!this.walletManager.hasWallet(userId)) {
        await ctx.reply('❌ Please use /start first to create your wallet.');
        return;
      }

      const keypair = this.walletManager.getWallet(userId);
      
      try {
        const positions = await this.solanaService.getUserPositions(keypair.publicKey);
        
        if (positions.length === 0) {
          await ctx.reply('📭 No open positions. Use /markets to place your first bet!');
          return;
        }

        await ctx.reply(`📊 *Your Positions* (${positions.length})\n`, { parse_mode: 'Markdown' });

        for (const position of positions) {
          const market = await this.solanaService.getMarket(position.market.toBase58() as any);
          const marketQuestion = market?.question || 'Unknown market';
          
          await ctx.reply(
            formatPosition(position, marketQuestion),
            { parse_mode: 'Markdown' }
          );
        }
      } catch (error) {
        console.error('Error in /positions:', error);
        await ctx.reply('❌ Error fetching positions. Please try again.');
      }
    });

    // Bet command (standalone)
    this.bot.command('bet', async (ctx) => {
      const userId = ctx.from.id.toString();
      
      if (!this.walletManager.hasWallet(userId)) {
        await ctx.reply('❌ Please use /start first to create your wallet.');
        return;
      }

      const args = ctx.message.text.split(' ').slice(1).join(' ');
      
      if (!args || args.trim().length === 0) {
        await ctx.reply(
          `🎲 *Place a Bet*\n\n` +
          `Format: /bet <market_id> <yes/no> <amount_SOL>\n\n` +
          `Examples:\n` +
          `• /bet 1 yes 2 - Bet 2 SOL on YES for market #1\n` +
          `• /bet 1 no 0.5 - Bet 0.5 SOL on NO for market #1\n\n` +
          `Or use /markets to bet with buttons!`,
          { parse_mode: 'Markdown' }
        );
        return;
      }

      const parts = args.split(' ').filter(p => p.trim().length > 0);
      
      if (parts.length !== 3) {
        await ctx.reply(
          '❌ Invalid format.\n\n' +
          'Use: /bet <market_id> <yes/no> <amount_SOL>\n\n' +
          'Example: /bet 1 yes 2'
        );
        return;
      }

      const [marketIdStr, sideStr, amountStr] = parts;
      const marketId = parseInt(marketIdStr);
      const side = sideStr.toLowerCase();
      const amount = parseFloat(amountStr);

      if (isNaN(marketId)) {
        await ctx.reply('❌ Invalid market ID. Must be a number.');
        return;
      }

      if (side !== 'yes' && side !== 'no') {
        await ctx.reply('❌ Side must be "yes" or "no".');
        return;
      }

      if (isNaN(amount) || amount <= 0) {
        await ctx.reply('❌ Invalid amount. Must be greater than 0.');
        return;
      }

      await ctx.reply('🔄 Placing bet...');

      try {
        const keypair = this.walletManager.getWallet(userId);
        const signature = await this.solanaService.placeBet(
          keypair,
          marketId,
          side === 'yes',
          amount * LAMPORTS_PER_SOL
        );

        await ctx.reply(
          `✅ *Bet Placed!*\n\n` +
          `Market: #${marketId}\n` +
          `Side: ${side === 'yes' ? 'YES ✅' : 'NO ❌'}\n` +
          `Amount: ${amount} SOL\n\n` +
          `TX: \`${signature.slice(0, 20)}...\`\n\n` +
          `View on Solana Explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`,
          { parse_mode: 'Markdown' }
        );
      } catch (error: any) {
        console.error('Error placing bet:', error);
        
        let errorMsg = 'Failed to place bet.';
        
        if (error.message?.includes('insufficient')) {
          errorMsg = '❌ Insufficient balance. Check your wallet balance with /wallet';
        } else if (error.message?.includes('MarketNotActive')) {
          errorMsg = '❌ This market is not active or has been closed.';
        } else {
          errorMsg = `❌ ${error.message || 'Unknown error occurred'}`;
        }
        
        await ctx.reply(errorMsg);
      }
    });

    // Claim command
    this.bot.command('claim', async (ctx) => {
      const userId = ctx.from.id.toString();
      
      if (!this.walletManager.hasWallet(userId)) {
        await ctx.reply('❌ Please use /start first to create your wallet.');
        return;
      }

      const args = ctx.message.text.split(' ');
      
      if (args.length < 2) {
        await ctx.reply(
          'Usage: /claim <market_id>\n\n' +
          'Use /positions to see your claimable positions.'
        );
        return;
      }

      const marketId = parseInt(args[1]);
      if (isNaN(marketId)) {
        await ctx.reply('❌ Invalid market ID. Please provide a number.');
        return;
      }

      await ctx.reply('🔄 Claiming payout...');

      try {
        const keypair = this.walletManager.getWallet(userId);
        const signature = await this.solanaService.claimPayout(keypair, marketId);

        await ctx.reply(
          `✅ *Payout Claimed!*\n\n` +
          `Market: ${marketId}\n` +
          `TX: \`${signature}\`\n\n` +
          `View on Solana Explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`,
          { parse_mode: 'Markdown' }
        );
      } catch (error: any) {
        await ctx.reply(`❌ Failed to claim payout: ${error.message}`);
      }
    });

    // Rewards command - View claimable LP fees
    this.bot.command('rewards', async (ctx) => {
      const userId = ctx.from.id.toString();
      
      if (!this.walletManager.hasWallet(userId)) {
        await ctx.reply('❌ Please use /start first to create your wallet.');
        return;
      }

      await ctx.reply('🔄 Checking your rewards...');

      try {
        const keypair = this.walletManager.getWallet(userId);
        const markets = await this.solanaService.getActiveMarkets();
        
        let rewardsFound = false;
        let totalRewards = 0;

        for (const market of markets) {
          // Check if user is the creator and has unclaimed LP fees
          if (market.creator.toString() === keypair.publicKey.toString()) {
            const [lpPositionPDA] = await this.solanaService['getLPPositionPDA'](market.publicKey, keypair.publicKey);
            
            try {
              const provider = this.solanaService['getProvider'](keypair);
              const program = this.solanaService['getProgram'](provider);
              const lpPosition = await (program.account as any).lpPosition.fetch(lpPositionPDA);
              
              const unclaimedFees = lpPosition.feesEarned.toNumber() - lpPosition.feesClaimedAmount.toNumber();
              
              if (unclaimedFees > 0) {
                rewardsFound = true;
                totalRewards += unclaimedFees;
                
                await ctx.reply(
                  `💰 *Market #${market.marketId}*\n\n` +
                  `Question: ${market.question}\n` +
                  `Unclaimed Fees: *${formatSOL(unclaimedFees)}* SOL\n\n` +
                  `Use: /claimfees ${market.marketId}`,
                  { parse_mode: 'Markdown' }
                );
              }
            } catch (err) {
              // LP position might not exist or other error
              continue;
            }
          }
        }

        if (!rewardsFound) {
          await ctx.reply(
            '📭 No claimable rewards found.\n\n' +
            'Create markets with /create to earn LP fees!'
          );
        } else {
          await ctx.reply(
            `💎 *Total Claimable: ${formatSOL(totalRewards)} SOL*`,
            { parse_mode: 'Markdown' }
          );
        }
      } catch (error: any) {
        console.error('Error checking rewards:', error);
        await ctx.reply('❌ Error checking rewards. Please try again.');
      }
    });

    // Claim LP fees command
    this.bot.command('claimfees', async (ctx) => {
      const userId = ctx.from.id.toString();
      
      if (!this.walletManager.hasWallet(userId)) {
        await ctx.reply('❌ Please use /start first to create your wallet.');
        return;
      }

      const args = ctx.message.text.split(' ');
      
      if (args.length < 2) {
        await ctx.reply(
          'Usage: /claimfees <market_id>\n\n' +
          'Use /rewards to see your claimable LP fees.'
        );
        return;
      }

      const marketId = parseInt(args[1]);
      if (isNaN(marketId)) {
        await ctx.reply('❌ Invalid market ID. Please provide a number.');
        return;
      }

      await ctx.reply('🔄 Claiming LP fees...');

      try {
        const keypair = this.walletManager.getWallet(userId);
        const signature = await this.solanaService.claimLPFees(keypair, marketId);

        await ctx.reply(
          `✅ *LP Fees Claimed!*\n\n` +
          `Market: #${marketId}\n` +
          `TX: \`${signature.slice(0, 20)}...\`\n\n` +
          `View on Solana Explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`,
          { parse_mode: 'Markdown' }
        );
      } catch (error: any) {
        console.error('Error claiming LP fees:', error);
        
        let errorMsg = 'Failed to claim LP fees.';
        
        if (error.message?.includes('NoFeesToClaim')) {
          errorMsg = '❌ No fees available to claim for this market.';
        } else if (error.message?.includes('Unauthorized')) {
          errorMsg = '❌ Only the market creator can claim LP fees.';
        } else {
          errorMsg = `❌ ${error.message || 'Unknown error occurred'}`;
        }
        
        await ctx.reply(errorMsg);
      }
    });

    // Export private key command
    this.bot.command('export', async (ctx) => {
      const userId = ctx.from.id.toString();
      
      if (!this.walletManager.hasWallet(userId)) {
        await ctx.reply('❌ You don\'t have a wallet yet. Use /start to create one.');
        return;
      }

      // Only allow in private messages
      if (ctx.chat.type !== 'private') {
        await ctx.reply('⚠️ For security, this command only works in private messages. Please DM me.');
        return;
      }

      try {
        const privateKey = this.walletManager.exportPrivateKey(userId);
        
        await ctx.reply(
          `🔐 *Your Private Key*\n\n` +
          `\`${privateKey}\`\n\n` +
          `⚠️ *NEVER SHARE THIS WITH ANYONE!*\n` +
          `Store it safely. Anyone with this key can access your wallet.\n\n` +
          `To import in Phantom or other wallets, use this private key.`,
          { parse_mode: 'Markdown' }
        );
      } catch (error) {
        await ctx.reply('❌ Error exporting private key. Please try again.');
      }
    });

    // Create market command
    this.bot.command('create', async (ctx) => {
      const userId = ctx.from.id.toString();
      
      if (!this.walletManager.hasWallet(userId)) {
        await ctx.reply('❌ Please use /start first to create your wallet.');
        return;
      }

      const args = ctx.message.text.split(' ').slice(1).join(' ');
      
      // If no arguments, show instructions
      if (!args || args.trim().length === 0) {
        await ctx.reply(
          `📝 *Create a Prediction Market*\n\n` +
          `Format: /create <question> | <liquidity_SOL> | <hours_until_close>\n\n` +
          `Example:\n` +
          `/create Will Max Verstappen win Monaco GP 2025? | 2 | 48\n\n` +
          `This creates a market with:\n` +
          `• Question: "Will Max Verstappen win Monaco GP 2025?"\n` +
          `• Initial liquidity: 2 SOL\n` +
          `• Closes in: 48 hours\n\n` +
          `⚠️ Minimum liquidity: 1 SOL`,
          { parse_mode: 'Markdown' }
        );
        return;
      }

      // Parse arguments
      const parts = args.split('|').map((p: string) => p.trim());
      
      if (parts.length !== 3) {
        await ctx.reply(
          '❌ Invalid format.\n\n' +
          'Use: /create <question> | <liquidity_SOL> | <hours_until_close>\n\n' +
          'Example: /create Will Hamilton win? | 2 | 24'
        );
        return;
      }

      const [question, liquidityStr, hoursStr] = parts;
      const liquidity = parseFloat(liquidityStr);
      const hours = parseFloat(hoursStr);

      // Validation
      // TODO: update this to 1
      if (isNaN(liquidity) || liquidity < 0.01) {
        await ctx.reply('❌ Liquidity must be at least 1 SOL.');
        return;
      }

      if (isNaN(hours) || hours < 0.1) {
        await ctx.reply('❌ Hours must be at least 0.1 (6 minutes).');
        return;
      }

      if (question.length > 180) {
        await ctx.reply('❌ Question too long. Maximum 180 characters.');
        return;
      }

      if (question.length < 10) {
        await ctx.reply('❌ Question too short. Minimum 10 characters.');
        return;
      }

      await ctx.reply('🔄 Creating market...\nThis may take a few seconds.');

      try {
        const keypair = this.walletManager.getWallet(userId);
        const closeTime = Math.floor(Date.now() / 1000) + Math.floor(hours * 3600);
        
        const result = await this.solanaService.createMarket(
          keypair,
          question,
          liquidity * LAMPORTS_PER_SOL,
          closeTime
        );

        await ctx.reply(
          `✅ *Market Created!*\n\n` +
          `*Market ID:* #${result.marketId}\n` +
          `*Question:* ${question}\n` +
          `*Initial Liquidity:* ${liquidity} SOL\n` +
          `*Closes:* ${new Date(closeTime * 1000).toLocaleString()}\n\n` +
          `TX: \`${result.signature.slice(0, 20)}...\`\n\n` +
          `View on Solana Explorer:\nhttps://explorer.solana.com/tx/${result.signature}?cluster=devnet\n\n` +
          `Users can bet with: /market ${result.marketId}`,
          { parse_mode: 'Markdown' }
        );

        // Also show the market with bet buttons
        const market = await this.solanaService.getMarket(result.marketId);
        if (market) {
          const buttons = [
            Markup.button.callback('Bet YES ✅', `bet_yes_${result.marketId}`),
            Markup.button.callback('Bet NO ❌', `bet_no_${result.marketId}`),
          ];

          await ctx.reply(
            formatMarket(market),
            {
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: [buttons]
              }
            }
          );
        }
      } catch (error: any) {
        console.error('Error creating market:', error);
        
        let errorMsg = 'Failed to create market.';
        
        if (error.message?.includes('insufficient')) {
          errorMsg = '❌ Insufficient balance. You need at least ' + (liquidity + 0.1) + ' SOL to create this market.';
        } else if (error.message?.includes('0x1')) {
          errorMsg = '❌ Program not initialized. Please contact the admin.';
        } else if (error.message?.includes('0x0')) {
          errorMsg = '❌ Transaction failed. Check your balance and try again.';
        } else {
          errorMsg = `❌ ${error.message || 'Unknown error occurred'}`;
        }
        
        await ctx.reply(errorMsg);
      }
    });

    // Resolve market command
    this.bot.command('resolve', async (ctx) => {
      const userId = ctx.from.id.toString();
      
      if (!this.walletManager.hasWallet(userId)) {
        await ctx.reply('❌ Please use /start first to create your wallet.');
        return;
      }

      const args = ctx.message.text.split(' ').slice(1);
      
      if (args.length < 2) {
        await ctx.reply(
          '📝 *Resolve a Market*\n\n' +
          'Format: /resolve <market_id> <outcome>\n\n' +
          'Examples:\n' +
          '• /resolve 1 yes - Resolve market #1 as YES\n' +
          '• /resolve 1 no - Resolve market #1 as NO\n\n' +
          '⚠️ Only the market creator can resolve their market.\n' +
          '⚠️ Market must be past its close time.',
          { parse_mode: 'Markdown' }
        );
        return;
      }

      const marketId = parseInt(args[0]);
      const outcomeStr = args[1].toLowerCase();

      if (isNaN(marketId)) {
        await ctx.reply('❌ Invalid market ID. Please provide a number.');
        return;
      }

      if (outcomeStr !== 'yes' && outcomeStr !== 'no') {
        await ctx.reply('❌ Outcome must be "yes" or "no".');
        return;
      }

      const outcome = outcomeStr === 'yes';

      await ctx.reply('🔄 Resolving market...');

      try {
        const keypair = this.walletManager.getWallet(userId);
        const signature = await this.solanaService.resolveMarket(keypair, marketId, outcome);

        await ctx.reply(
          `✅ *Market Resolved!*\n\n` +
          `Market ID: #${marketId}\n` +
          `Outcome: ${outcome ? 'YES ✅' : 'NO ❌'}\n\n` +
          `TX: \`${signature.slice(0, 20)}...\`\n\n` +
          `View on Solana Explorer:\nhttps://explorer.solana.com/tx/${signature}?cluster=devnet\n\n` +
          `Winners can now claim their payouts with: /claim ${marketId}`,
          { parse_mode: 'Markdown' }
        );
      } catch (error: any) {
        console.error('Error resolving market:', error);
        
        let errorMsg = 'Failed to resolve market.';
        
        if (error.message?.includes('MarketStillOpen')) {
          errorMsg = '❌ Market is still open. Wait until the close time has passed.';
        } else if (error.message?.includes('MarketNotActive')) {
          errorMsg = '❌ Market is not active. It may already be resolved.';
        } else if (error.message?.includes('unauthorized')) {
          errorMsg = '❌ Only the market creator can resolve this market.';
        } else {
          errorMsg = `❌ ${error.message || 'Unknown error occurred'}`;
        }
        
        await ctx.reply(errorMsg);
      }
    });

    // About command
    this.bot.command('about', (ctx) => {
      ctx.reply(
        `🏎️ *F1 Prediction Market*\n\n` +
        `A decentralized prediction market for Formula 1 races, ` +
        `built on Solana blockchain.\n\n` +
        `*Features:*\n` +
        `• Bet on F1 race outcomes\n` +
        `• Create your own prediction markets\n` +
        `• Earn fees as a market creator\n` +
        `• Fast transactions on Solana\n` +
        `• Non-custodial embedded wallets\n\n` +
        `Built with ❤️ for F1 fans`,
        { parse_mode: 'Markdown' }
      );
    });
  }

  private setupCallbacks() {
    // Handle bet placement callbacks
    this.bot.action(/^bet_yes_(.+)$/, async (ctx) => {
      const marketId = ctx.match[1];
      await this.handleBet(ctx, marketId, true);
    });

    this.bot.action(/^bet_no_(.+)$/, async (ctx) => {
      const marketId = ctx.match[1];
      await this.handleBet(ctx, marketId, false);
    });

    // Handle amount selection
    this.bot.action(/^amount_(.+)_(.+)_(.+)$/, async (ctx) => {
      const [_, marketId, side, amount] = ctx.match;
      await this.confirmBet(ctx, marketId, side === 'yes', parseFloat(amount));
    });
  }

  private async createWallet(ctx: Context, userId: string) {
    const keypair = this.walletManager.createWallet(userId);
    
    await ctx.reply(
      `✅ Wallet created!\n\n` +
      `Address: \`${keypair.publicKey.toString()}\`\n\n` +
      `⚠️ IMPORTANT: This is a devnet wallet. Use /export to back up your private key.\n` +
      `Use /deposit to fund your wallet.`,
      { parse_mode: 'Markdown' }
    );
  }

  private async handleBet(ctx: any, marketId: string, side: boolean) {
    await ctx.answerCbQuery();
    
    const amounts = [0.5, 1, 2, 5, 10];
    const buttons = amounts.map(amount => 
      Markup.button.callback(
        `${amount} SOL`,
        `amount_${marketId}_${side ? 'yes' : 'no'}_${amount}`
      )
    );

    await ctx.reply(
      `💰 Select bet amount for ${side ? 'YES' : 'NO'}:`,
      {
        reply_markup: {
          inline_keyboard: [buttons]
        }
      }
    );
  }

  private async confirmBet(ctx: any, marketId: string, side: boolean, amount: number) {
    await ctx.answerCbQuery();
    const userId = ctx.from.id.toString();
    
    if (!this.walletManager.hasWallet(userId)) {
      await ctx.reply('❌ Please use /start first to create your wallet.');
      return;
    }

    await ctx.reply('🔄 Placing bet...');

    try {
      const keypair = this.walletManager.getWallet(userId);
      const signature = await this.solanaService.placeBet(
        keypair,
        parseInt(marketId),
        side,
        amount * LAMPORTS_PER_SOL
      );

      await ctx.reply(
        `✅ *Bet Placed!*\n\n` +
        `Market: #${marketId}\n` +
        `Side: ${side ? 'YES ✅' : 'NO ❌'}\n` +
        `Amount: ${amount} SOL\n\n` +
        `TX: \`${signature.slice(0, 16)}...\`\n\n` +
        `View on Solana Explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`,
        { parse_mode: 'Markdown' }
      );
    } catch (error: any) {
      await ctx.reply(`❌ Failed to place bet: ${error.message}`);
    }
  }

  private async setBotCommands() {
    try {
      await this.bot.telegram.setMyCommands([
        { command: 'start', description: 'Create wallet and get started' },
        { command: 'help', description: 'Show all commands' },
        { command: 'wallet', description: 'View wallet address and balance' },
        { command: 'deposit', description: 'Get deposit instructions' },
        { command: 'markets', description: 'View active prediction markets' },
        { command: 'market', description: 'View specific market details' },
        { command: 'create', description: 'Create a new prediction market' },
        { command: 'bet', description: 'Place a bet on a market' },
        { command: 'resolve', description: 'Resolve a market (creator only)' },
        { command: 'positions', description: 'View your open positions' },
        { command: 'claim', description: 'Claim your winnings' },
        { command: 'rewards', description: 'View claimable LP fees' },
        { command: 'claimfees', description: 'Claim LP fees (creators)' },
        { command: 'export', description: 'Export private key (DM only)' },
        { command: 'about', description: 'About the platform' },
      ]);
      console.log('✅ Bot commands registered with Telegram');
    } catch (error) {
      console.error('❌ Failed to set bot commands:', error);
    }
  }

  public async start() {
    try {
      await this.bot.launch();
      console.log('🤖 F1 Prediction Bot is running...');
      console.log(`📡 RPC: ${RPC_URL}`);
      console.log(`🔑 Program ID: ${PROGRAM_ID}`);
      
      // Enable graceful stop
      process.once('SIGINT', () => this.bot.stop('SIGINT'));
      process.once('SIGTERM', () => this.bot.stop('SIGTERM'));
    } catch (error) {
      console.error('❌ Failed to start bot:', error);
      process.exit(1);
    }
  }
}

// Start the bot
async function main() {
  try {
    console.log('🚀 Starting F1 Prediction Bot...');
    const bot = new F1PredictionBot();
    await bot.start();
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

main();
