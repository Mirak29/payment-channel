import { BlockchainService } from "../utils/blockchain";
import { NetworkService } from "../utils/network";
import { ChannelState, NetworkMessage, PaymentMessage } from "../utils/types";
import { createServer, IncomingMessage, ServerResponse } from "http";

export class ThunderNode {
  private blockchainService: BlockchainService;
  private networkService: NetworkService;
  private httpServer?: any;
  private currentChannel?: ChannelState;
  private walletLoaded = false;
  private apiPort: number;

  constructor(rpcUrl: string, port: number, nodeAddress: string) {
    this.apiPort = port; // Store the API port
    this.blockchainService = new BlockchainService(rpcUrl);
    this.networkService = new NetworkService(port + 1, nodeAddress); // Use port+1 for P2P

    // Setup message handlers
    this.setupMessageHandlers();
  }

  private setupMessageHandlers(): void {
    this.networkService.onMessage("CONNECT", this.handleConnectMessage.bind(this));
    this.networkService.onMessage("CHANNEL_OPEN", this.handleChannelOpen.bind(this));
    this.networkService.onMessage("PAYMENT", this.handlePaymentMessage.bind(this));
    this.networkService.onMessage("CHANNEL_CLOSE", this.handleChannelClose.bind(this));
    this.networkService.onMessage("HEARTBEAT", this.handleHeartbeat.bind(this));
  }

  async start(): Promise<void> {
    try {
      // Start P2P networking
      await this.networkService.startServer();

      // Start HTTP API server for CLI communication
      await this.startApiServer();

      console.log("✅ Thunder node started successfully");
      console.log("💡 Use thunder-cli to interact with this node");
      console.log("📊 Node status: Waiting for wallet to be loaded...");

    } catch (error) {
      console.error("❌ Failed to start Thunder node:", error);
      throw error;
    }
  }

  private async startApiServer(): Promise<void> {
    const port = this.apiPort;

    this.httpServer = createServer((req: IncomingMessage, res: ServerResponse) => {
      // Enable CORS
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");

      if (req.method === "OPTIONS") {
        res.writeHead(200);
        res.end();
        return;
      }

      const url = req.url || "";
      const method = req.method || "GET";

      // Parse request body for POST requests
      if (method === "POST") {
        let body = "";
        req.on("data", chunk => body += chunk);
        req.on("end", () => {
          this.handleApiRequest(url, method, body, res);
        });
      } else {
        this.handleApiRequest(url, method, "", res);
      }
    });

    return new Promise((resolve, reject) => {
      this.httpServer.listen(port, () => {
        console.log(`🌐 API server listening on port ${port}`);
        resolve();
      });

      this.httpServer.on("error", reject);
    });
  }

