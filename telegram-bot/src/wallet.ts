import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import * as fs from 'fs';
import * as path from 'path';

const WALLETS_DIR = path.join(__dirname, '../wallets');

export class WalletManager {
  private wallets: Map<string, Keypair> = new Map();

  constructor() {
    // Create wallets directory if it doesn't exist
    if (!fs.existsSync(WALLETS_DIR)) {
      fs.mkdirSync(WALLETS_DIR, { recursive: true });
    }
    
    this.loadWallets();
  }

  private loadWallets() {
    if (!fs.existsSync(WALLETS_DIR)) return;

    const files = fs.readdirSync(WALLETS_DIR);
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        const userId = file.replace('.json', '');
        const filePath = path.join(WALLETS_DIR, file);
        const data = fs.readFileSync(filePath, 'utf8');
        const secretKey = JSON.parse(data);
        const keypair = Keypair.fromSecretKey(Uint8Array.from(secretKey));
        this.wallets.set(userId, keypair);
      }
    }

    console.log(`✅ Loaded ${this.wallets.size} wallet(s)`);
  }

  public createWallet(userId: string): Keypair {
    if (this.wallets.has(userId)) {
      return this.wallets.get(userId)!;
    }

    const keypair = Keypair.generate();
    this.wallets.set(userId, keypair);

    // Save to file
    const filePath = path.join(WALLETS_DIR, `${userId}.json`);
    fs.writeFileSync(
      filePath,
      JSON.stringify(Array.from(keypair.secretKey))
    );

    console.log(`✅ Created wallet for user ${userId}`);
    return keypair;
  }

  public hasWallet(userId: string): boolean {
    return this.wallets.has(userId);
  }

  public getWallet(userId: string): Keypair {
    const wallet = this.wallets.get(userId);
    if (!wallet) {
      throw new Error('Wallet not found');
    }
    return wallet;
  }

  public exportPrivateKey(userId: string): string {
    const keypair = this.getWallet(userId);
    return bs58.encode(keypair.secretKey);
  }

  public importWallet(userId: string, privateKey: string): Keypair {
    const secretKey = bs58.decode(privateKey);
    const keypair = Keypair.fromSecretKey(secretKey);
    
    this.wallets.set(userId, keypair);
    
    // Save to file
    const filePath = path.join(WALLETS_DIR, `${userId}.json`);
    fs.writeFileSync(
      filePath,
      JSON.stringify(Array.from(keypair.secretKey))
    );

    return keypair;
  }
}
