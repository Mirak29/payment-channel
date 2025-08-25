# Thunder Payment Channel Demo

This demonstration shows a complete payment channel workflow between two parties.

## Prerequisites

1. **Terminal Setup**: You'll need 4 terminal windows:
   - Terminal 1: Blockchain node
   - Terminal 2: Thunder Node A
   - Terminal 3: Thunder Node B  
   - Terminal 4: CLI commands

2. **Initial Setup**: Run the setup script first:
   ```bash
   ./scripts/setup.sh
   ```

## Step-by-Step Demo

### 1. Start Local Blockchain (Terminal 1)
```bash
npm run node
```
Wait for "Started HTTP and WebSocket JSON-RPC server at http://127.0.0.1:8545/"

### 2. Deploy Smart Contracts (Terminal 4)
```bash
npm run smart-deploy
```
This professionally deploys THD tokens and creates PaymentChannel contract for your specific wallets - **no hardcoding!**

### 3. Start Thunder Nodes

**Terminal 2 (Node A):**
```bash
npm run dev
```

**Terminal 3 (Node B):**
```bash
npm run dev -- --port 2003
```

### 4. Import Wallets (Terminal 4)

**Import wallet for Node A:**
```bash
npm run cli importwallet "test test test test test test test test test test test junk"
```

**Import wallet for Node B:**
```bash
npm run cli -- --port 2003 importwallet "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
```

### 5. Check Initial Balances

**Node A balance:**
```bash
npm run cli balance
```

**Node B balance:**
```bash
npm run cli -- --port 2003 balance
```

### 6. Connect Nodes

**From Node B, connect to Node A:**
```bash
npm run cli -- --port 2003 connect localhost:2001
```

**Verify connection:**
```bash
npm run cli infos
npm run cli -- --port 2003 infos
```

### 7. Open Payment Channel

**Fund channel from Node A:**
```bash
npm run cli openchannel
```

**Fund channel from Node B:**
```bash
npm run cli -- --port 2003 openchannel
```

**Check channel status:**
```bash
npm run cli infos
```

### 8. Make Payments

**Node A sends 10 THD to Node B:**
```bash
npm run cli pay 10
```

**Node B sends 5 THD back to Node A:**
```bash
npm run cli -- --port 2003 pay 5
```

**Node A sends another 3 THD:**
```bash
npm run cli pay 3
```

**Check balances after payments:**
```bash
npm run cli balance
npm run cli -- --port 2003 balance
```

### 9. Close Channel

**Initiate channel closure:**
```bash
npm run cli closechannel
```

**Check channel status (should be CLOSING):**
```bash
npm run cli infos
```

### 10. Wait for Challenge Period

The challenge period is 24 blocks (about 6 minutes on mainnet, instant in local testnet).

**Check if ready to withdraw:**
```bash
npm run cli infos
```

### 11. Withdraw Funds

**Node A withdraws:**
```bash
npm run cli withdraw
```

**Node B withdraws:**
```bash
npm run cli -- --port 2003 withdraw
```

**Verify final balances:**
```bash
npm run cli balance
npm run cli -- --port 2003 balance
```

## Expected Results

> **Note**: The smart deployment automatically detects wallet addresses from mnemonics and creates contracts specifically for them - completely professional!

### Initial State
- Node A: 500 THD (from smart deployment)
- Node B: 500 THD (from smart deployment)
- Channel: Not active

### After Channel Opening
- Channel State: ACTIVE
- Channel Balance A: 100 THD
- Channel Balance B: 100 THD
- Total Channel: 200 THD

### After Payments (A→10→B, B→5→A, A→3→B)
- Channel Balance A: 100 - 10 + 5 - 3 = 92 THD
- Channel Balance B: 100 + 10 - 5 + 3 = 108 THD
- Total: Still 200 THD (conservation)

### After Withdrawal
- Node A: 400 + 92 = 492 THD (lost 8 net)
- Node B: 400 + 108 = 508 THD (gained 8 net)
- Channel: CLOSED, 0 THD

## Port Configuration Reference

| Component | Node A | Node B | Purpose |
|-----------|---------|---------|---------|
| **CLI API** | 2001 | 2003 | HTTP server for CLI commands |
| **P2P Network** | 2002 | 2004 | Socket.io for node communication |

**CLI Commands:**
- Node A: `npm run cli` (connects to port 2001)
- Node B: `npm run cli -- --port 2003` (connects to port 2003)

**Node Connection:**
- Node B connects to Node A: `connect localhost:2001` (uses P2P ports automatically)

## Troubleshooting

### Common Issues

**"Cannot connect to Thunder node"**
- Make sure thunderd is running on correct port
- Check port numbers: CLI uses API port (2001/2003), not P2P port
- Verify ports are not blocked: `lsof -i :2001`

**"Wallet not loaded"**
- Import wallet first with correct mnemonic

**"No active channel"**
- Both nodes must fund the channel
- Wait for blockchain confirmation

**"Challenge period not over"**
- Wait for 24 blocks to pass
- In local testnet, mine blocks manually if needed

### Advanced Testing

**Test Challenge Mechanism:**
1. Close channel with old state
2. Use `challenge` command with newer signed state
3. Challenger should receive full channel balance

**Test Network Resilience:**
1. Disconnect and reconnect nodes
2. Verify state synchronization
3. Test payment after reconnection

## Performance Notes

- **Local Testnet**: Instant transactions
- **Real Network**: ~15 second block times
- **Channel Operations**: Off-chain, instant
- **Challenge Period**: 24 blocks (~6 minutes on mainnet)

This completes the full payment channel lifecycle demonstration!