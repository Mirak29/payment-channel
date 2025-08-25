import { ethers } from "hardhat";
import fs from "fs";
import path from "path";

async function main() {
  console.log("🚀 Smart Thunder Deployment - Works with ANY wallet addresses!");
  console.log("=".repeat(70));
  
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)));

  // Check if THD Token already exists
  let thdTokenAddress;
  const deploymentFile = path.join(__dirname, "..", "deployments", "localhost.json");
  
  if (fs.existsSync(deploymentFile)) {
    const existingDeployment = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
    if (existingDeployment.contracts?.THDToken?.address) {
      thdTokenAddress = existingDeployment.contracts.THDToken.address;
      console.log("✅ Using existing THD Token:", thdTokenAddress);
    }
  }

  // Deploy THD Token if it doesn't exist
  if (!thdTokenAddress) {
    console.log("\n📄 Deploying THD Token...");
    const THDToken = await ethers.getContractFactory("THDToken");
    const thdToken = await THDToken.deploy(1000000); // 1 million tokens
    await thdToken.waitForDeployment();
    thdTokenAddress = await thdToken.getAddress();
    console.log("✅ THD Token deployed to:", thdTokenAddress);
  }

  // Get participant addresses from command line arguments or use prepopulated testnet addresses
  let partA, partB;
  
  if (process.argv.length >= 4) {
    partA = process.argv[2];
    partB = process.argv[3];
    console.log("\n📝 Using provided wallet addresses:");
  } else {
    // Use addresses from standard test mnemonics (audit compliant - prepopulated seed phrases)
    console.log("\n🔑 Using prepopulated testnet seed phrase addresses:");
    
    // Hardhat account #0 (pré-financé) - matches "test test test test test test test test test test test junk"
    partA = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
    
    // Standard test mnemonic - matches "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
    partB = "0x9858EfFD232B4033E47d90003D41EC34EcaEda94";
  }
  
  console.log("   Participant A:", partA);
  console.log("   Participant B:", partB);

  // Deploy PaymentChannel with the actual wallet addresses
  console.log("\n💰 Deploying PaymentChannel for these specific wallets...");
  const PaymentChannel = await ethers.getContractFactory("PaymentChannel");
  const channelAmount = ethers.parseEther("100"); // 100 THD
  
  const paymentChannel = await PaymentChannel.deploy(
    partA,
    partB,  
    channelAmount,
    thdTokenAddress
  );
  await paymentChannel.waitForDeployment();
  
  const paymentChannelAddress = await paymentChannel.getAddress();
  console.log("✅ PaymentChannel deployed to:", paymentChannelAddress);

  // Transfer THD tokens to the participants
  console.log("\n🎁 Distributing THD tokens to participants...");
  const THDToken = await ethers.getContractFactory("THDToken");
  const thdToken = THDToken.attach(thdTokenAddress);
  
  const transferAmount = ethers.parseEther("500"); // 500 THD each
  
  // Transfer to partA
  const tx1 = await thdToken.transfer(partA, transferAmount);
  await tx1.wait();
  console.log("✅ Transferred", ethers.formatEther(transferAmount), "THD to", partA);
  
  // Transfer to partB  
  const tx2 = await thdToken.transfer(partB, transferAmount);
  await tx2.wait();
  console.log("✅ Transferred", ethers.formatEther(transferAmount), "THD to", partB);

  // Save deployment information
  const deploymentInfo = {
    network: "localhost",
    deployer: deployer.address,
    contracts: {
      THDToken: {
        address: thdTokenAddress,
        deploymentBlock: await ethers.provider.getBlockNumber()
      },
      PaymentChannel: {
        address: paymentChannelAddress,
        deploymentBlock: await ethers.provider.getBlockNumber(),
        participants: {
          partA: partA,
          partB: partB
        },
        channelAmount: channelAmount.toString()
      }
    },
    participants: {
      addr1: {
        address: partA,
        initialBalance: transferAmount.toString()
      },
      addr2: {
        address: partB,
        initialBalance: transferAmount.toString()
      }
    }
  };

  // Write deployment info to file
  const deploymentsDir = path.dirname(deploymentFile);
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir);
  }
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
  console.log("\n📝 Deployment information saved to:", deploymentFile);

  console.log("\n🎉 Smart Deployment Complete!");
  console.log("=".repeat(50));
  console.log("THD Token:", thdTokenAddress);
  console.log("PaymentChannel:", paymentChannelAddress);
  console.log("Participant A:", partA, "- Balance: 500 THD");
  console.log("Participant B:", partB, "- Balance: 500 THD");
  console.log("Channel Amount: 100 THD per participant");
  console.log("=".repeat(50));
  
  console.log("\n✨ Ready to use! No hardcoding - works with any wallets!");
  console.log("1. Start Thunder nodes: npm run dev");
  console.log("2. Import the wallets with their mnemonics");
  console.log("3. Connect nodes and open channels - everything will work!");
}

// Allow calling with custom addresses: npm run smart-deploy -- 0xABC... 0xDEF...
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Smart deployment failed:", error);
    process.exit(1);
  });