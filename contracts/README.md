# PayPerAPI Smart Contract

A minimal, production-quality smart contract for pay-per-request API access using RBTC on Rootstock. This contract supports the x402 (HTTP 402 Payment Required) payment standard, enabling APIs to request on-chain payments before serving responses.

## 📋 Overview

The `PayPerAPI` contract is a smart contract deployed on Rootstock that:
- Accepts RBTC payments from clients
- Tracks payment balances per wallet address
- Allows API servers to verify payments on-chain
- Enables the contract owner to withdraw accumulated funds

## ✨ Contract Features

- **Fixed Price**: Configurable price per API request (set during deployment)
- **Payment Tracking**: Stores total payments made by each wallet address
- **Balance Queries**: Multiple functions to check payment status
- **Accumulated Balance**: Clients can pay once and make multiple requests
- **Owner Controls**: Owner can withdraw funds and manage payments

## 🚀 Quick Start

### Step 1: Prerequisites

- **Foundry** installed ([Install Foundry](https://book.getfoundry.sh/getting-started/installation))
- **RBTC on Rootstock Testnet** (get from [faucet](https://faucet.testnet.rsk.co))
- **Private Key** of wallet with RBTC for gas fees

### Step 2: Install Dependencies

Navigate to the contracts folder and install Foundry dependencies:

```bash
cd contracts
forge install
```

### Step 3: Build the Contract

Compile the smart contract:

```bash
forge build
```

You should see "Compiler run successful!" if everything is correct.

### Step 4: Run Tests

Verify the contract works correctly:

```bash
forge test
```

All 14 tests should pass. This ensures the contract logic is correct.

## 📝 Configuration

### Environment Setup

Create a `.env` file in the `contracts` folder (or export environment variables):

- `PRIVATE_KEY` - Your deployer wallet private key (without 0x prefix, or script will add it)
- `ROOTSTOCK_TESTNET_RPC_URL` - RPC endpoint (default: https://public-node.testnet.rsk.co)
- `PRICE_PER_REQUEST` - Price in wei (optional, defaults to 0.001 RBTC = 1000000000000000 wei)

### Price Configuration

The price per API request is set during contract deployment. Common values:

- 0.0001 RBTC = 100000000000000 wei
- 0.001 RBTC = 1000000000000000 wei (default)
- 0.01 RBTC = 10000000000000000 wei

Set this in your `.env` file or export it as an environment variable before deployment.

## 🚢 Deployment

### Deploy to Rootstock Testnet

1. **Set your environment variables:**

```bash
export PRIVATE_KEY=your_private_key_here
export ROOTSTOCK_TESTNET_RPC_URL=https://public-node.testnet.rsk.co
```

2. **Deploy the contract:**

```bash
forge script script/DeployPayPerAPI.s.sol:DeployPayPerAPI \
  --rpc-url $ROOTSTOCK_TESTNET_RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --legacy
```

The `--legacy` flag is needed because Rootstock uses legacy transaction format.

3. **Save the contract address:**

After deployment, you'll see output like:
- Contract Address: `0x...`
- Transaction Hash: `0x...`
- Block Number: `...`

**Save the contract address** - you'll need it for the backend configuration.

4. **View on Explorer:**

Visit: `https://explorer.testnet.rootstock.io/address/YOUR_CONTRACT_ADDRESS`

### Customize Price (Optional)

To set a different price per request:

```bash
export PRICE_PER_REQUEST=100000000000000  # 0.0001 RBTC in wei
forge script script/DeployPayPerAPI.s.sol:DeployPayPerAPI \
  --rpc-url $ROOTSTOCK_TESTNET_RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --legacy
```

## 🔍 Verification Steps

After deployment, verify everything works:

### 1. Check Contract on Explorer

- Open Rootstock Testnet Explorer
- Search for your contract address
- Verify it's deployed and contract code is visible

### 2. Verify Contract Functions

The contract should have these public functions visible:
- `pay()` - payable function
- `hasPaid(address)` - view function
- `getPaymentBalance(address)` - view function
- `pricePerRequest()` - view function

### 3. Test Payment (Optional)

You can test making a payment using:
- MetaMask connected to Rootstock Testnet
- The backend payment script (`backend/examples/make-payment.js`)
- Direct contract interaction via Explorer

## 📊 Contract Functions Reference

### Public Functions (Anyone can call)

**`pay()`**
- Accepts RBTC payments
- Accumulates balance for the sender
- Emits `PaymentReceived` event

**`hasPaid(address payer)`**
- Returns `true` if payer has sufficient balance
- Returns `false` if balance is less than price per request

**`getPaymentBalance(address payer)`**
- Returns total RBTC paid by an address
- Returns balance in wei

**`getAvailableRequests(address payer)`**
- Calculates how many API requests can be made
- Based on current balance divided by price per request

**`getContractBalance()`**
- Returns total RBTC held by the contract

**`pricePerRequest()`**
- Returns the fixed price per API request (in wei)

### Owner Functions (Only contract owner)

**`deductPayment(address payer, uint256 amount)`**
- Deducts payment from payer's balance
- Useful for tracking per-request usage
- Only owner can call this

**`withdraw()`**
- Withdraws all accumulated RBTC to owner
- Only owner can call this

## 📡 Events

**`PaymentReceived(address indexed payer, uint256 amount, uint256 newBalance)`**
- Emitted when someone makes a payment
- Includes payer address, amount paid, and new total balance

**`FundsWithdrawn(address indexed to, uint256 amount)`**
- Emitted when owner withdraws funds
- Includes recipient address and amount withdrawn

## 🧪 Testing

The contract includes comprehensive tests covering:

- ✅ Contract initialization and configuration
- ✅ Payment functionality and balance accumulation
- ✅ Payment verification logic
- ✅ Multiple payments from same address
- ✅ Payment deduction by owner
- ✅ Withdrawal functionality
- ✅ Access control (owner-only functions)
- ✅ Error handling (insufficient balance, zero payments, etc.)
- ✅ End-to-end x402 flow simulation

### Run Tests

```bash
# All tests
forge test

# Verbose output
forge test -vvv

# Specific test
forge test --match-test test_Pay

# With gas report
forge test --gas-report
```

## 🌐 Network Information

### Rootstock Testnet
- **Chain ID**: 31
- **RPC URL**: https://public-node.testnet.rsk.co
- **Explorer**: https://explorer.testnet.rootstock.io
- **Faucet**: https://faucet.testnet.rsk.co
- **Native Currency**: RBTC (Rootstock Bitcoin)
- **Transaction Format**: Legacy (use `--legacy` flag)

### Rootstock Mainnet
- **Chain ID**: 30
- **RPC URL**: https://public-node.rsk.co
- **Explorer**: https://explorer.rsk.co

## 🔐 Security Considerations

- ✅ **Owner Control**: Only owner can withdraw funds and deduct payments
- ✅ **Immutable Price**: Price per request cannot be changed after deployment
- ✅ **Balance Accumulation**: Clients can pay once and use multiple times
- ✅ **No Reentrancy Issues**: Simple transfers, no complex logic
- ⚠️ **Access Control**: Owner functions protected by `msg.sender == owner`
- ⚠️ **Production**: Consider adding rate limiting and additional checks for production use

## 🔗 Integration with Backend

After deployment, you need to:

1. **Update Backend Configuration**
   - Add contract address to `backend/.env`
   - Set `CONTRACT_ADDRESS=your_deployed_contract_address`

2. **Backend Verification**
   - Backend will call `hasPaid(address)` to verify payments
   - Backend reads payment status before serving API requests

3. **Payment Flow**
   - Client pays → Contract records → Backend verifies → API served

See `../backend/README.md` for detailed backend setup instructions.

## 📚 Next Steps

1. ✅ Deploy contract to Rootstock Testnet
2. ✅ Save contract address
3. ✅ Configure backend with contract address
4. ✅ Test payment flow end-to-end
5. ✅ Deploy backend API server
6. ✅ Test full x402 payment flow

## 📖 Additional Resources

- [Foundry Documentation](https://book.getfoundry.sh/)
- [Rootstock Documentation](https://developers.rsk.co/)
- [x402 Payment Standard](https://x402.gitbook.io/x402)
- [Rootstock Testnet Explorer](https://explorer.testnet.rootstock.io)

## ❓ Troubleshooting

**Deployment fails:**
- Check you have RBTC in your wallet for gas
- Verify RPC URL is correct and accessible
- Ensure private key format is correct
- Try using `--legacy` flag for transaction format

**Contract not visible on Explorer:**
- Wait a few minutes for block confirmation
- Check transaction hash in Explorer
- Verify contract address is correct

**Tests failing:**
- Run `forge clean` and rebuild
- Check Solidity version matches (0.8.20)
- Ensure all dependencies are installed

**Payment not working:**
- Verify contract address in backend configuration
- Check RPC connection is working
- Ensure wallet address format is correct (0x...)
