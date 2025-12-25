#!/bin/bash

# x402 API Testing with curl
# 
# This script demonstrates the x402 payment flow using curl commands.
# Replace WALLET_ADDRESS with your actual wallet address.

SERVER_URL="http://localhost:3000"
WALLET_ADDRESS="0xYourWalletAddressHere"

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║           x402 API Testing - curl Examples                ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# 1. Health Check (No payment required)
echo "1️⃣  Health Check"
echo "─────────────────────────────────────────────────────────────"
curl -s "$SERVER_URL/health" | jq .
echo ""
echo ""

# 2. Check Payment Status
echo "2️⃣  Check Payment Status"
echo "─────────────────────────────────────────────────────────────"
curl -s -H "x-wallet-address: $WALLET_ADDRESS" \
  "$SERVER_URL/api/payment/status" | jq .
echo ""
echo ""

# 3. Make API Request (Will get HTTP 402 if not paid)
echo "3️⃣  Make Protected API Request"
echo "─────────────────────────────────────────────────────────────"
echo "If not paid, you'll receive HTTP 402 with payment instructions:"
echo ""
RESPONSE=$(curl -s -w "\n%{http_code}" -H "x-wallet-address: $WALLET_ADDRESS" \
  "$SERVER_URL/api/data")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "402" ]; then
  echo "Received HTTP 402 Payment Required:"
  echo "$BODY" | jq .
  echo ""
  echo "📝 Next steps:"
  echo "   1. Send RBTC payment to the contract address shown above"
  echo "   2. Wait for transaction confirmation"
  echo "   3. Run this script again to retry the request"
elif [ "$HTTP_CODE" = "200" ]; then
  echo "✅ Payment verified! Received data:"
  echo "$BODY" | jq .
else
  echo "Unexpected response (HTTP $HTTP_CODE):"
  echo "$BODY" | jq .
fi
echo ""
echo ""

# 4. Weather API Example
echo "4️⃣  Weather API Example"
echo "─────────────────────────────────────────────────────────────"
curl -s -H "x-wallet-address: $WALLET_ADDRESS" \
  "$SERVER_URL/api/weather" | jq .
echo ""
echo ""

# 5. AI Inference API Example
echo "5️⃣  AI Inference API Example"
echo "─────────────────────────────────────────────────────────────"
curl -s -X POST \
  -H "x-wallet-address: $WALLET_ADDRESS" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "What is x402?"}' \
  "$SERVER_URL/api/ai/infer" | jq .
echo ""

