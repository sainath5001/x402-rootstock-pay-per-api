# x402 Pay-Per-API Backend

Node.js API that returns **HTTP 402** with **x402-style payment JSON** when prepaid RBTC balance is too low, verifies **EIP-191 signed headers** so `x-wallet-address` cannot be spoofed, and calls **`deductPayment` on-chain before** serving protected routes (true pay-per-request for this prepaid pattern).

**Positioning:** HTTP 402 + metadata follows x402 *style*; signature headers are a **custom extension** (not in the core x402 spec). Say “x402-inspired” unless you match the full spec.

## 📋 Overview

This backend server:
- Requires signed auth headers on paid routes and `/api/payment/status`
- Verifies prepaid balance on the PayPerAPI contract
- Returns HTTP 402 with payment instructions when balance is insufficient
- Submits `deductPayment` and waits for receipt before calling route handlers
- Fails fast at startup if `OWNER_PRIVATE_KEY` is missing (deduction cannot be bypassed by misconfiguration)

## 🏗️ Architecture

**Payment Flow:**
1. Client sends `x-wallet-address` plus `x-auth-signature`, `x-auth-timestamp`, `x-auth-nonce`
2. Server verifies signature (EIP-191) and rejects replays (nonce)
3. Server reads on-chain balance; if too low → HTTP 402
4. Client tops up via `pay()` on the contract if needed
5. Client retries with a **fresh** nonce/signature
6. Server runs `deductPayment`, confirms tx + balance drop, then serves the response

## 🚀 Quick Start

### Step 1: Prerequisites

- **Node.js 18+** installed
- **Deployed PayPerAPI contract** on Rootstock testnet (see `../contracts/README.md`)
- **Contract address** from deployment

### Step 2: Install Dependencies

```bash
cd backend
npm install
```

### Step 3: Configuration

1. **Create `.env` file:**

Copy the example or create new:

```bash
cp .env.example .env
```

2. **Update `.env` with your values:**

```env
ROOTSTOCK_TESTNET_RPC_URL=https://public-node.testnet.rsk.co
CONTRACT_ADDRESS=0xYourDeployedContractAddress
CHAIN_ID=31
PORT=3000

# Required: contract owner key — used to call deductPayment every paid request
OWNER_PRIVATE_KEY=0xYourContractOwnerPrivateKey

# For examples/test-client.js and examples/demonstrate-auth.js
SIGNER_PRIVATE_KEY=0xYourClientPrivateKey
WALLET_ADDRESS=0xYourClientAddress
```

**Important:** Replace `0xYourDeployedContractAddress` with your actual deployed contract address from the contracts deployment.

3. **For paying into the contract (`examples/make-payment.js`):**

```env
PAYER_PRIVATE_KEY=0xYourPrivateKey
```

### Step 4: Start the Server

```bash
npm start
```

You should see:
- Server running message
- Contract address
- Network information
- Available endpoints

### Step 5: Test the Server

**Health check (no payment required):**

```bash
curl http://localhost:3000/health
```

**Signing spec (no payment):**

```bash
curl -s http://localhost:3000/api/auth/spec
```

**Protected endpoint (use example client — signatures required):**

```bash
npm run test-client
```

**Show a signed message locally (reviewers):**

```bash
npm run demonstrate-auth
```

## 📝 API Endpoints

### Health Check
- **GET** `/health`
- **Payment Required:** No
- Returns server status and contract information

### Wallet auth spec
- **GET** `/api/auth/spec?wallet=0x...`
- **Payment Required:** No
- JSON description of headers and EIP-191 message format

### Protected Data API
- **GET** `/api/data`
- **Payment Required:** Yes (signature + prepaid deduct)
- Returns protected data only after successful on-chain deduction

### Weather API
- **GET** `/api/weather`
- **Payment Required:** Yes
- Example weather data API

### AI Inference API
- **POST** `/api/ai/infer`
- **Payment Required:** Yes
- Accepts JSON body with `prompt` field

