import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { DeploymentInfo } from "./types";

export class BlockchainService {
  private provider: ethers.Provider;
  private signer?: ethers.Signer;
  private thdToken?: ethers.Contract;
  private paymentChannel?: ethers.Contract;
  private deploymentInfo?: DeploymentInfo;

  constructor(rpcUrl: string = "http://localhost:8545") {
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
  }

  async loadWallet(privateKey: string): Promise<void> {
    this.signer = new ethers.Wallet(privateKey, this.provider);
    await this.loadContracts();
  }

  async importWallet(seedPhrase: string): Promise<void> {
    const wallet = ethers.Wallet.fromPhrase(seedPhrase);
    this.signer = wallet.connect(this.provider);
    await this.loadContracts();
  }

  private async loadContracts(): Promise<void> {
    try {
      // Try multiple locations for deployment file (dev vs executable)
      const possiblePaths = [
        path.join(__dirname, "..", "..", "deployments", "localhost.json"), // Development
        path.join(process.cwd(), "deployments", "localhost.json"),          // Executable from project root  
        path.join(process.cwd(), "bin", "deployments", "localhost.json"),   // Executable from project root with bin/deployments
        "./deployments/localhost.json",                                     // Relative from current directory
        path.join(path.dirname(process.argv[0]), "deployments", "localhost.json"), // Next to executable
      ];
      
      let deploymentPath: string | undefined;
      console.log(`🔍 DEBUG: Searching for deployment file...`);
      console.log(`🔍 DEBUG: Current working directory: ${process.cwd()}`);
      console.log(`🔍 DEBUG: __dirname: ${__dirname}`);
      console.log(`🔍 DEBUG: process.argv[0]: ${process.argv[0]}`);
      for (const testPath of possiblePaths) {
        console.log(`🔍 DEBUG: Testing path: ${testPath}`);
        if (fs.existsSync(testPath)) {
          deploymentPath = testPath;
          console.log(`📂 Found deployment info at: ${deploymentPath}`);
          break;
        } else {
          console.log(`❌ Not found: ${testPath}`);
        }
      }
      
      if (deploymentPath) {
        const data = fs.readFileSync(deploymentPath, "utf8");
        this.deploymentInfo = JSON.parse(data);
        
        // Load contract ABIs
        const thdTokenArtifact = await import("../../artifacts/contracts/THDToken.sol/THDToken.json");
        const paymentChannelArtifact = await import("../../artifacts/contracts/PaymentChannel.sol/PaymentChannel.json");
        
        if (this.signer && this.deploymentInfo) {
          this.thdToken = new ethers.Contract(
            this.deploymentInfo.contracts.THDToken.address,
            thdTokenArtifact.abi,
            this.signer
          );
          
          this.paymentChannel = new ethers.Contract(
            this.deploymentInfo.contracts.PaymentChannel.address,
            paymentChannelArtifact.abi,
            this.signer
          );
        }
      } else {
        console.warn("⚠️  No deployment info found. Please deploy contracts first.");
      }
    } catch (error) {
      console.error("❌ Failed to load contracts:", error);
      throw error;
    }
  }

  async getBalance(): Promise<{ eth: string; thd: string }> {
    if (!this.signer) throw new Error("Wallet not loaded");
    
    try {
      const address = await this.signer.getAddress();
      console.log(`🔍 Getting balance for address: ${address}`);
      
      const ethBalance = await this.provider.getBalance(address);
      console.log(`  - ETH balance: ${ethers.formatEther(ethBalance)} ETH`);
      
      let thdBalance = "0";
      if (this.thdToken) {
        console.log(`  - THD Token contract: ${await this.thdToken.getAddress()}`);
        try {
          const rawThdBalance = await this.thdToken.balanceOf(address);
          thdBalance = rawThdBalance;
          console.log(`  - Raw THD balance: ${rawThdBalance}`);
          console.log(`  - Formatted THD balance: ${ethers.formatEther(thdBalance)} THD`);
        } catch (thdError) {
          console.error("❌ Failed to get THD balance:", thdError);
          throw new Error(`THD balance query failed: ${thdError instanceof Error ? thdError.message : 'Unknown error'}`);
        }
      } else {
        console.warn("⚠️  THD Token contract not loaded");
      }
      
      return {
        eth: ethers.formatEther(ethBalance),
        thd: ethers.formatEther(thdBalance)
      };
    } catch (error) {
      console.error("❌ Failed to get balance:", error);
      throw error;
    }
  }

