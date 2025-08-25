export interface ChannelState {
  partA: string;
  partB: string;
  amount: string;
  state: 'EMPTY' | 'ACTIVE' | 'CLOSING' | 'CLOSED';
  nonce: number;
  balanceA: string;
  balanceB: string;
  closingBlock?: number;
  contractAddress?: string;
  signatureA?: string; // Latest signature from participant A
  signatureB?: string; // Latest signature from participant B
}

export interface PaymentMessage {
  nonce: number;
  balanceA: string;
  balanceB: string;
  signature: string; // Required signature from sender
}

export interface NodeInfo {
  address: string;
  port: number;
  connectedPeers: string[];
  channel?: ChannelState;
}

export interface WalletInfo {
  address: string;
  privateKey?: string;
  mnemonic?: string;
}

export interface NetworkMessage {
  type: 'CONNECT' | 'CHANNEL_OPEN' | 'PAYMENT' | 'CHANNEL_CLOSE' | 'HEARTBEAT';
  from: string;
  to?: string;
  data: any;
  timestamp: number;
}

export interface DeploymentInfo {
  network: string;
  deployer: string;
  contracts: {
    THDToken: {
      address: string;
      deploymentBlock: number;
    };
    PaymentChannel: {
      address: string;
      deploymentBlock: number;
      participants: {
        partA: string;
        partB: string;
      };
      channelAmount: string;
    };
  };
  participants: {
    [address: string]: {
      address: string;
      initialBalance: string;
    };
  };
}