### Payment Status
- **GET** `/api/payment/status`
- **Payment Required:** No RBTC charge, but **same signature headers as paid routes**
- Read-only balance check for the wallet in `x-wallet-address`

## 🔄 Complete Payment Flow

### Step 1: Make Initial Request

Use signed headers (see `GET /api/auth/spec` or `npm run demonstrate-auth`). Example:

```bash
npm run test-client
```

### Step 2: Receive HTTP 402 Response

If not paid, server responds with HTTP 402 and payment instructions:

- Contract address
- Required amount (e.g., 0.0001 RBTC)
- Chain ID (31 for Rootstock Testnet)
- Function to call (`pay()`)

### Step 3: Make Payment

Client pays RBTC to the contract. Options:

**Option A: Using Payment Script**

```bash
node examples/make-payment.js
```

**Option B: Using MetaMask**

1. Connect MetaMask to Rootstock Testnet (Chain ID: 31)
2. Go to contract address
3. Call `pay()` function
4. Send required amount (e.g., 0.0001 RBTC)
5. Confirm transaction

**Option C: Programmatic (using viem)**

Use the backend payment script as reference or implement your own payment flow.

### Step 4: Wait for Confirmation

Wait for transaction to be confirmed on Rootstock network (usually 1-2 blocks).

### Step 5: Retry Request

After payment is confirmed, retry with a **new** nonce/signature (the example client does this automatically):

```bash
npm run test-client
```

You should receive HTTP 200 and see `deductionTxHash` / reduced balance in the JSON.

## 🧪 Testing

### Test Payment Flow

1. **Start the server:**
   ```bash
   npm start
   ```

2. **Inspect auth format:** `curl -s http://localhost:3000/api/auth/spec | jq .`

3. **Check payment status:** extend `test-client.js` or use any HTTP client that sends the same four headers as paid routes.

4. **Make request:** `npm run test-client` (402 if underfunded)

5. **Make payment:** `node examples/make-payment.js`

6. **Retry:** `npm run test-client` (200 after top-up; each success deducts once)

### Using Test Scripts

**Full flow test:**
```bash
./examples/test-full-flow.sh 0xYourWalletAddress
```

**Curl examples:**
```bash
./examples/curl-examples.sh
```

**Node.js test client:**
```bash
npm run test-client
```
(Update wallet address in `examples/test-client.js` first)

## 📁 Project Structure

```
backend/
├── config/
│   └── rootstock.js              # Rootstock network & viem configuration
├── middleware/
│   ├── x402Payment.js            # Core payment verification middleware
│   └── x402PaymentConfig.js      # Declarative route configuration
├── examples/
│   ├── make-payment.js          # Script to make payments
│   ├── test-client.js           # Example client
│   ├── curl-examples.sh         # curl testing scripts
│   └── test-full-flow.sh        # Complete flow test
├── server.js                     # Express server with endpoints
├── package.json                  # Dependencies
├── .env                          # Configuration (gitignored)
└── README.md                     # This file
```

## ⚙️ Configuration

### Environment Variables

**Required:**
- `CONTRACT_ADDRESS` - Your deployed PayPerAPI contract address
- `ROOTSTOCK_TESTNET_RPC_URL` - Rootstock RPC endpoint
- `CHAIN_ID` - Rootstock chain ID (31 for testnet)
- `PORT` - Server port (default: 3000)

**Optional:**
- `PAYER_PRIVATE_KEY` - For using payment scripts

### x402 Route Configuration

Routes are configured in `server.js` using the x402 declarative pattern:

```javascript
app.use(
  paymentMiddleware({
    "GET /api/data": {
      accepts: ["rootstock"],
      description: "Protected data API",
    },
    // ... more routes
  })
);
```

This automatically protects configured routes with payment verification.

## 🔍 Verification Process

The middleware:

