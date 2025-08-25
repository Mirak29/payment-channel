import { ethers } from "hardhat";

async function main() {
  console.log("⛏️  Mining 25 blocks to pass challenge period...");
  
  const provider = ethers.provider;
  const currentBlock = await provider.getBlockNumber();
  console.log("Current block:", currentBlock);
  
  // Mine 25 blocks to ensure we pass the 24-block challenge period
  for (let i = 0; i < 25; i++) {
    await provider.send("hardhat_mine", ["0x1"]);
    if (i % 5 === 0) {
      console.log(`Mined ${i + 1}/25 blocks...`);
    }
  }
  
  const newBlock = await provider.getBlockNumber();
  console.log("New block:", newBlock);
  console.log("✅ Challenge period should be over. You can now withdraw funds!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Mining failed:", error);
    process.exit(1);
  });