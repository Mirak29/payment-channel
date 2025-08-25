import { ethers } from "hardhat";
import fs from "fs";
import path from "path";

async function validateDeployment(): Promise<boolean> {
  console.log("🔍 Validating deployment integrity...");
  
  const deploymentFile = path.join(__dirname, "..", "deployments", "localhost.json");
  
  if (!fs.existsSync(deploymentFile)) {
    console.log("❌ Deployment file not found");
    return false;
  }
  
  let deployment;
  try {
    deployment = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
  } catch (error) {
    console.log("❌ Invalid deployment file format");
    return false;
  }
  
  if (!deployment.contracts?.THDToken?.address || !deployment.contracts?.PaymentChannel?.address) {
    console.log("❌ Missing contract addresses in deployment file");
    return false;
  }
  
  const provider = ethers.provider;
  
  // Check THD Token
  const thdCode = await provider.getCode(deployment.contracts.THDToken.address);
  if (thdCode === "0x") {
    console.log(`❌ THD Token not found at ${deployment.contracts.THDToken.address}`);
    return false;
  }
  
  // Check PaymentChannel
  const channelCode = await provider.getCode(deployment.contracts.PaymentChannel.address);
  if (channelCode === "0x") {
    console.log(`❌ PaymentChannel not found at ${deployment.contracts.PaymentChannel.address}`);
    return false;
  }
  
  // Verify contract compatibility
  try {
    const THDToken = await ethers.getContractFactory("THDToken");
    const thdToken = THDToken.attach(deployment.contracts.THDToken.address);
    
    const PaymentChannel = await ethers.getContractFactory("PaymentChannel");
    const paymentChannel = PaymentChannel.attach(deployment.contracts.PaymentChannel.address);
    
    // Test basic calls
    await thdToken.name();
    await paymentChannel.partA();
    
    console.log("✅ All contracts validated successfully");
    console.log(`✅ THD Token: ${deployment.contracts.THDToken.address}`);
    console.log(`✅ PaymentChannel: ${deployment.contracts.PaymentChannel.address}`);
    console.log(`✅ Participant A: ${deployment.contracts.PaymentChannel.participants.partA}`);
    console.log(`✅ Participant B: ${deployment.contracts.PaymentChannel.participants.partB}`);
    
    return true;
  } catch (error) {
    console.log(`❌ Contract validation failed: ${error}`);
    return false;
  }
}

// Run validation if called directly
if (require.main === module) {
  validateDeployment()
    .then((isValid) => {
      if (!isValid) {
        console.log("\n💡 Run 'npm run smart-deploy' to fix deployment issues");
        process.exit(1);
      } else {
        console.log("\n🎉 Deployment is valid and ready to use!");
        process.exit(0);
      }
    })
    .catch((error) => {
      console.error("❌ Validation error:", error);
      process.exit(1);
    });
}

export { validateDeployment };