1. **Verifies EIP-191 signature** for `x-wallet-address` (`x-auth-*` headers)
2. **Reads contract state** (`hasPaid`, balance, `pricePerRequest`)
3. **Returns HTTP 402** if prepaid balance is insufficient
4. **Calls `deductPayment`** and waits for a successful receipt
5. **Re-reads balance** to ensure it decreased (guards failed/reverted txs)
6. **Calls `next()`** only after deduction succeeds — handlers never run on verification alone

Balances live on-chain; the server does not store credits in a database.

## 🌐 Network Configuration

### Rootstock Testnet
- **Chain ID:** 31
- **RPC URL:** https://public-node.testnet.rsk.co
- **Explorer:** https://explorer.testnet.rootstock.io

### Rootstock Mainnet
- **Chain ID:** 30
- **RPC URL:** https://public-node.rsk.co
- **Explorer:** https://explorer.rsk.co

Update `CHAIN_ID` and RPC URL in `.env` for mainnet deployment.

## 🔐 Security Considerations

- ✅ **On-chain balances** — Reads and deductions via the contract
- ✅ **Signatures** — `x-wallet-address` alone is not enough
- ✅ **Owner key** — Required for `deductPayment`; treat `OWNER_PRIVATE_KEY` as a high-privilege secret
- ⚠️ **Operator trust** — The API operator controls when deduction runs; this is a prepaid metering model, not anonymous blind trust in the server
- ⚠️ **Rate limiting / HTTPS** — Recommended for production
- ⚠️ **Never commit** `.env` or keys to git

## 🚀 Deployment

### Local Development

```bash
npm start
```

### Production Deployment

1. **Update `.env` for production:**
   - Use Rootstock mainnet RPC URL
   - Set `CHAIN_ID=30` for mainnet
   - Use production contract address

2. **Start server:**
   ```bash
   npm start
   ```

3. **Use process manager** (recommended):
   - PM2: `pm2 start server.js`
   - systemd: Create service file
   - Docker: Build container

4. **Set up reverse proxy** (nginx, etc.)
   - Enable HTTPS
   - Configure domain

5. **Monitor logs** for errors

## ❓ Troubleshooting

**Server won't start:**
- Check Node.js version (needs 18+)
- Verify `.env` file exists and has correct values
- If you see `OWNER_PRIVATE_KEY` fatal: set the contract owner key (required for deduction)
- Check if port 3000 is already in use

**Payment verification fails:**
- Verify contract address in `.env` is correct
- Check RPC URL is accessible
- Ensure wallet address format is valid (0x...)

**HTTP 402 not working:**
- Check middleware is properly configured
- Verify routes are included in `paymentMiddleware`
- Check server logs for errors

**Connection timeouts:**
- Rootstock RPC may be slow - try different RPC provider
- Check network connectivity
- Verify RPC URL is correct

**"Missing wallet address" error:**
- Include `x-wallet-address` header in requests
- Header must be valid Ethereum address format

## 📚 Integration Guide

### Add x402 Payment to Your Endpoint

1. **Import middleware:**
   ```javascript
   import { x402PaymentMiddleware } from './middleware/x402Payment.js';
   ```

2. **Apply to route:**
   ```javascript
   app.get('/api/your-endpoint', x402PaymentMiddleware, (req, res) => {
     // Payment verified - req.paymentInfo contains wallet details
     res.json({ data: 'Your protected data' });
   });
   ```

3. **Or use declarative pattern:**
   Add route to `paymentMiddleware` configuration in `server.js`.

## 🔗 Related Documentation

- **[Root README](../README.md)** - Project overview
- **[Contracts README](../contracts/README.md)** - Smart contract deployment
- **[x402 Documentation](https://x402.gitbook.io/x402)** - x402 standard
- **[Rootstock Docs](https://developers.rsk.co/)** - Rootstock network
- **[viem Documentation](https://viem.sh/)** - Ethereum library

## 📖 Next Steps

1. ✅ Deploy smart contract (see contracts README)
2. ✅ Configure backend with contract address
3. ✅ Start server
4. ✅ Test payment flow
5. ✅ Make a payment
6. ✅ Verify API access works
7. ✅ Deploy to production

## 📄 License

MIT
