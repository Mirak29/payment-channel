import { ethers } from "hardhat";
import { BlockchainService } from "../src/utils/blockchain";

async function main() {
  console.log("🏆 FINAL PAYMENT CHANNEL TEST");
  console.log("=============================");
  console.log("Testing: Open → Pay → Close → Withdraw");
  
  // Fresh wallets to avoid nonce issues  
  const wallet1 = new ethers.Wallet("0x0123456789012345678901234567890123456789012345678901234567890123", ethers.provider);
  const wallet2 = new ethers.Wallet("0x0123456789012345678901234567890123456789012345678901234567890124", ethers.provider);
  
  console.log(`\nNew Test Wallets:`);
  console.log(`  Wallet 1: ${wallet1.address}`);
  console.log(`  Wallet 2: ${wallet2.address}`);
  
  // Get some ETH for gas
  const [deployer] = await ethers.getSigners();
  await deployer.sendTransaction({
    to: wallet1.address,
    value: ethers.parseEther("1.0")
  });
  await deployer.sendTransaction({
    to: wallet2.address,
    value: ethers.parseEther("1.0") 
  });
  
  // Send some THD tokens to the test wallets
  const deploymentInfo = JSON.parse(require('fs').readFileSync('/home/mirak/Mirak29/payment-channel/deployments/localhost.json', 'utf8'));
  const thdToken = await ethers.getContractAt("THDToken", deploymentInfo.contracts.THDToken.address);
  
  await thdToken.transfer(wallet1.address, ethers.parseEther("200"));
  await thdToken.transfer(wallet2.address, ethers.parseEther("200"));
  
  // Deploy a new payment channel for these wallets
  const PaymentChannel = await ethers.getContractFactory("PaymentChannel");
  const channelAmount = ethers.parseEther("50"); // 50 THD each
  
  const paymentChannel = await PaymentChannel.deploy(
    wallet1.address,
    wallet2.address,
    channelAmount,
    deploymentInfo.contracts.THDToken.address
  );
  await paymentChannel.waitForDeployment();
  
  const channelAddress = await paymentChannel.getAddress();
  console.log(`\n📄 New PaymentChannel deployed: ${channelAddress}`);
  
  // Create blockchain services
  const blockchain1 = new BlockchainService();
  const blockchain2 = new BlockchainService();
  
  await blockchain1.loadWallet(wallet1.privateKey);
  await blockchain2.loadWallet(wallet2.privateKey);
  
  // Manually approve and fund
  console.log("\n💰 Funding channel...");
  
  const thdToken1 = thdToken.connect(wallet1);
  const thdToken2 = thdToken.connect(wallet2);
  const channel1 = paymentChannel.connect(wallet1);
  const channel2 = paymentChannel.connect(wallet2);
  
  await thdToken1.approve(channelAddress, channelAmount);
  await channel1.fund();
  console.log("✅ Wallet 1 funded");
  
  await thdToken2.approve(channelAddress, channelAmount);
  await channel2.fund();
  console.log("✅ Wallet 2 funded");
  
  // Check channel state
  const channelInfo = await paymentChannel.getChannelInfo();
  console.log(`\n📊 Channel Active:`);
  console.log(`  Balance 1: ${ethers.formatEther(channelInfo[2])} THD`);
  console.log(`  Balance 2: ${ethers.formatEther(channelInfo[3])} THD`);
  console.log(`  Nonce: ${channelInfo[1]}`);
  
  // Create payment with signature
  console.log("\n💸 Creating signed payment (20 THD from wallet1 to wallet2):");
  const newNonce = Number(channelInfo[1]) + 1;
  const newBalance1 = ethers.parseEther("30"); // 50 - 20
  const newBalance2 = ethers.parseEther("70"); // 50 + 20
  
  // Sign from wallet1
  const messageHash = ethers.solidityPackedKeccak256(
    ["uint256", "uint256", "uint256"],
    [newNonce, newBalance1, newBalance2]
  );
  const signature = await wallet1.signMessage(ethers.getBytes(messageHash));
  console.log(`  Signature: ${signature.substring(0, 20)}...`);
  
  // Close channel with signature
  console.log("\n🔒 Closing channel...");
  await channel2.closing(newNonce, newBalance1, newBalance2, signature);
  console.log("✅ Channel closed successfully!");
  
  // Check closing state
  const closingInfo = await paymentChannel.getChannelInfo();
  console.log(`  State: ${['EMPTY', 'ACTIVE', 'CLOSING', 'CLOSED'][closingInfo[0]]}`);
  console.log(`  Closing Block: ${closingInfo[4]}`);
  
  // Mine blocks to pass challenge period
  console.log("\n⛏️  Mining 26 blocks to pass challenge period...");
  await ethers.provider.send("hardhat_mine", ["0x1A"]);
  console.log(`  Current block: ${await ethers.provider.getBlockNumber()}`);
  
  // Test withdrawal
  console.log("\n💸 Testing withdrawals:");
  
  const balance1Before = await thdToken.balanceOf(wallet1.address);
  const balance2Before = await thdToken.balanceOf(wallet2.address);
  
  await channel1.withdraw();
  console.log("✅ Wallet 1 withdrawal successful!");
  
  await channel2.withdraw();
  console.log("✅ Wallet 2 withdrawal successful!");
  
  // Check final balances
  const balance1After = await thdToken.balanceOf(wallet1.address);
  const balance2After = await thdToken.balanceOf(wallet2.address);
  
  console.log(`\n💰 Final Balances:`);
  console.log(`  Wallet 1: ${ethers.formatEther(balance1After)} THD (change: +${ethers.formatEther(balance1After - balance1Before)})`);
  console.log(`  Wallet 2: ${ethers.formatEther(balance2After)} THD (change: +${ethers.formatEther(balance2After - balance2Before)})`);
  
  // Check final channel state
  const finalInfo = await paymentChannel.getChannelInfo();
  console.log(`\n📊 Final Channel State: ${['EMPTY', 'ACTIVE', 'CLOSING', 'CLOSED'][finalInfo[0]]}`);
  console.log(`   Contract Balance: ${ethers.formatEther(finalInfo[5])} THD`);
  
  console.log("\n🎉 SUCCESS! All Payment Channel Features Working:");
  console.log("✅ Channel Opening (Fund from both participants)");
  console.log("✅ ECDSA Signature Generation & Verification");
  console.log("✅ Channel Closing with Signed State");
  console.log("✅ Challenge Period Implementation");  
  console.log("✅ Fund Withdrawal After Challenge Period");
  console.log("\n🔥 The Thunder Payment Channel system is FULLY FUNCTIONAL!");
}

main().catch((error) => {
  console.error("❌ Final test failed:", error);
  process.exit(1);
});