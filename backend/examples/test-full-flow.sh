#!/bin/bash

# Test Full x402 Flow
# This script tests the complete payment flow

WALLET_ADDRESS="${1:-0xB6937d744691065a9C4c50e15667eF1c46D9996b}"
SERVER_URL="http://localhost:3000"

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║           Testing Full x402 Payment Flow                  ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""
echo "Wallet Address: $WALLET_ADDRESS"
echo ""

# Step 1: Check initial payment status
echo "1️⃣  Checking initial payment status..."
echo "─────────────────────────────────────────────────────────────"
curl -s -H "x-wallet-address: $WALLET_ADDRESS" \
  "$SERVER_URL/api/payment/status" | jq .
echo ""
echo ""

# Step 2: Make a request (should get 402)
echo "2️⃣  Making API request (should get HTTP 402)..."
echo "─────────────────────────────────────────────────────────────"
RESPONSE=$(curl -s -w "\n%{http_code}" -H "x-wallet-address: $WALLET_ADDRESS" \
  "$SERVER_URL/api/data")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "402" ]; then
  echo "✅ Received HTTP 402 Payment Required"
  echo "$BODY" | jq -r '.payment.amount.formatted' | xargs -I {} echo "   Required: {} RBTC"
  echo "$BODY" | jq -r '.payment.contract.address' | xargs -I {} echo "   Contract: {}"
else
  echo "⚠️  Unexpected status: $HTTP_CODE"
fi
echo ""
echo ""

# Step 3: Instructions for payment
echo "3️⃣  To complete the flow:"
echo "─────────────────────────────────────────────────────────────"
echo "   Option A: Use the payment script"
echo "      node examples/make-payment.js"
echo ""
echo "   Option B: Use MetaMask or another wallet"
echo "      1. Connect to Rootstock Testnet (Chain ID: 31)"
echo "      2. Send 0.0001 RBTC to contract:"
CONTRACT=$(echo "$BODY" | jq -r '.payment.contract.address' 2>/dev/null || echo "0xa1F4D43749ABEdb6a835aF9184CD0A9c194d4C8a")
echo "         $CONTRACT"
echo "      3. Call the pay() function"
echo "      4. Wait for confirmation"
echo ""
echo ""

# Step 4: After payment, check status again
echo "4️⃣  After making payment, run this to check status:"
echo "─────────────────────────────────────────────────────────────"
echo "   curl -H \"x-wallet-address: $WALLET_ADDRESS\" \\"
echo "     $SERVER_URL/api/payment/status | jq ."
echo ""
echo ""

# Step 5: Retry request after payment
echo "5️⃣  Then retry the API request:"
echo "─────────────────────────────────────────────────────────────"
echo "   curl -H \"x-wallet-address: $WALLET_ADDRESS\" \\"
echo "     $SERVER_URL/api/data | jq ."
echo ""

