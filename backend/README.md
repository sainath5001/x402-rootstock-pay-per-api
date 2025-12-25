# x402 Pay-Per-API Backend

A Node.js REST API server that implements the **x402 payment standard** for pay-per-request API access using **Rootstock (RBTC)**. This enables Bitcoin-secured, permissionless API monetization.

## 📋 Overview

This backend server:
- Returns HTTP 402 Payment Required when clients haven't paid
- Verifies on-chain payments using Rootstock smart contracts
- Serves API responses after payment verification
- Implements x402-compatible payment instructions

## 🏗️ Architecture

**Payment Flow:**
1. Client makes API request with wallet address
2. Server checks payment status on Rootstock contract
3. If not paid: Returns HTTP 402 with payment instructions
4. Client pays RBTC to contract
5. Client retries request
6. Server verifies payment and serves API response

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
```

**Important:** Replace `0xYourDeployedContractAddress` with your actual deployed contract address from the contracts deployment.

3. **Optional - For making payments:**

If you want to use the payment script, add:

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

**Protected endpoint (requires payment):**

```bash
curl -H "x-wallet-address: 0xYourWalletAddress" \
  http://localhost:3000/api/data
```

If not paid, you'll receive HTTP 402 with payment instructions.

## 📝 API Endpoints

### Health Check
- **GET** `/health`
- **Payment Required:** No
- Returns server status and contract information

### Protected Data API
- **GET** `/api/data`
- **Payment Required:** Yes
- Returns protected data after payment verification

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
- **Payment Required:** No
- Check payment status for a wallet address

## 🔄 Complete Payment Flow

### Step 1: Make Initial Request

Client makes API request with wallet address in header:

```bash
curl -H "x-wallet-address: 0xYourAddress" \
  http://localhost:3000/api/data
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

After payment is confirmed, retry the same API request:

```bash
curl -H "x-wallet-address: 0xYourAddress" \
  http://localhost:3000/api/data
```

You should now receive HTTP 200 with the API data instead of HTTP 402.

## 🧪 Testing

### Test Payment Flow

1. **Start the server:**
   ```bash
   npm start
   ```

2. **Check payment status:**
   ```bash
   curl -H "x-wallet-address: 0xYourAddress" \
     http://localhost:3000/api/payment/status
   ```

3. **Make request (will get 402):**
   ```bash
   curl -H "x-wallet-address: 0xYourAddress" \
     http://localhost:3000/api/data
   ```

4. **Make payment:**
   ```bash
   node examples/make-payment.js
   ```

5. **Retry request (should work now):**
   ```bash
   curl -H "x-wallet-address: 0xYourAddress" \
     http://localhost:3000/api/data
   ```

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

The middleware verifies payments by:

1. **Extract wallet address** from `x-wallet-address` header
2. **Query contract** using `hasPaid(address)` function
3. **Check balance** to determine if sufficient funds
4. **Return HTTP 402** with payment instructions if not paid
5. **Allow request** to proceed if payment verified

All verification happens on-chain - no database required.

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

- ✅ **On-Chain Verification** - Payments verified on blockchain, not database
- ✅ **Trustless** - No need to trust the server
- ✅ **Address Validation** - Wallet addresses are validated
- ✅ **Immutable Records** - Payment history stored on-chain
- ⚠️ **Rate Limiting** - Consider adding for production
- ⚠️ **HTTPS** - Always use HTTPS in production
- ⚠️ **Private Keys** - Never commit private keys to git

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
