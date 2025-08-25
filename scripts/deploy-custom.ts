import { ethers } from "hardhat";
import fs from "fs";
import path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("Deploying contracts with the account:", deployer.address);

  // Our current wallet addresses
  const partA = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"; // First wallet
  const partB = "0x9858EfFD232B4033E47d90003D41EC34EcaEda94"; // Second wallet
  
  // Use existing THD Token
  const thdTokenAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
  console.log("✅ Using existing THD Token at:", thdTokenAddress);

  // Deploy new PaymentChannel contract with our wallet addresses
  console.log("\n💰 Deploying new PaymentChannel...");
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
  console.log("   Participant A:", partA);
  console.log("   Participant B:", partB);
  console.log("   Channel Amount:", ethers.formatEther(channelAmount), "THD");

  // Save deployment information
  const deploymentInfo = {
    network: "localhost",
    deployer: deployer.address,
    contracts: {
      THDToken: {
        address: thdTokenAddress,
        deploymentBlock: 5  // From previous deployment
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
        initialBalance: "998900000000000000000"  // Current balance
      },
      addr2: {
        address: partB,
        initialBalance: "100000000000000000000"  // Current balance
      }
    }
  };

  // Write deployment info to file
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  const deploymentFile = path.join(deploymentsDir, "localhost.json");
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
  console.log("\n📝 Deployment information saved to:", deploymentFile);

  console.log("\n🎉 New Deployment Summary:");
  console.log("=".repeat(50));
  console.log("THD Token:", thdTokenAddress);
  console.log("PaymentChannel:", paymentChannelAddress);
  console.log("Participant A:", partA);
  console.log("Participant B:", partB);
  console.log("Channel Amount:", ethers.formatEther(channelAmount), "THD per participant");
  console.log("=".repeat(50));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });