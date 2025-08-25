import { ethers } from "hardhat";
import fs from "fs";
import path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)));

  // Deploy THD Token with initial supply of 1,000,000 tokens
  console.log("\n📄 Deploying THD Token...");
  const THDToken = await ethers.getContractFactory("THDToken");
  const thdToken = await THDToken.deploy(1000000); // 1 million tokens
  await thdToken.waitForDeployment();
  
  const thdTokenAddress = await thdToken.getAddress();
  console.log("✅ THD Token deployed to:", thdTokenAddress);

  // Create sample addresses for testing
  const [, addr1, addr2] = await ethers.getSigners();
  
  // Deploy PaymentChannel contract
  console.log("\n💰 Deploying PaymentChannel...");
  const PaymentChannel = await ethers.getContractFactory("PaymentChannel");
  const channelAmount = ethers.parseEther("100"); // 100 THD
  
  const paymentChannel = await PaymentChannel.deploy(
    addr1.address,
    addr2.address,
    channelAmount,
    thdTokenAddress
  );
  await paymentChannel.waitForDeployment();
  
  const paymentChannelAddress = await paymentChannel.getAddress();
  console.log("✅ PaymentChannel deployed to:", paymentChannelAddress);
  console.log("   Participant A:", addr1.address);
  console.log("   Participant B:", addr2.address);
  console.log("   Channel Amount:", ethers.formatEther(channelAmount), "THD");

  // Transfer tokens to participants for testing
  console.log("\n🎁 Distributing THD tokens to participants...");
  const transferAmount = ethers.parseEther("500"); // 500 THD each

  await thdToken.transfer(addr1.address, transferAmount);
  console.log("✅ Transferred", ethers.formatEther(transferAmount), "THD to", addr1.address);

  await thdToken.transfer(addr2.address, transferAmount);
  console.log("✅ Transferred", ethers.formatEther(transferAmount), "THD to", addr2.address);

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
          partA: addr1.address,
          partB: addr2.address
        },
        channelAmount: channelAmount.toString()
      }
    },
    participants: {
      addr1: {
        address: addr1.address,
        initialBalance: transferAmount.toString()
      },
      addr2: {
        address: addr2.address,
        initialBalance: transferAmount.toString()
      }
    }
  };

  // Create deployments directory if it doesn't exist
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir);
  }

  // Write deployment info to file
  const deploymentFile = path.join(deploymentsDir, "localhost.json");
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
  console.log("\n📝 Deployment information saved to:", deploymentFile);

  // Display summary
  console.log("\n🎉 Deployment Summary:");
  console.log("=".repeat(50));
  console.log("THD Token:", thdTokenAddress);
  console.log("PaymentChannel:", paymentChannelAddress);
  console.log("Participant A:", addr1.address, "- Balance:", ethers.formatEther(transferAmount), "THD");
  console.log("Participant B:", addr2.address, "- Balance:", ethers.formatEther(transferAmount), "THD");
  console.log("Channel Amount:", ethers.formatEther(channelAmount), "THD per participant");
  console.log("=".repeat(50));
  
  console.log("\n🔧 To interact with the contracts:");
  console.log("1. Start the Thunder node: npm run dev");
  console.log("2. Use Thunder CLI: npm run cli");
  console.log("3. Or interact directly via Hardhat console: npx hardhat console --network localhost");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });