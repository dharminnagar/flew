import { LAMPORTS_PER_SOL } from '@solana/web3.js';

export function formatSOL(lamports: number): string {
  return (lamports / LAMPORTS_PER_SOL).toFixed(4);
}

export function formatMarket(market: any): string {
  const question = Buffer.from(market.question).toString('utf8').replace(/\0/g, '');
  const yesOdds = ((market.yesPool / market.totalLiquidity) * 100).toFixed(1);
  const noOdds = ((market.noPool / market.totalLiquidity) * 100).toFixed(1);
  
  return (
    `*Market #${market.marketId}*\n` +
    `${question}\n\n` +
    `💰 Pool: ${formatSOL(market.totalLiquidity)} SOL\n` +
    `📊 YES: ${yesOdds}% | NO: ${noOdds}%\n` +
    `🕐 Closes: ${new Date(market.closeTime * 1000).toLocaleString()}\n` +
    `Status: ${market.state}`
  );
}

export function formatPosition(position: any): string {
  const side = position.side ? 'YES' : 'NO';
  
  return (
    `*Position*\n` +
    `Market: ${position.market.toString().slice(0, 8)}...\n` +
    `Side: ${side}\n` +
    `Amount: ${formatSOL(position.amount)} SOL\n` +
    `Status: ${position.claimed ? '✅ Claimed' : '⏳ Pending'}`
  );
}

export function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString();
}

export function parseQuestion(bytes: number[]): string {
  return Buffer.from(bytes).toString('utf8').replace(/\0/g, '').trim();
}
