import { ethers } from "hardhat";

async function main() {
  // Use the same wallet as Thunder node (from mnemonic)
  const provider = new ethers.JsonRpcProvider("http://localhost:8545");
  const secondWallet = ethers.Wallet.fromPhrase("abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about", provider);
  
  console.log("Second wallet address:", secondWallet.address);
  console.log("Second wallet ETH balance:", ethers.formatEther(await provider.getBalance(secondWallet.address)));
  
  // Contract addresses
  const thdTokenAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
  const paymentChannelAddress = "0xa513E6E4b8f2a923D98304ec87F64353C4D5C853";
  
  // Connect to contracts with second wallet
  const THDToken = await ethers.getContractFactory("THDToken");
  const thdToken = THDToken.attach(thdTokenAddress).connect(secondWallet);
  
  const PaymentChannel = await ethers.getContractFactory("PaymentChannel");
  const paymentChannel = PaymentChannel.attach(paymentChannelAddress).connect(secondWallet);
  
  console.log("\n📊 Current channel status:");
  const initialInfo = await paymentChannel.getChannelInfo();
  console.log("State:", ['EMPTY', 'ACTIVE', 'CLOSING', 'CLOSED'][initialInfo[0]]);
  console.log("Balance A:", ethers.formatEther(initialInfo[2]), "THD");
  console.log("Balance B:", ethers.formatEther(initialInfo[3]), "THD");
  console.log("Contract balance:", ethers.formatEther(initialInfo[5]), "THD");
  
  console.log("\n💰 Second wallet THD balance:", ethers.formatEther(await thdToken.balanceOf(secondWallet.address)));
  
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
    
    console.log("\n💰 Final second wallet THD balance:", ethers.formatEther(await thdToken.balanceOf(secondWallet.address)));
    
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