  private async handleApiRequest(
    url: string, 
    method: string, 
    body: string, 
    res: ServerResponse
  ): Promise<void> {
    try {
      res.setHeader("Content-Type", "application/json");

      let response: any = { success: false, error: "Unknown endpoint" };

      if (url === "/info" && method === "GET") {
        response = await this.getNodeInfo();
      } else if (url === "/wallet/import" && method === "POST") {
        const data = JSON.parse(body);
        response = await this.importWallet(data.seedphrase);
      } else if (url === "/balance" && method === "GET") {
        response = await this.getBalance();
      } else if (url === "/connect" && method === "POST") {
        const data = JSON.parse(body);
        response = await this.connectToPeer(data.address);
      } else if (url === "/channel/open" && method === "POST") {
        response = await this.openChannel();
      } else if (url === "/channel/pay" && method === "POST") {
        const data = JSON.parse(body);
        response = await this.makePayment(data.amount);
      } else if (url === "/channel/close" && method === "POST") {
        response = await this.closeChannel();
      } else if (url === "/channel/withdraw" && method === "POST") {
        response = await this.withdrawFromChannel();
      } else if (url === "/channel/challenge" && method === "POST") {
        const data = JSON.parse(body);
        response = await this.challengeClose(data);
      }

      res.writeHead(response.success ? 200 : 400);
      res.end(JSON.stringify(response, null, 2));

    } catch (error) {
      console.error("API Error:", error);
      res.writeHead(500);
      res.end(JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Internal server error" 
      }));
    }
  }

  // API Methods
  private async getNodeInfo(): Promise<any> {
    const nodeInfo = this.networkService.getNodeInfo();
    const channelInfo = this.currentChannel || await this.getChannelFromBlockchain();
    const walletAddress = this.walletLoaded ? await this.blockchainService.getWalletAddress() : null;

    return {
      success: true,
      data: {
        address: nodeInfo.address,
        port: nodeInfo.port,
        connectedPeers: nodeInfo.connectedPeers,
        walletLoaded: this.walletLoaded,
        walletAddress: walletAddress,
        channel: channelInfo
      }
    };
  }

  private async importWallet(seedphrase: string): Promise<any> {
    try {
      await this.blockchainService.importWallet(seedphrase);
      this.walletLoaded = true;
      
      const walletAddress = await this.blockchainService.getWalletAddress();
      console.log("✅ Wallet imported successfully");
      console.log(`📍 Address: ${walletAddress}`);
      
      return {
        success: true,
        message: "Wallet imported successfully",
        address: walletAddress
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to import wallet"
      };
    }
  }

  private async getBalance(): Promise<any> {
    if (!this.walletLoaded) {
      return { success: false, error: "Wallet not loaded" };
    }

    try {
      const balance = await this.blockchainService.getBalance();
      
      // Use local channel state if available (off-chain state takes priority)
      let channelInfo;
      if (this.currentChannel && this.currentChannel.nonce > 0) {
        // We have local off-chain state - use it (more recent than blockchain)
        console.log(`🔍 DEBUG: Using local channel state (nonce: ${this.currentChannel.nonce})`);
        console.log(`🔍 DEBUG: Local state - A: ${this.currentChannel.balanceA}, B: ${this.currentChannel.balanceB}`);
        channelInfo = {
          state: this.currentChannel.state,
          nonce: this.currentChannel.nonce,
          balanceA: this.currentChannel.balanceA,
          balanceB: this.currentChannel.balanceB,
          closingBlock: this.currentChannel.closingBlock || 0,
          contractBalance: (parseFloat(this.currentChannel.balanceA) + parseFloat(this.currentChannel.balanceB)).toString()
        };
      } else {
        // No local state or nonce is 0, get from blockchain
        console.log(`🔍 DEBUG: Using blockchain channel state (no local state or nonce=0)`);
        if (this.currentChannel) {
          console.log(`🔍 DEBUG: Local channel exists but nonce=${this.currentChannel.nonce}`);
        }
        channelInfo = await this.getChannelFromBlockchain();
      }
      
      return {
        success: true,
        data: {
          wallet: balance,
          channel: channelInfo
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get balance"
      };
    }
  }

  private async connectToPeer(peerAddress: string): Promise<any> {
    try {
      // Convert API address to P2P address (API port + 1)
      const [host, apiPort] = peerAddress.split(":");
      const p2pPort = parseInt(apiPort) + 1;
      const p2pAddress = `${host}:${p2pPort}`;
      
      await this.networkService.connectToPeer(p2pAddress);
      
      // Send connect message
      const message: NetworkMessage = {
        type: "CONNECT",
        from: this.networkService.getNodeInfo().address,
        to: p2pAddress,
        data: { nodeInfo: this.networkService.getNodeInfo() },
        timestamp: Date.now()
      };
      
      this.networkService.sendMessage(message);
      
      return {
        success: true,
        message: `Connected to peer: ${peerAddress} (P2P: ${p2pAddress})`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to connect to peer"
      };
    }
  }

  private async openChannel(): Promise<any> {
    if (!this.walletLoaded) {
      return { success: false, error: "Wallet not loaded" };
    }

    if (!this.networkService.isConnected()) {
      return { success: false, error: "No peers connected" };
    }

    try {
      await this.blockchainService.fundChannel();
      this.currentChannel = await this.getChannelFromBlockchain();
      this.networkService.setChannel(this.currentChannel);
      
      // Notify peer about channel opening
      const message: NetworkMessage = {
        type: "CHANNEL_OPEN",
        from: this.networkService.getNodeInfo().address,
        data: { channel: this.currentChannel },
        timestamp: Date.now()
      };
      
      this.networkService.sendMessage(message);
      
      return {
        success: true,
        message: "Channel opened successfully",
        channel: this.currentChannel
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to open channel"
      };
    }
  }

  private async makePayment(amount: string): Promise<any> {
    if (!this.walletLoaded) {
      return { success: false, error: "Wallet not loaded" };
    }

    if (!this.currentChannel || this.currentChannel.state !== "ACTIVE") {
      return { success: false, error: "No active channel" };
    }

    try {
      // Update balances
      const newNonce = this.currentChannel.nonce + 1;
      const paymentAmount = parseFloat(amount);
      const currentBalanceA = parseFloat(this.currentChannel.balanceA);
      const currentBalanceB = parseFloat(this.currentChannel.balanceB);
      
      const walletAddress = await this.blockchainService.getWalletAddress();
      const deploymentInfo = this.blockchainService.getDeploymentInfo();
      
      if (!deploymentInfo) {
        throw new Error("Deployment info not available");
      }
      
      let newBalanceA = currentBalanceA;
      let newBalanceB = currentBalanceB;
      
      if (walletAddress === deploymentInfo.contracts.PaymentChannel.participants.partA) {
        // I'm party A, sending to party B
        newBalanceA -= paymentAmount;
        newBalanceB += paymentAmount;
      } else {
        // I'm party B, sending to party A
        newBalanceA += paymentAmount;
        newBalanceB -= paymentAmount;
      }
      
      if (newBalanceA < 0 || newBalanceB < 0) {
        throw new Error("Insufficient channel balance");
      }
      
      // Sign the new state
      const signature = await this.blockchainService.signChannelState(
        newNonce,
        newBalanceA.toString(),
        newBalanceB.toString()
      );
      
      const paymentMessage: PaymentMessage = {
        nonce: newNonce,
        balanceA: newBalanceA.toString(),
        balanceB: newBalanceB.toString(),
        signature
      };
      
      // Update local state
      this.currentChannel.nonce = newNonce;
      this.currentChannel.balanceA = newBalanceA.toString();
      this.currentChannel.balanceB = newBalanceB.toString();
      
      // Store our own signature
      if (walletAddress === deploymentInfo.contracts.PaymentChannel.participants.partA) {
        this.currentChannel.signatureA = signature;
      } else {
        this.currentChannel.signatureB = signature;
      }
      
      // Send payment message to peer
      const message: NetworkMessage = {
        type: "PAYMENT",
        from: this.networkService.getNodeInfo().address,
        data: paymentMessage,
        timestamp: Date.now()
      };
      
      this.networkService.sendMessage(message);
      
      return {
        success: true,
        message: `Payment of ${amount} THD sent successfully`,
        newBalances: {
          balanceA: newBalanceA.toString(),
          balanceB: newBalanceB.toString(),
          nonce: newNonce
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Payment failed"
      };
    }
  }

  private async closeChannel(): Promise<any> {
    if (!this.walletLoaded) {
      return { success: false, error: "Wallet not loaded" };
    }

    if (!this.currentChannel || this.currentChannel.state !== "ACTIVE") {
      return { success: false, error: "No active channel to close" };
    }

    try {
      // Use the stored signature from the other party's last payment
      // We need the signature from the counterparty to prove they agreed to this state
      const deploymentInfo = this.blockchainService.getDeploymentInfo();
      if (!deploymentInfo) {
        throw new Error("Deployment info not available");
      }
      
      const myAddress = await this.blockchainService.getWalletAddress();
      let counterpartySignature: string;
      
      if (myAddress === deploymentInfo.contracts.PaymentChannel.participants.partA) {
        // I'm party A, need signature from party B
        counterpartySignature = this.currentChannel.signatureB || "";
      } else {
        // I'm party B, need signature from party A
        counterpartySignature = this.currentChannel.signatureA || "";
      }
      
      // If we don't have a counterparty signature, generate one for initial state
      if (!counterpartySignature && this.currentChannel.nonce === 0) {
        // For nonce 0 (no payments made), we can close without counterparty signature
        // The contract should allow this for the initial funded state
        counterpartySignature = "0x" + "00".repeat(65); // Empty signature
      }
      
      if (!counterpartySignature) {
        throw new Error("No counterparty signature available for channel closure");
      }
      
      console.log(`🔒 Closing channel with nonce ${this.currentChannel.nonce}`);
      console.log(`💰 Final balances: A=${this.currentChannel.balanceA} THD, B=${this.currentChannel.balanceB} THD`);
      
      await this.blockchainService.closeChannel(
        this.currentChannel.nonce,
        this.currentChannel.balanceA,
        this.currentChannel.balanceB,
        counterpartySignature
      );
      
      this.currentChannel.state = "CLOSING";
      
      // Notify peer
      const message: NetworkMessage = {
        type: "CHANNEL_CLOSE",
        from: this.networkService.getNodeInfo().address,
        data: { channel: this.currentChannel },
        timestamp: Date.now()
      };
      
      this.networkService.sendMessage(message);
      
      return {
        success: true,
        message: "Channel close initiated. Wait for challenge period before withdrawing.",
        channel: this.currentChannel
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to close channel"
      };
    }
  }

  private async withdrawFromChannel(): Promise<any> {
    if (!this.walletLoaded) {
      return { success: false, error: "Wallet not loaded" };
    }

    try {
      await this.blockchainService.withdrawFunds();
      this.currentChannel = await this.getChannelFromBlockchain();
      
      return {
        success: true,
        message: "Funds withdrawn successfully",
        channel: this.currentChannel
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to withdraw funds"
      };
    }
  }

  private async challengeClose(data: any): Promise<any> {
    if (!this.walletLoaded) {
      return { success: false, error: "Wallet not loaded" };
    }

    try {
      await this.blockchainService.challengeClose(
        data.nonce,
        data.balanceA,
        data.balanceB,
        data.signature
      );
      
      this.currentChannel = await this.getChannelFromBlockchain();
      
      return {
        success: true,
        message: "Challenge submitted successfully",
        channel: this.currentChannel
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to submit challenge"
      };
    }
  }

  // Message Handlers
  private handleConnectMessage(message: NetworkMessage): void {
    console.log(`🤝 Peer connected: ${message.from}`);
    
    // Only respond if this is not already a response (to prevent infinite loop)
    if (!message.data?.isResponse) {
      const response: NetworkMessage = {
        type: "CONNECT",
        from: this.networkService.getNodeInfo().address,
        to: message.from,
        data: { nodeInfo: this.networkService.getNodeInfo(), isResponse: true },
        timestamp: Date.now()
      };
      this.networkService.sendMessage(response);
    }
  }

  private handleChannelOpen(message: NetworkMessage): void {
    console.log(`💰 Channel opened by peer: ${message.from}`);
    this.currentChannel = message.data.channel;
    this.networkService.setChannel(this.currentChannel);
  }

  private async handlePaymentMessage(message: NetworkMessage): Promise<void> {
    console.log(`💸 Payment received from: ${message.from}`);
    const payment: PaymentMessage = message.data;
    
    if (!this.currentChannel || !this.walletLoaded) {
      console.error("❌ Cannot process payment: No active channel or wallet not loaded");
      return;
    }
    
    try {
      const deploymentInfo = this.blockchainService.getDeploymentInfo();
      if (!deploymentInfo) {
        throw new Error("Deployment info not available");
      }
      
      // Determine sender address based on message source
      let senderAddress: string;
      const myAddress = await this.blockchainService.getWalletAddress();
      
      if (myAddress === deploymentInfo.contracts.PaymentChannel.participants.partA) {
        // I'm party A, so sender must be party B
        senderAddress = deploymentInfo.contracts.PaymentChannel.participants.partB;
      } else {
        // I'm party B, so sender must be party A
        senderAddress = deploymentInfo.contracts.PaymentChannel.participants.partA;
      }
      
      // Verify signature
      const isValidSignature = this.blockchainService.verifyChannelStateSignature(
        payment.nonce,
        payment.balanceA,
        payment.balanceB,
        payment.signature,
        senderAddress
      );
      
      if (!isValidSignature) {
        console.error("❌ Invalid payment signature - rejecting payment");
        return;
      }
      
      // Verify nonce progression
      if (payment.nonce !== this.currentChannel.nonce + 1) {
        console.error(`❌ Invalid nonce: expected ${this.currentChannel.nonce + 1}, got ${payment.nonce}`);
        return;
      }
      
      // Update local channel state with signatures
      console.log(`🔍 DEBUG: Before update - nonce: ${this.currentChannel.nonce}, A: ${this.currentChannel.balanceA}, B: ${this.currentChannel.balanceB}`);
      this.currentChannel.nonce = payment.nonce;
      this.currentChannel.balanceA = payment.balanceA;
      this.currentChannel.balanceB = payment.balanceB;
      console.log(`🔍 DEBUG: After update - nonce: ${this.currentChannel.nonce}, A: ${this.currentChannel.balanceA}, B: ${this.currentChannel.balanceB}`);
      
      // Store the signature from sender
      if (senderAddress === deploymentInfo.contracts.PaymentChannel.participants.partA) {
        this.currentChannel.signatureA = payment.signature;
      } else {
        this.currentChannel.signatureB = payment.signature;
      }
      
      console.log(`✅ Payment processed. New balances: A=${payment.balanceA}, B=${payment.balanceB}`);
    } catch (error) {
      console.error("❌ Failed to process payment:", error);
    }
  }

  private handleChannelClose(message: NetworkMessage): void {
    console.log(`🔒 Channel close initiated by: ${message.from}`);
    this.currentChannel = message.data.channel;
  }

  private handleHeartbeat(message: NetworkMessage): void {
    // Respond to heartbeat
    const response: NetworkMessage = {
      type: "HEARTBEAT",
      from: this.networkService.getNodeInfo().address,
      to: message.from,
      data: { status: "alive" },
      timestamp: Date.now()
    };
    this.networkService.sendMessage(response);
  }

  private async getChannelFromBlockchain(): Promise<any> {
    try {
      return await this.blockchainService.getChannelInfo();
    } catch (error) {
      return null;
    }
  }

  async stop(): Promise<void> {
    console.log("🛑 Stopping Thunder node...");
    
    if (this.httpServer) {
      this.httpServer.close();
    }
    
    this.networkService.disconnect();
    console.log("✅ Thunder node stopped");
  }
}