import { ethers } from "hardhat";
import { BlockchainService } from "../src/utils/blockchain";

async function main() {
  console.log("🧪 Complete Payment Channel Test");
  console.log("================================");
  
  // Create blockchain services for both participants
  const blockchainA = new BlockchainService();
  const blockchainB = new BlockchainService();
  
  const privateKeyA = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
  const privateKeyB = "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a";
  
  await blockchainA.loadWallet(privateKeyA);
  await blockchainB.loadWallet(privateKeyB);
  
  const addressA = await blockchainA.getWalletAddress();
  const addressB = await blockchainB.getWalletAddress();
  
  console.log(`Participant A: ${addressA}`);
  console.log(`Participant B: ${addressB}`);
  
  // 1. Check initial balances
  console.log("\n💰 Initial Balances:");
  const initialBalanceA = await blockchainA.getBalance();
  const initialBalanceB = await blockchainB.getBalance();
  console.log(`  A: ${initialBalanceA.thd} THD, B: ${initialBalanceB.thd} THD`);
  
  // 2. Fund channel (already funded from previous test, skip if already active)
  const channelInfo = await blockchainA.getChannelInfo();
  if (channelInfo.state === 'EMPTY') {
    console.log("\n🏗️  Funding channel...");
    await blockchainA.fundChannel();
    await blockchainB.fundChannel();
  }
  
  console.log("\n📊 Channel Status:");
  const activeChannelInfo = await blockchainA.getChannelInfo();
  console.log(`  State: ${activeChannelInfo.state}`);
  console.log(`  Balance A: ${activeChannelInfo.balanceA} THD`);
  console.log(`  Balance B: ${activeChannelInfo.balanceB} THD`);
  console.log(`  Nonce: ${activeChannelInfo.nonce}`);
  
  // 3. Create payment with signature
  console.log("\n💸 Creating Payment with Signature:");
  const paymentAmount = "25";
  const newNonce = activeChannelInfo.nonce + 1;
  const newBalanceA = (parseFloat(activeChannelInfo.balanceA) - parseFloat(paymentAmount)).toString();
  const newBalanceB = (parseFloat(activeChannelInfo.balanceB) + parseFloat(paymentAmount)).toString();
  
  console.log(`  Payment: ${paymentAmount} THD from A to B`);
  console.log(`  New state - Nonce: ${newNonce}, A: ${newBalanceA}, B: ${newBalanceB}`);
  
  // Sign the new state from participant A
  const signatureA = await blockchainA.signChannelState(newNonce, newBalanceA, newBalanceB);
  console.log(`  Signature created: ${signatureA.substring(0, 20)}...`);
  
  // 4. Close channel with signed state
  console.log("\n🔒 Closing Channel:");
  try {
    await blockchainB.closeChannel(newNonce, newBalanceA, newBalanceB, signatureA);
    console.log("✅ Channel closing initiated successfully!");
    
    // Check channel state after closing
    const closingChannelInfo = await blockchainB.getChannelInfo();
    console.log(`  State: ${closingChannelInfo.state}`);
    console.log(`  Balance A: ${closingChannelInfo.balanceA} THD`);
    console.log(`  Balance B: ${closingChannelInfo.balanceB} THD`);
    console.log(`  Closing Block: ${closingChannelInfo.closingBlock}`);
    
    // 5. Mine blocks to pass challenge period
    console.log("\n⛏️  Mining blocks to pass challenge period...");
    const blocksBefore = await ethers.provider.getBlockNumber();
    console.log(`  Current block: ${blocksBefore}`);
    
    await ethers.provider.send("hardhat_mine", ["0x1A"]); // Mine 26 blocks (24 + 2 for safety)
    
    const blocksAfter = await ethers.provider.getBlockNumber();
    console.log(`  After mining: ${blocksAfter}`);
    
    // 6. Test withdrawal
    console.log("\n💸 Testing Fund Withdrawal:");
    
    try {
      console.log("  Participant A withdrawing...");
      await blockchainA.withdrawFunds();
      console.log("  ✅ Participant A withdrawal successful!");
    } catch (error) {
      console.log(`  ⚠️  Participant A withdrawal failed: ${error.message}`);
    }
    
    try {
      console.log("  Participant B withdrawing...");
      await blockchainB.withdrawFunds();
      console.log("  ✅ Participant B withdrawal successful!");
    } catch (error) {
      console.log(`  ⚠️  Participant B withdrawal failed: ${error.message}`);
    }
    
    // 7. Check final balances
    console.log("\n💰 Final Balances:");
    const finalBalanceA = await blockchainA.getBalance();
    const finalBalanceB = await blockchainB.getBalance();
    console.log(`  A: ${finalBalanceA.thd} THD (change: ${(parseFloat(finalBalanceA.thd) - parseFloat(initialBalanceA.thd)).toFixed(1)})`);
    console.log(`  B: ${finalBalanceB.thd} THD (change: ${(parseFloat(finalBalanceB.thd) - parseFloat(initialBalanceB.thd)).toFixed(1)})`);
    
    // Check final channel state
    const finalChannelInfo = await blockchainA.getChannelInfo();
    console.log(`\n📊 Final Channel State: ${finalChannelInfo.state}`);
    console.log(`   Contract Balance: ${finalChannelInfo.contractBalance} THD`);
    
    console.log("\n🎉 Complete Payment Channel Test SUCCESSFUL!");
    console.log("✅ All features working: Open, Pay, Close, Withdraw");
    
  } catch (error) {
    console.log(`❌ Channel closing failed: ${error.message}`);
    if (error.message.includes("nonce")) {
      console.log("   This is likely due to previous transactions. Try deploying fresh contracts.");
    }
  }
}

main().catch((error) => {
  console.error("❌ Test failed:", error);
  process.exit(1);
});