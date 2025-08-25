import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  
  // THD Token address from deployment
  const thdTokenAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
  
  // Connect to the deployed THD Token
  const THDToken = await ethers.getContractFactory("THDToken");
  const thdToken = THDToken.attach(thdTokenAddress);
  
  // Second wallet address
  const secondWalletAddress = "0x9858EfFD232B4033E47d90003D41EC34EcaEda94";
  
  console.log("Transferring tokens from deployer to second wallet...");
  console.log("From:", deployer.address);
  console.log("To:", secondWalletAddress);
  
  // Transfer 100 THD tokens
  const transferAmount = ethers.parseEther("100");
  
  const tx = await thdToken.transfer(secondWalletAddress, transferAmount);
  await tx.wait();
  
  console.log("✅ Transferred", ethers.formatEther(transferAmount), "THD tokens");
  
  // Check balances
  const firstWalletBalance = await thdToken.balanceOf(deployer.address);
  const secondWalletBalance = await thdToken.balanceOf(secondWalletAddress);
  
  console.log("First wallet balance:", ethers.formatEther(firstWalletBalance), "THD");
  console.log("Second wallet balance:", ethers.formatEther(secondWalletBalance), "THD");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Transfer failed:", error);
    process.exit(1);
  });