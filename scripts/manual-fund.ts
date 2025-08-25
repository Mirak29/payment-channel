import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  
  // Contract addresses
  const thdTokenAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
  const paymentChannelAddress = "0xa513E6E4b8f2a923D98304ec87F64353C4D5C853";
  
  // Connect to contracts
  const THDToken = await ethers.getContractFactory("THDToken");
  const thdToken = THDToken.attach(thdTokenAddress);
  
  const PaymentChannel = await ethers.getContractFactory("PaymentChannel");
  const paymentChannel = PaymentChannel.attach(paymentChannelAddress);
  
  console.log("📊 Initial channel status:");
  const initialInfo = await paymentChannel.getChannelInfo();
  console.log("State:", ['EMPTY', 'ACTIVE', 'CLOSING', 'CLOSED'][initialInfo[0]]);
  console.log("Contract balance:", ethers.formatEther(initialInfo[5]), "THD");
  
  console.log("\n💰 Deployer THD balance:", ethers.formatEther(await thdToken.balanceOf(deployer.address)));
  
  const channelAmount = ethers.parseEther("100");
  
  try {
    console.log("\n📝 Approving THD spending...");
    const approveTx = await thdToken.approve(paymentChannelAddress, channelAmount);
    console.log("Approve tx hash:", approveTx.hash);
    await approveTx.wait();
    console.log("✅ Approval confirmed");
    
    console.log("\n💰 Funding channel...");
    const fundTx = await paymentChannel.fund();
    console.log("Fund tx hash:", fundTx.hash);
    await fundTx.wait();
    console.log("✅ Funding confirmed");
    
    console.log("\n📊 Final channel status:");
    const finalInfo = await paymentChannel.getChannelInfo();
    console.log("State:", ['EMPTY', 'ACTIVE', 'CLOSING', 'CLOSED'][finalInfo[0]]);
    console.log("Balance A:", ethers.formatEther(finalInfo[2]), "THD");
    console.log("Balance B:", ethers.formatEther(finalInfo[3]), "THD");
    console.log("Contract balance:", ethers.formatEther(finalInfo[5]), "THD");
    
    console.log("\n💰 Final deployer THD balance:", ethers.formatEther(await thdToken.balanceOf(deployer.address)));
    
  } catch (error) {
    console.error("❌ Error:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });