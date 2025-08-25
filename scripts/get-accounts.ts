import { ethers } from "hardhat";

async function main() {
  const signers = await ethers.getSigners();
  
  console.log("Hardhat Test Accounts:");
  console.log("=====================");
  
  for (let i = 0; i < 3; i++) {
    const signer = signers[i];
    const balance = await signer.provider.getBalance(signer.address);
    console.log(`Account ${i}:`);
    console.log(`  Address: ${signer.address}`);
    console.log(`  Balance: ${ethers.formatEther(balance)} ETH`);
    console.log("");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});