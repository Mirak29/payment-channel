import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  
  // Second wallet address
  const secondWalletAddress = "0x9858EfFD232B4033E47d90003D41EC34EcaEda94";
  
  console.log("Transferring ETH from deployer to second wallet...");
  console.log("From:", deployer.address);
  console.log("To:", secondWalletAddress);
  
  // Transfer 1 ETH for gas fees
  const tx = await deployer.sendTransaction({
    to: secondWalletAddress,
    value: ethers.parseEther("100.0")
  });
  
  await tx.wait();
  
  console.log("✅ Transferred 100.0 ETH");
  
  // Check balances
  const firstWalletBalance = await ethers.provider.getBalance(deployer.address);
  const secondWalletBalance = await ethers.provider.getBalance(secondWalletAddress);
  
  console.log("First wallet ETH balance:", ethers.formatEther(firstWalletBalance));
  console.log("Second wallet ETH balance:", ethers.formatEther(secondWalletBalance));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Transfer failed:", error);
    process.exit(1);
  });