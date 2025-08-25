import { ethers } from "hardhat";
import { BlockchainService } from "../src/utils/blockchain";

async function main() {
  console.log("🏧 Testing fund withdrawal after channel closing");
  
  // Get participant addresses and create blockchain services
  const [, addr1, addr2] = await ethers.getSigners();
  const blockchainA = new BlockchainService();
  const blockchainB = new BlockchainService();
  
  const privateKeyA = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
  const privateKeyB = "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a";
  
  await blockchainA.loadWallet(privateKeyA);
  await blockchainB.loadWallet(privateKeyB);
  
  console.log(`Participant A: ${await blockchainA.getWalletAddress()}`);
  console.log(`Participant B: ${await blockchainB.getWalletAddress()}`);
  
  // Check current channel status
  console.log("\n📊 Current channel status:");
  try {
    const channelInfo = await blockchainA.getChannelInfo();
    console.log(`  State: ${channelInfo.state}`);
    console.log(`  Balance A: ${channelInfo.balanceA} THD`);
    console.log(`  Balance B: ${channelInfo.balanceB} THD`);
    console.log(`  Closing Block: ${channelInfo.closingBlock}`);
    console.log(`  Contract Balance: ${channelInfo.contractBalance} THD`);
    
    if (channelInfo.state === 'CLOSING' || channelInfo.state === 'CLOSED') {
      console.log(`\n⏰ Current block: ${await ethers.provider.getBlockNumber()}`);
      console.log(`   Closing block: ${channelInfo.closingBlock}`);
      
      // Mine some blocks to simulate challenge period passing
      console.log("\n⛏️  Mining blocks to pass challenge period...");
      await ethers.provider.send("hardhat_mine", ["0x14"]); // Mine 20 blocks
      
      const currentBlock = await ethers.provider.getBlockNumber();
      console.log(`✅ Current block after mining: ${currentBlock}`);
      
      // Check if we can withdraw now
      console.log("\n💸 Attempting withdrawal...");
      
      // Check balances before withdrawal
      const balanceABefore = await blockchainA.getBalance();
      const balanceBBefore = await blockchainB.getBalance();
      console.log(`  Before withdrawal - A: ${balanceABefore.thd} THD, B: ${balanceBBefore.thd} THD`);
      
      try {
        await blockchainA.withdrawFunds();
        console.log("✅ Participant A withdrawal successful!");
      } catch (error) {
        console.log(`⚠️  Participant A withdrawal: ${error.message}`);
      }
      
      try {
        await blockchainB.withdrawFunds();
        console.log("✅ Participant B withdrawal successful!");
      } catch (error) {
        console.log(`⚠️  Participant B withdrawal: ${error.message}`);
      }
      
      // Check balances after withdrawal
      const balanceAAfter = await blockchainA.getBalance();
      const balanceBAfter = await blockchainB.getBalance();
      console.log(`  After withdrawal - A: ${balanceAAfter.thd} THD, B: ${balanceBAfter.thd} THD`);
      
      // Check final channel state
      const finalChannelInfo = await blockchainA.getChannelInfo();
      console.log(`\n📊 Final channel state: ${finalChannelInfo.state}`);
      console.log(`   Contract balance: ${finalChannelInfo.contractBalance} THD`);
      
    } else {
      console.log("❌ Channel is not in CLOSING state. Cannot test withdrawal.");
      console.log("   Run the channel lifecycle test first to close a channel.");
    }
  } catch (error) {
    console.error("❌ Error testing withdrawal:", error.message);
  }
}

main().catch((error) => {
  console.error("❌ Withdrawal test failed:", error);
  process.exit(1);
});