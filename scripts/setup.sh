#!/bin/bash

echo "🚀 Thunder Payment Channel Setup Script"
echo "======================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 16 or higher."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node --version | sed 's/v//')
REQUIRED_VERSION="16.0.0"

if ! node -p "require('semver').gte('$NODE_VERSION', '$REQUIRED_VERSION')" &> /dev/null; then
    echo "⚠️  Node.js version $NODE_VERSION detected. Version 16+ recommended."
fi

echo "✅ Node.js version: $(node --version)"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

# Compile smart contracts
echo "🔨 Compiling smart contracts..."
npm run compile

if [ $? -ne 0 ]; then
    echo "❌ Failed to compile smart contracts"
    exit 1
fi

# Run tests
echo "🧪 Running smart contract tests..."
npm test

if [ $? -ne 0 ]; then
    echo "❌ Tests failed"
    exit 1
fi

# Build TypeScript
echo "🏗️  Building TypeScript..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Failed to build TypeScript"
    exit 1
fi

echo ""
echo "✅ Setup completed successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Start local blockchain: npm run node"
echo "2. Deploy contracts: npm run deploy"
echo "3. Start Thunder node: npm run dev"
echo "4. Use CLI: npm run cli --help"
echo ""
echo "📖 Read README.md for detailed usage instructions"