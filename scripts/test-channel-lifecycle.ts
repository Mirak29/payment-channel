import { ethers } from "hardhat";
import { BlockchainService } from "../src/utils/blockchain";
import { DeploymentInfo } from "../src/utils/types";
import fs from "fs";
import path from "path";

async function main() {
  console.log("🧪 Testing complete channel lifecycle with signatures");
  
  // Get Hardhat signers (these match the deployed contract participants)
  const [deployer, addr1, addr2] = await ethers.getSigners();
  
  console.log("Participants:");
  console.log(`  Deployer: ${deployer.address}`);
  console.log(`  Participant A: ${addr1.address}`);
  console.log(`  Participant B: ${addr2.address}`);
  
  // Load deployment info
  const deploymentPath = path.join(__dirname, "..", "deployments", "localhost.json");
  const deploymentData = fs.readFileSync(deploymentPath, "utf8");
  const deploymentInfo: DeploymentInfo = JSON.parse(deploymentData);
  
  console.log("\n📋 Contract Addresses:");
  console.log(`  THD Token: ${deploymentInfo.contracts.THDToken.address}`);
  console.log(`  PaymentChannel: ${deploymentInfo.contracts.PaymentChannel.address}`);
  
  // Create blockchain services for both participants
  const blockchainA = new BlockchainService();
  const blockchainB = new BlockchainService();
  
  // Load participant wallets using known Hardhat private keys
  console.log("\n🔑 Loading participant wallets...");
  const privateKeyA = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"; // Account 1
  const privateKeyB = "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a"; // Account 2
  
  await blockchainA.loadWallet(privateKeyA);
  await blockchainB.loadWallet(privateKeyB);
  
  console.log(`✅ Participant A loaded: ${await blockchainA.getWalletAddress()}`);
  console.log(`✅ Participant B loaded: ${await blockchainB.getWalletAddress()}`);
  
  // Check initial balances
  console.log("\n💰 Initial balances:");
  const balanceA = await blockchainA.getBalance();
  const balanceB = await blockchainB.getBalance();
  console.log(`  Participant A: ${balanceA.thd} THD`);
  console.log(`  Participant B: ${balanceB.thd} THD`);
  
  // Fund the channel from both participants
  console.log("\n🏗️  Funding channel...");
  await blockchainA.fundChannel();
  console.log("✅ Participant A funded the channel");
  
  await blockchainB.fundChannel();
  console.log("✅ Participant B funded the channel");
  
  // Check channel info
  console.log("\n📊 Channel status after funding:");
  const channelInfo = await blockchainA.getChannelInfo();
  console.log(`  State: ${channelInfo.state}`);
  console.log(`  Balance A: ${channelInfo.balanceA} THD`);
  console.log(`  Balance B: ${channelInfo.balanceB} THD`);
  console.log(`  Nonce: ${channelInfo.nonce}`);
  console.log(`  Contract Balance: ${channelInfo.contractBalance} THD`);
  
  // Test payment with signatures
  console.log("\n💸 Testing payment with signatures...");
  const paymentAmount = "10";
  const newNonce = 1;
  const newBalanceA = (parseFloat(channelInfo.balanceA) - parseFloat(paymentAmount)).toString();
  const newBalanceB = (parseFloat(channelInfo.balanceB) + parseFloat(paymentAmount)).toString();
  
  console.log(`  Payment: ${paymentAmount} THD from A to B`);
  console.log(`  New balances - A: ${newBalanceA}, B: ${newBalanceB}`);
  
  // Sign the new state from participant A
  const signatureA = await blockchainA.signChannelState(newNonce, newBalanceA, newBalanceB);
  console.log(`🔐 Signature from A: ${signatureA.substring(0, 20)}...`);
  
  // Verify signature from B's perspective  
  const participantA = deploymentInfo.contracts.PaymentChannel.participants.partA;
  const isValidSignature = blockchainB.verifyChannelStateSignature(
    newNonce, 
    newBalanceA, 
    newBalanceB, 
    signatureA, 
    participantA
  );
  console.log(`🔍 Signature verification: ${isValidSignature ? '✅ Valid' : '❌ Invalid'}`);
  
  if (isValidSignature) {
    // Test channel closing with proper signature
    console.log("\n🔒 Testing channel closing...");
    try {
      await blockchainB.closeChannel(newNonce, newBalanceA, newBalanceB, signatureA);
      console.log("✅ Channel closed successfully!");
      
      // Check final channel state
      const finalChannelInfo = await blockchainB.getChannelInfo();
      console.log("\n📊 Final channel status:");
      console.log(`  State: ${finalChannelInfo.state}`);
      console.log(`  Balance A: ${finalChannelInfo.balanceA} THD`);
      console.log(`  Balance B: ${finalChannelInfo.balanceB} THD`);
      console.log(`  Closing Block: ${finalChannelInfo.closingBlock}`);
      
      // Test withdrawal after some blocks
      console.log("\n⏳ Waiting for challenge period...");
      // In a real scenario, we'd wait for the challenge period
      // For testing, let's try immediate withdrawal
      
      try {
        await blockchainA.withdrawFunds();
        console.log("✅ Participant A withdrawal successful!");
      } catch (error) {
        console.log("⚠️  Participant A withdrawal failed:", error.message);
      }
      
      try {
        await blockchainB.withdrawFunds();
        console.log("✅ Participant B withdrawal successful!");
      } catch (error) {
        console.log("⚠️  Participant B withdrawal failed:", error.message);
      }
      
      // Check final wallet balances
      console.log("\n💰 Final wallet balances:");
      const finalBalanceA = await blockchainA.getBalance();
      const finalBalanceB = await blockchainB.getBalance();
      console.log(`  Participant A: ${finalBalanceA.thd} THD`);
      console.log(`  Participant B: ${finalBalanceB.thd} THD`);
      
    } catch (error) {
      console.log("❌ Channel closing failed:", error.message);
    }
  }
  
  console.log("\n🎉 Channel lifecycle test completed!");
}

main().catch((error) => {
  console.error("❌ Test failed:", error);
  process.exit(1);
});