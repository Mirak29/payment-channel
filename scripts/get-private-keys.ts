import { ethers } from "ethers";

async function main() {
  const mnemonic = "test test test test test test test test test test test junk";
  
  console.log("Hardhat Test Account Private Keys:");
  console.log("================================");
  
  const hdWallet = ethers.HDNodeWallet.fromPhrase(mnemonic);
  
  for (let i = 0; i < 3; i++) {
    const wallet = hdWallet.derivePath(`${i}`);
    console.log(`Account ${i}:`);
    console.log(`  Address: ${wallet.address}`);
    console.log(`  Private Key: ${wallet.privateKey}`);
    console.log("");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});