  async getChannelInfo(): Promise<any> {
    if (!this.paymentChannel) {
      // Return default values if contract not loaded
      return {
        state: "NO_CONTRACT",
        nonce: 0,
        balanceA: "0.0",
        balanceB: "0.0",
        closingBlock: 0,
        contractBalance: "0.0"
      };
    }
    
    try {
      const info = await this.paymentChannel.getChannelInfo();
      return {
        state: ['EMPTY', 'ACTIVE', 'CLOSING', 'CLOSED'][info[0]],
        nonce: Number(info[1]),
        balanceA: ethers.formatEther(info[2]),
        balanceB: ethers.formatEther(info[3]),
        closingBlock: Number(info[4]),
        contractBalance: ethers.formatEther(info[5])
      };
    } catch (error) {
      console.warn("⚠️  Could not get channel info from blockchain:", error);
      // Return default values if blockchain call fails
      return {
        state: "EMPTY",
        nonce: 0,
        balanceA: "0.0",
        balanceB: "0.0",
        closingBlock: 0,
        contractBalance: "0.0"
      };
    }
  }

  async fundChannel(): Promise<void> {
    if (!this.paymentChannel || !this.thdToken || !this.deploymentInfo || !this.signer) {
      throw new Error("Contracts not loaded");
    }
    
    const channelAmount = this.deploymentInfo.contracts.PaymentChannel.channelAmount;
    const channelAddress = await this.paymentChannel.getAddress();
    const myAddress = await this.signer.getAddress();
    
    try {
      // Debug: Log current state
      console.log("🔍 Debug funding process:");
      console.log(`  - My address: ${myAddress}`);
      console.log(`  - Channel address: ${channelAddress}`);
      console.log(`  - Amount to fund: ${ethers.formatEther(channelAmount)} THD`);
      
      // Check if I'm a valid participant
      const partA = this.deploymentInfo.contracts.PaymentChannel.participants.partA;
      const partB = this.deploymentInfo.contracts.PaymentChannel.participants.partB;
      console.log(`  - Part A: ${partA}`);
      console.log(`  - Part B: ${partB}`);
      
      if (myAddress.toLowerCase() !== partA.toLowerCase() && myAddress.toLowerCase() !== partB.toLowerCase()) {
        throw new Error(`Address ${myAddress} is not a valid participant. Must be ${partA} or ${partB}`);
      }
      
      // Check current token balance
      const myBalance = await this.thdToken.balanceOf(myAddress);
      console.log(`  - My THD balance: ${ethers.formatEther(myBalance)} THD`);
      
      if (myBalance < channelAmount) {
        throw new Error(`Insufficient THD balance. Need ${ethers.formatEther(channelAmount)} THD, have ${ethers.formatEther(myBalance)} THD`);
      }
      
      // Check current allowance
      const currentAllowance = await this.thdToken.allowance(myAddress, channelAddress);
      console.log(`  - Current allowance: ${ethers.formatEther(currentAllowance)} THD`);
      
      // Get current nonce manually to avoid conflicts
      const currentNonce = await this.signer.getNonce("pending");
      
      // If we need to approve more tokens
      if (currentAllowance < channelAmount) {
        console.log("📝 Approving token spending...");
        
        // OpenZeppelin pattern: reset to 0 first if there's existing allowance
        if (currentAllowance > 0) {
          console.log("🔄 Resetting existing allowance to 0...");
          const resetTx = await this.thdToken.approve(channelAddress, 0, {
            nonce: currentNonce
          });
          await resetTx.wait();
          console.log("✅ Allowance reset to 0");
        }
        
        // Now approve the required amount
        console.log(`📝 Approving ${ethers.formatEther(channelAmount)} THD...`);
        const approveTx = await this.thdToken.approve(channelAddress, channelAmount, {
          nonce: currentAllowance > 0 ? currentNonce + 1 : currentNonce
        });
        await approveTx.wait();
        console.log("✅ Token approval successful");
        
        // Verify the approval worked
        const newAllowance = await this.thdToken.allowance(myAddress, channelAddress);
        console.log(`  - New allowance: ${ethers.formatEther(newAllowance)} THD`);
      } else {
        console.log("✅ Sufficient allowance already exists");
      }
      
      // Fund the channel
      console.log("💰 Funding channel...");
      const fundTx = await this.paymentChannel.fund({
        nonce: currentAllowance > 0 ? currentNonce + 2 : currentNonce + 1
      });
      await fundTx.wait();
      
      console.log("✅ Channel funded successfully");
    } catch (error) {
      console.error("❌ Failed to fund channel:", error);
      throw error;
    }
  }

