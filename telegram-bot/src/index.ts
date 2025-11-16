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
    this.bot = new Telegraf(BOT_TOKEN);
    this.connection = new Connection(RPC_URL, 'confirmed');
    this.walletManager = new WalletManager();
    this.solanaService = new SolanaService(this.connection, PROGRAM_ID);

    this.setupCommands();
    this.setupCallbacks();
  }

  private setupCommands() {
    // Start command
    this.bot.start(async (ctx) => {
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
    });

    // Help command
    this.bot.help((ctx) => {
      ctx.reply(
        `📖 *F1 Prediction Market Commands*\n\n` +
        `*Wallet:*\n` +
        `/wallet - View your wallet address and balance\n` +
        `/deposit - Get deposit instructions\n` +
        `/export - Export your private key (DM only)\n\n` +
        `*Markets:*\n` +
        `/markets - View active prediction markets\n` +
        `/market <id> - View specific market details\n` +
        `/create - Create a new prediction market\n\n` +
        `*Betting:*\n` +
        `/bet - Place a bet on a market\n` +
        `/positions - View your open positions\n\n` +
        `*Claims:*\n` +
        `/claim - Claim your winnings\n` +
        `/rewards - View claimable rewards\n\n` +
        `*Info:*\n` +
        `/help - Show this help message\n` +
        `/about - About the platform`,
        { parse_mode: 'Markdown' }
      );
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

        const marketList = markets.map((m, i) => 
          `${i + 1}. ${formatMarket(m)}`
        ).join('\n\n');

        await ctx.reply(
          `🏁 *Active F1 Prediction Markets*\n\n${marketList}\n\n` +
          `Use /market <id> for details`,
          { parse_mode: 'Markdown' }
        );
      } catch (error) {
        await ctx.reply('❌ Error fetching markets. Please try again.');
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
          await ctx.reply('📭 No open positions. Use /bet to place your first bet!');
          return;
        }

        const positionList = positions.map((p, i) => 
          `${i + 1}. ${formatPosition(p)}`
        ).join('\n\n');

        await ctx.reply(
          `📊 *Your Positions*\n\n${positionList}`,
          { parse_mode: 'Markdown' }
        );
      } catch (error) {
        await ctx.reply('❌ Error fetching positions. Please try again.');
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
      Markup.inlineKeyboard([buttons], { columns: 3 })
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
        `Market: ${marketId}\n` +
        `Side: ${side ? 'YES' : 'NO'}\n` +
        `Amount: ${amount} SOL\n\n` +
        `TX: \`${signature}\`\n\n` +
        `View on Solana Explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`,
        { parse_mode: 'Markdown' }
      );
    } catch (error: any) {
      await ctx.reply(`❌ Failed to place bet: ${error.message}`);
    }
  }

  public start() {
    this.bot.launch();
    console.log('🤖 F1 Prediction Bot is running...');
    
    // Enable graceful stop
    process.once('SIGINT', () => this.bot.stop('SIGINT'));
    process.once('SIGTERM', () => this.bot.stop('SIGTERM'));
  }
}

// Start the bot
const bot = new F1PredictionBot();
bot.start();
