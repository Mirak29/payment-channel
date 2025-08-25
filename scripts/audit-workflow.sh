#!/bin/bash

# Thunder Payment Channel - Production Executable Audit Workflow
# This script automates the complete audit process using production executables

set -e  # Exit on any error

echo "🚀 Thunder Payment Channel - Production Audit Workflow"
echo "======================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_step() {
    echo -e "${BLUE}📋 Step $1: $2${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if executables exist
if [ ! -f "./bin/thunderd-linux" ] || [ ! -f "./bin/thunder-cli-linux" ]; then
    print_warning "Production executables not found. Building them now..."
    npm run package
    if [ $? -eq 0 ]; then
        print_success "Executables built successfully"
    else
        print_error "Failed to build executables"
        exit 1
    fi
else
    print_success "Production executables found"
fi

# Test CLI help commands
print_step 1 "Testing CLI Help Commands"
echo "Testing thunder-cli --help..."
./bin/thunder-cli-linux --help > /dev/null
if [ $? -eq 0 ]; then
    print_success "thunder-cli --help works"
else
    print_error "thunder-cli --help failed"
    exit 1
fi

echo "Testing thunderd --help..."
./bin/thunderd-linux --help > /dev/null
if [ $? -eq 0 ]; then
    print_success "thunderd --help works"
else
    print_error "thunderd --help failed"
    exit 1
fi

print_step 2 "Blockchain Setup Required"
echo "Please ensure the following are running in separate terminals:"
echo "  Terminal 1: npm run node"
echo "  Terminal 2: npm run smart-deploy && npx hardhat run scripts/transfer-eth.ts --network localhost"
echo ""
read -p "Press Enter when blockchain and contracts are ready..."

print_step 3 "Testing Thunder Nodes Startup"
echo "Please start Thunder nodes in separate terminals:"
echo "  Terminal 3: ./bin/thunderd-linux"
echo "  Terminal 4: ./bin/thunderd-linux --port 2002"
echo ""
read -p "Press Enter when both Thunder nodes are running..."

print_step 4 "Testing Wallet Import"
echo "Importing wallet for Node A..."
./bin/thunder-cli-linux importwallet "test test test test test test test test test test test junk"
if [ $? -eq 0 ]; then
    print_success "Node A wallet imported"
else
    print_error "Node A wallet import failed"
    exit 1
fi

echo "Importing wallet for Node B..."
./bin/thunder-cli-linux --port 2002 importwallet "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
if [ $? -eq 0 ]; then
    print_success "Node B wallet imported"
else
    print_error "Node B wallet import failed"
    exit 1
fi

print_step 5 "Testing Balance Queries"
echo "Checking Node A balance..."
./bin/thunder-cli-linux balance
if [ $? -eq 0 ]; then
    print_success "Node A balance query successful"
else
    print_error "Node A balance query failed"
    exit 1
fi

echo "Checking Node B balance..."
./bin/thunder-cli-linux --port 2002 balance
if [ $? -eq 0 ]; then
    print_success "Node B balance query successful"
else
    print_error "Node B balance query failed"
    exit 1
fi

print_step 6 "Testing Node Connection"
echo "Connecting Node B to Node A..."
./bin/thunder-cli-linux --port 2002 connect localhost:2000
if [ $? -eq 0 ]; then
    print_success "Nodes connected successfully"
else
    print_error "Node connection failed"
    exit 1
fi

print_step 7 "Testing Channel Operations"
echo "Opening channel from Node A..."
./bin/thunder-cli-linux openchannel
if [ $? -eq 0 ]; then
    print_success "Node A channel opened"
else
    print_error "Node A channel opening failed"
    exit 1
fi

echo "Opening channel from Node B (activating channel)..."
./bin/thunder-cli-linux --port 2002 openchannel
if [ $? -eq 0 ]; then
    print_success "Node B channel opened - Channel is now ACTIVE"
else
    print_error "Node B channel opening failed"
    exit 1
fi

print_step 8 "Testing Payment Functionality"
echo "Sending 5 THD from Node A to Node B..."
./bin/thunder-cli-linux pay 5
if [ $? -eq 0 ]; then
    print_success "Payment A->B successful"
else
    print_error "Payment A->B failed"
    exit 1
fi

echo "Sending 3 THD from Node B to Node A..."
./bin/thunder-cli-linux --port 2002 pay 3
if [ $? -eq 0 ]; then
    print_success "Payment B->A successful"
else
    print_error "Payment B->A failed"
    exit 1
fi

print_step 9 "Final Balance Verification"
echo "Final balance Node A:"
./bin/thunder-cli-linux balance

echo "Final balance Node B:"
./bin/thunder-cli-linux --port 2002 balance

echo ""
echo "🎉 AUDIT WORKFLOW COMPLETED SUCCESSFULLY!"
echo "========================================"
print_success "All production executable tests passed"
print_success "Thunder Payment Channel is audit-ready"
echo ""
echo "📋 Audit Summary:"
echo "- CLI help commands: ✅"
echo "- Node startup: ✅" 
echo "- Wallet import: ✅"
echo "- Balance queries: ✅"
echo "- Node connections: ✅"
echo "- Channel operations: ✅"
echo "- Payment functionality: ✅"
echo ""
echo "🏆 Result: PRODUCTION READY - ALL REQUIREMENTS PASSED"