  async closeChannel(nonce: number, balanceA: string, balanceB: string, signature: string): Promise<void> {
    if (!this.paymentChannel) throw new Error("PaymentChannel contract not loaded");
    
    const balanceAWei = ethers.parseEther(balanceA);
    const balanceBWei = ethers.parseEther(balanceB);
    
    console.log("🔒 Closing channel...");
    const closeTx = await this.paymentChannel.closing(nonce, balanceAWei, balanceBWei, signature);
    await closeTx.wait();
    
    console.log("✅ Channel closed successfully");
  }

  async withdrawFunds(): Promise<void> {
    if (!this.paymentChannel) throw new Error("PaymentChannel contract not loaded");
    
    console.log("💸 Withdrawing funds...");
    const withdrawTx = await this.paymentChannel.withdraw();
    await withdrawTx.wait();
    
    console.log("✅ Funds withdrawn successfully");
  }

  async challengeClose(nonce: number, balanceA: string, balanceB: string, signature: string): Promise<void> {
    if (!this.paymentChannel) throw new Error("PaymentChannel contract not loaded");
    
    const balanceAWei = ethers.parseEther(balanceA);
    const balanceBWei = ethers.parseEther(balanceB);
    
    console.log("⚔️  Challenging close...");
    const challengeTx = await this.paymentChannel.challenge(nonce, balanceAWei, balanceBWei, signature);
    await challengeTx.wait();
    
    console.log("✅ Challenge submitted successfully");
  }

  // Signature utilities for channel state management
  async signChannelState(nonce: number, balanceA: string, balanceB: string): Promise<string> {
    if (!this.signer) throw new Error("Wallet not loaded");
    
    const balanceAWei = ethers.parseEther(balanceA);
    const balanceBWei = ethers.parseEther(balanceB);
    
    // Create message hash matching the smart contract's message() function
    const messageHash = ethers.solidityPackedKeccak256(
      ["uint256", "uint256", "uint256"],
      [nonce, balanceAWei, balanceBWei]
    );
    
    // Sign the message hash
    const signature = await this.signer.signMessage(ethers.getBytes(messageHash));
    
    console.log(`🔐 Signed state: nonce=${nonce}, balanceA=${balanceA}, balanceB=${balanceB}`);
    return signature;
  }

  verifyChannelStateSignature(
    nonce: number, 
    balanceA: string, 
    balanceB: string, 
    signature: string, 
    expectedSigner: string
  ): boolean {
    try {
      const balanceAWei = ethers.parseEther(balanceA);
      const balanceBWei = ethers.parseEther(balanceB);
      
      // Create the same message hash
      const messageHash = ethers.solidityPackedKeccak256(
        ["uint256", "uint256", "uint256"],
        [nonce, balanceAWei, balanceBWei]
      );
      
      // Recover the signer address
      const recoveredAddress = ethers.verifyMessage(ethers.getBytes(messageHash), signature);
      
      const isValid = recoveredAddress.toLowerCase() === expectedSigner.toLowerCase();
      console.log(`🔍 Signature verification: ${isValid ? '✅ Valid' : '❌ Invalid'}`);
      return isValid;
    } catch (error) {
      console.error("❌ Signature verification failed:", error);
      return false;
    }
  }

  async getWalletAddress(): Promise<string> {
    if (!this.signer) throw new Error("Wallet not loaded");
    return await this.signer.getAddress();
  }

  getDeploymentInfo(): DeploymentInfo | undefined {
    return this.deploymentInfo;
  }

  getTHDTokenContract(): ethers.Contract | undefined {
    return this.thdToken;
  }

  getPaymentChannelContract(): ethers.Contract | undefined {
    return this.paymentChannel;
  }
}