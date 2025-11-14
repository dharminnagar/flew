import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { CapstonePredictionMarket } from "../target/types/capstone_prediction_market";
import { expect } from "chai";
import { PublicKey, Keypair, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";

describe("F1 Prediction Market - Complete Test Suite", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.CapstonePredictionMarket as Program<CapstonePredictionMarket>;
  
  // Test accounts
  const admin = provider.wallet as anchor.Wallet;
  const protocolTreasury = Keypair.generate();
  const marketCreator = Keypair.generate();
  const bettor1 = Keypair.generate();
  const bettor2 = Keypair.generate();

  // Test constants
  const FEE_RATE = 200; // 2%
  const INITIAL_LIQUIDITY = new BN(10 * LAMPORTS_PER_SOL);
  const MARKET_ID = 1;

  // PDAs - will be derived
  let globalStatePda: PublicKey;
  let marketPda: PublicKey;
  let marketVaultPda: PublicKey;
  let lpPositionPda: PublicKey;
  let position1Pda: PublicKey;
  let position2Pda: PublicKey;

  before("Airdrop SOL to test accounts", async () => {
    const airdropAmount = 100 * LAMPORTS_PER_SOL;
    
    const signatures = await Promise.all([
      provider.connection.requestAirdrop(marketCreator.publicKey, airdropAmount),
      provider.connection.requestAirdrop(bettor1.publicKey, airdropAmount),
      provider.connection.requestAirdrop(bettor2.publicKey, airdropAmount),
    ]);
    
    // Wait for confirmations
    await Promise.all(
      signatures.map(sig => provider.connection.confirmTransaction(sig))
    );
  });

  describe("Initialize Protocol", () => {
    it("Should initialize global state with fee rate and treasury", async () => {
      [globalStatePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("global_state")],
        program.programId
      );

      const tx = await program.methods
        .initialize(FEE_RATE)
        .accounts({
          admin: admin.publicKey,
          protocolTreasury: protocolTreasury.publicKey,
        })
        .rpc();

      console.log("   Initialize TX:", tx);

      const globalState = await program.account.globalState.fetch(globalStatePda);
      
      expect(globalState.marketCounter.toNumber()).to.equal(0);
      expect(globalState.feeRate).to.equal(FEE_RATE);
      expect(globalState.protocolTreasury.toString()).to.equal(protocolTreasury.publicKey.toString());
      expect(globalState.admin.toString()).to.equal(admin.publicKey.toString());

      console.log("   ✓ Global state initialized");
      console.log("   ✓ Market counter: 0");
      console.log("   ✓ Fee rate:", FEE_RATE, "basis points (2%)");
    });
  });

  describe("Create Market", () => {
    it("Should create a prediction market with initial liquidity", async () => {
      const question = Buffer.alloc(200);
      Buffer.from("Will Max Verstappen win the 2025 F1 Championship?").copy(question);
      
      const closeTime = new BN(Math.floor(Date.now() / 1000) + 86400); // 24 hours

      // Derive PDAs
      [marketPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("market"), new BN(MARKET_ID).toArrayLike(Buffer, "le", 8)],
        program.programId
      );

      [marketVaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("market_vault"), marketPda.toBuffer()],
        program.programId
      );

      [lpPositionPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("lp-position"), marketPda.toBuffer(), marketCreator.publicKey.toBuffer()],
        program.programId
      );

      const tx = await program.methods
        .createMarket(Array.from(question), INITIAL_LIQUIDITY, closeTime)
        .accounts({
          creator: marketCreator.publicKey,
          globalState: globalStatePda,
          market: marketPda,
          lpPosition: lpPositionPda,
          marketVault: marketVaultPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([marketCreator])
        .rpc();

      console.log("   Create Market TX:", tx);

      // Verify market
      const market = await program.account.market.fetch(marketPda);
      expect(market.marketId.toNumber()).to.equal(MARKET_ID);
      expect(market.creator.toString()).to.equal(marketCreator.publicKey.toString());
      expect(market.yesPool.toNumber()).to.equal(INITIAL_LIQUIDITY.toNumber() / 2);
      expect(market.noPool.toNumber()).to.equal(INITIAL_LIQUIDITY.toNumber() / 2);
      expect(market.totalLiquidity.toNumber()).to.equal(INITIAL_LIQUIDITY.toNumber());

      // Verify LP position
      const lpPosition = await program.account.lpPosition.fetch(lpPositionPda);
      expect(lpPosition.liquidityProvided.toNumber()).to.equal(INITIAL_LIQUIDITY.toNumber());
      expect(lpPosition.feesEarned.toNumber()).to.equal(0);

      // Verify vault balance
      const vaultBalance = await provider.connection.getBalance(marketVaultPda);
      expect(vaultBalance).to.equal(INITIAL_LIQUIDITY.toNumber());

      console.log("   ✓ Market created with ID:", MARKET_ID);
      console.log("   ✓ Initial liquidity:", INITIAL_LIQUIDITY.toNumber() / LAMPORTS_PER_SOL, "SOL");
      console.log("   ✓ YES pool:", market.yesPool.toNumber() / LAMPORTS_PER_SOL, "SOL");
      console.log("   ✓ NO pool:", market.noPool.toNumber() / LAMPORTS_PER_SOL, "SOL");
    });
  });

  describe("Place Bets", () => {
    it("Should allow user to bet on YES side", async () => {
      const betAmount = new BN(5 * LAMPORTS_PER_SOL);

      [position1Pda] = PublicKey.findProgramAddressSync(
        [Buffer.from("position"), marketPda.toBuffer(), bettor1.publicKey.toBuffer()],
        program.programId
      );

      const marketBefore = await program.account.market.fetch(marketPda);

      const tx = await program.methods
        .placeBet(true, betAmount) // true = YES
        .accounts({
          globalState: globalStatePda,
          market: marketPda,
          marketVault: marketVaultPda,
          position: position1Pda,
          lpPosition: lpPositionPda,
          protocolTreasury: protocolTreasury.publicKey,
          user: bettor1.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([bettor1])
        .rpc();

      console.log("   Place Bet (YES) TX:", tx);

      // Calculate expected values
      const totalFee = betAmount.toNumber() * FEE_RATE / 10000;
      const lpFee = Math.floor(totalFee * 80 / 100);
      const netBet = betAmount.toNumber() - totalFee;

      // Verify position
      const position = await program.account.position.fetch(position1Pda);
      expect(position.user.toString()).to.equal(bettor1.publicKey.toString());
      expect(position.side).to.be.true;
      expect(position.amount.toNumber()).to.equal(netBet);
      expect(position.claimed).to.be.false;

      // Verify pools updated
      const marketAfter = await program.account.market.fetch(marketPda);
      expect(marketAfter.yesPool.toNumber()).to.equal(marketBefore.yesPool.toNumber() + netBet);

      // Verify LP fees
      const lpPosition = await program.account.lpPosition.fetch(lpPositionPda);
      expect(lpPosition.feesEarned.toNumber()).to.equal(lpFee);

      console.log("   ✓ Bet placed: 5 SOL on YES");
      console.log("   ✓ Net bet after fees:", netBet / LAMPORTS_PER_SOL, "SOL");
      console.log("   ✓ LP fees earned:", lpFee / LAMPORTS_PER_SOL, "SOL");
    });

    it("Should allow user to bet on NO side", async () => {
      const betAmount = new BN(3 * LAMPORTS_PER_SOL);

      [position2Pda] = PublicKey.findProgramAddressSync(
        [Buffer.from("position"), marketPda.toBuffer(), bettor2.publicKey.toBuffer()],
        program.programId
      );

      const tx = await program.methods
        .placeBet(false, betAmount) // false = NO
        .accounts({
          globalState: globalStatePda,
          market: marketPda,
          marketVault: marketVaultPda,
          position: position2Pda,
          lpPosition: lpPositionPda,
          protocolTreasury: protocolTreasury.publicKey,
          user: bettor2.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([bettor2])
        .rpc();

      console.log("   Place Bet (NO) TX:", tx);

      const position = await program.account.position.fetch(position2Pda);
      expect(position.side).to.be.false;

      console.log("   ✓ Bet placed: 3 SOL on NO");
    });

    it("Should prevent betting on both sides with same account", async () => {
      try {
        await program.methods
          .placeBet(false, new BN(LAMPORTS_PER_SOL))
          .accounts({
            globalState: globalStatePda,
            market: marketPda,
            marketVault: marketVaultPda,
            position: position1Pda,
            lpPosition: lpPositionPda,
            protocolTreasury: protocolTreasury.publicKey,
            user: bettor1.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([bettor1])
          .rpc();
        
        expect.fail("Should have thrown error");
      } catch (error: any) {
        expect(error.toString()).to.include("CannotBetBothSides");
        console.log("   ✓ Correctly prevented betting on both sides");
      }
    });

    it("Should allow adding to existing position", async () => {
      const additionalBet = new BN(2 * LAMPORTS_PER_SOL);
      const positionBefore = await program.account.position.fetch(position1Pda);

      await program.methods
        .placeBet(true, additionalBet)
        .accounts({
          globalState: globalStatePda,
          market: marketPda,
          marketVault: marketVaultPda,
          position: position1Pda,
          lpPosition: lpPositionPda,
          protocolTreasury: protocolTreasury.publicKey,
          user: bettor1.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([bettor1])
        .rpc();

      const positionAfter = await program.account.position.fetch(position1Pda);
      expect(positionAfter.amount.toNumber()).to.be.greaterThan(positionBefore.amount.toNumber());

      console.log("   ✓ Additional bet added to existing position");
    });
  });

  describe("Resolve Market", () => {
    it("Should create and resolve a test market (past close time)", async () => {
      const question = Buffer.alloc(200);
      Buffer.from("Test market for resolution").copy(question);
      
      // Create market that's already closed
      const pastCloseTime = new BN(Math.floor(Date.now() / 1000) - 10);

      const [testMarketPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("market"), new BN(2).toArrayLike(Buffer, "le", 8)],
        program.programId
      );

      const [testLpPositionPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("lp-position"), testMarketPda.toBuffer(), marketCreator.publicKey.toBuffer()],
        program.programId
      );

      const [testMarketVaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("market_vault"), testMarketPda.toBuffer()],
        program.programId
      );

      // Create market
      await program.methods
        .createMarket(Array.from(question), INITIAL_LIQUIDITY, pastCloseTime)
        .accounts({
          creator: marketCreator.publicKey,
          globalState: globalStatePda,
          market: testMarketPda,
          lpPosition: testLpPositionPda,
          marketVault: testMarketVaultPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([marketCreator])
        .rpc();

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Resolve it
      const tx = await program.methods
        .resolveMarket(true) // YES wins
        .accounts({
          market: testMarketPda,
          resolver: marketCreator.publicKey,
        })
        .signers([marketCreator])
        .rpc();

      console.log("   Resolve Market TX:", tx);

      const market = await program.account.market.fetch(testMarketPda);
      expect(market.outcome).to.be.true;

      console.log("   ✓ Market resolved with outcome: YES");
    });
  });

  describe("Claim LP Fees", () => {
    it("Should allow LP to claim accumulated fees", async () => {
      const lpPositionBefore = await program.account.lpPosition.fetch(lpPositionPda);
      const feesToClaim = lpPositionBefore.feesEarned.toNumber();
      
      expect(feesToClaim).to.be.greaterThan(0, "Should have fees to claim");

      const creatorBalanceBefore = await provider.connection.getBalance(marketCreator.publicKey);

      const tx = await program.methods
        .claimLpFees()
        .accounts({
          market: marketPda,
          lpPosition: lpPositionPda,
          marketVault: marketVaultPda,
          creator: marketCreator.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([marketCreator])
        .rpc();

      console.log("   Claim LP Fees TX:", tx);

      const lpPositionAfter = await program.account.lpPosition.fetch(lpPositionPda);
      expect(lpPositionAfter.feesEarned.toNumber()).to.equal(0);
      expect(lpPositionAfter.feesClaimed).to.be.true;
      expect(lpPositionAfter.feesClaimedAmount.toNumber()).to.equal(feesToClaim);

      const creatorBalanceAfter = await provider.connection.getBalance(marketCreator.publicKey);
      const received = creatorBalanceAfter - creatorBalanceBefore;

      console.log("   ✓ Fees claimed:", feesToClaim / LAMPORTS_PER_SOL, "SOL");
      console.log("   ✓ Creator received:", received / LAMPORTS_PER_SOL, "SOL");
    });

    it("Should fail when trying to claim with no fees", async () => {
      try {
        await program.methods
          .claimLpFees()
          .accounts({
            market: marketPda,
            lpPosition: lpPositionPda,
            marketVault: marketVaultPda,
            creator: marketCreator.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([marketCreator])
          .rpc();
        
        expect.fail("Should have thrown error");
      } catch (error: any) {
        expect(error.toString()).to.include("NoFeesToClaim");
        console.log("   ✓ Correctly prevented claiming when no fees available");
      }
    });
  });

  describe("Integration Test Summary", () => {
    it("Should display final market state", async () => {
      const market = await program.account.market.fetch(marketPda);
      const lpPosition = await program.account.lpPosition.fetch(lpPositionPda);
      const vaultBalance = await provider.connection.getBalance(marketVaultPda);

      console.log("\n   📊 FINAL MARKET STATE:");
      console.log("   ========================");
      console.log("   Market ID:", market.marketId.toNumber());
      console.log("   YES Pool:", market.yesPool.toNumber() / LAMPORTS_PER_SOL, "SOL");
      console.log("   NO Pool:", market.noPool.toNumber() / LAMPORTS_PER_SOL, "SOL");
      console.log("   Total Liquidity:", market.totalLiquidity.toNumber() / LAMPORTS_PER_SOL, "SOL");
      console.log("   Vault Balance:", vaultBalance / LAMPORTS_PER_SOL, "SOL");
      console.log("   LP Fees Claimed:", lpPosition.feesClaimedAmount.toNumber() / LAMPORTS_PER_SOL, "SOL");
      console.log("   ========================\n");
    });
  });
});
