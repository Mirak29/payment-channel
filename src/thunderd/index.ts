#!/usr/bin/env node

import { Command } from "commander";
import { ThunderNode } from "./ThunderNode";

const program = new Command();

program
  .name("thunderd")
  .description("Thunder Payment Channel Node")
  .version("0.0.1")
  .option("--rpc <ip:port>", "RPC entry point for blockchain", "localhost:8545")
  .option("--port <port>", "Port for this node", "2000")
  .option("--help", "Print this help message and exit")
  .parse();

const options = program.opts();

if (options.help) {
  console.log(`
Thunder version v0.0.1

Usage:  thunderd [options]                     Start Thunder

Options:

  --help
Print this help message and exit

  --rpc <IP:Port>
Specify the RPC entry point at which a compatible blockchain is available. Otherwise, default is localhost:8545

  --port <port>
Specify the port at which this node is available. Default is 2000
`);
  process.exit(0);
}

async function main() {
  try {
    const rpcUrl = `http://${options.rpc}`;
    const port = parseInt(options.port);
    const nodeAddress = `localhost:${port}`;

    console.log(`⚡ Starting Thunder Node...`);
    console.log(`🌐 RPC URL: ${rpcUrl}`);
    console.log(`📡 Node Address: ${nodeAddress}`);
    
    const thunderNode = new ThunderNode(rpcUrl, port, nodeAddress);
    await thunderNode.start();
    
    // Handle graceful shutdown
    process.on("SIGINT", async () => {
      console.log("\n🛑 Shutting down Thunder node...");
      await thunderNode.stop();
      process.exit(0);
    });

    process.on("SIGTERM", async () => {
      console.log("\n🛑 Shutting down Thunder node...");
      await thunderNode.stop();
      process.exit(0);
    });

  } catch (error) {
    console.error("❌ Failed to start Thunder node:", error);
    process.exit(1);
  }
}

main();