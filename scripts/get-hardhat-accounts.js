const { ethers } = require('hardhat');

async function main() {
  const signers = await ethers.getSigners();
  
  console.log("Hardhat Accounts:");
  for (let i = 0; i < 5; i++) {
    console.log(`Account #${i}: ${signers[i].address}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });