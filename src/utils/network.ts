import { Server, Socket } from "socket.io";
import { io as Client, Socket as ClientSocket } from "socket.io-client";
import { NetworkMessage, NodeInfo } from "./types";

export class NetworkService {
  private server?: Server;
  private client?: ClientSocket;
  private nodeInfo: NodeInfo;
  private connectedPeers: Map<string, Socket> = new Map();
  private messageHandlers: Map<string, (message: NetworkMessage) => void> = new Map();

  constructor(port: number, address: string) {
    this.nodeInfo = {
      address,
      port,
      connectedPeers: []
    };
  }

  async startServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const { createServer } = require("http");
        const httpServer = createServer();
        
        this.server = new Server(httpServer, {
          cors: {
            origin: "*",
            methods: ["GET", "POST"]
          }
        });

        this.server.on("connection", (socket: Socket) => {
          console.log(`🔗 New peer connected: ${socket.id}`);
          
          socket.on("register", (peerAddress: string) => {
            this.connectedPeers.set(peerAddress, socket);
            this.nodeInfo.connectedPeers.push(peerAddress);
            console.log(`✅ Peer registered: ${peerAddress}`);
            
            // Send acknowledgment
            socket.emit("registered", this.nodeInfo.address);
          });

          socket.on("message", (networkMessage: NetworkMessage) => {
            console.log(`📨 Received message from ${networkMessage.from}:`, networkMessage.type);
            this.handleIncomingMessage(networkMessage);
          });

          socket.on("disconnect", () => {
            console.log(`❌ Peer disconnected: ${socket.id}`);
            // Remove from connected peers
            for (const [address, peerSocket] of this.connectedPeers.entries()) {
              if (peerSocket.id === socket.id) {
                this.connectedPeers.delete(address);
                const index = this.nodeInfo.connectedPeers.indexOf(address);
                if (index > -1) {
                  this.nodeInfo.connectedPeers.splice(index, 1);
                }
                break;
              }
            }
          });
        });

        httpServer.listen(this.nodeInfo.port, () => {
          console.log(`🚀 Thunder node listening on port ${this.nodeInfo.port}`);
          resolve();
        });

        httpServer.on("error", (error: any) => {
          console.error(`❌ Failed to start server:`, error);
          reject(error);
        });

      } catch (error) {
        console.error(`❌ Server startup error:`, error);
        reject(error);
      }
    });
  }

  async connectToPeer(peerAddress: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const [host, port] = peerAddress.split(":");
        const url = `http://${host}:${port}`;
        
        console.log(`🔌 Connecting to peer: ${url}`);
        
        this.client = Client(url);

        this.client.on("connect", () => {
          console.log(`✅ Connected to peer: ${peerAddress}`);
          
          // Register with the peer
          this.client!.emit("register", this.nodeInfo.address);
        });

        this.client.on("registered", (peerNodeAddress: string) => {
          console.log(`🤝 Registered with peer: ${peerNodeAddress}`);
          this.nodeInfo.connectedPeers.push(peerAddress);
          resolve();
        });

        this.client.on("message", (networkMessage: NetworkMessage) => {
          console.log(`📨 Received message from peer:`, networkMessage.type);
          this.handleIncomingMessage(networkMessage);
        });

        this.client.on("disconnect", () => {
          console.log(`❌ Disconnected from peer: ${peerAddress}`);
          const index = this.nodeInfo.connectedPeers.indexOf(peerAddress);
          if (index > -1) {
            this.nodeInfo.connectedPeers.splice(index, 1);
          }
        });

        this.client.on("connect_error", (error) => {
          console.error(`❌ Connection error:`, error.message);
          reject(error);
        });

        // Set timeout for connection
        setTimeout(() => {
          if (!this.client || !this.client.connected) {
            reject(new Error("Connection timeout"));
          }
        }, 5000);

      } catch (error) {
        console.error(`❌ Connection error:`, error);
        reject(error);
      }
    });
  }

  sendMessage(message: NetworkMessage): void {
    if (message.to) {
      // Send to specific peer
      const peerSocket = this.connectedPeers.get(message.to);
      if (peerSocket) {
        peerSocket.emit("message", message);
      } else if (this.client && this.client.connected) {
        this.client.emit("message", message);
      } else {
        console.error(`❌ Peer not found or not connected: ${message.to}`);
      }
    } else {
      // Broadcast to all peers
      this.broadcastMessage(message);
    }
  }

  private broadcastMessage(message: NetworkMessage): void {
    // Send to server peers
    for (const socket of this.connectedPeers.values()) {
      socket.emit("message", message);
    }
    
    // Send to client peer
    if (this.client && this.client.connected) {
      this.client.emit("message", message);
    }
  }

  private handleIncomingMessage(message: NetworkMessage): void {
    const handler = this.messageHandlers.get(message.type);
    if (handler) {
      handler(message);
    } else {
      console.warn(`⚠️  No handler found for message type: ${message.type}`);
    }
  }

  onMessage(type: string, handler: (message: NetworkMessage) => void): void {
    this.messageHandlers.set(type, handler);
  }

  getNodeInfo(): NodeInfo {
    return { ...this.nodeInfo };
  }

  setChannel(channel: any): void {
    this.nodeInfo.channel = channel;
  }

  isConnected(): boolean {
    return this.connectedPeers.size > 0 || (this.client && this.client.connected) || false;
  }

  disconnect(): void {
    if (this.client) {
      this.client.disconnect();
    }
    
    if (this.server) {
      this.server.close();
    }
    
    this.connectedPeers.clear();
    this.nodeInfo.connectedPeers = [];
  }
}