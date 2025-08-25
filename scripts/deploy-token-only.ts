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

  // Save deployment information (token only)
  const deploymentInfo = {
    network: "localhost",
    deployer: deployer.address,
    contracts: {
      THDToken: {
        address: thdTokenAddress,
        deploymentBlock: await ethers.provider.getBlockNumber()
      }
    },
    // PaymentChannel contracts will be created dynamically by Thunder nodes
    note: "PaymentChannel contracts are created dynamically when nodes open channels"
  };

  // Write deployment info to file
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir);
  }
  const deploymentFile = path.join(deploymentsDir, "localhost.json");
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
  console.log("\n📝 Deployment information saved to:", deploymentFile);

  console.log("\n🎉 Deployment Summary:");
  console.log("=".repeat(50));
  console.log("THD Token:", thdTokenAddress);
  console.log("Total Supply: 1,000,000 THD");
  console.log("Deployer Balance: 1,000,000 THD");
  console.log("=".repeat(50));
  
  console.log("\n💡 Usage:");
  console.log("1. Start Thunder nodes: npm run dev");
  console.log("2. Import wallets: thunder-cli importwallet <seedphrase>");
  console.log("3. Transfer THD tokens to wallets as needed");
  console.log("4. Thunder nodes will create PaymentChannel contracts dynamically");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });