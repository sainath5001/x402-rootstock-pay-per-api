/**
 * x402 Test Client
 * 
 * This script demonstrates the complete x402 payment flow:
 * 1. Make initial API request (receives HTTP 402)
 * 2. Extract payment instructions
 * 3. Submit payment on Rootstock (simulated - you'd use a wallet)
 * 4. Retry API request (receives HTTP 200 with data)
 * 
 * Usage:
 *   node examples/test-client.js
 * 
 * Prerequisites:
 *   - Server running on http://localhost:3000
 *   - Wallet address with RBTC balance on Rootstock testnet
 */

import { privateKeyToAccount } from 'viem/accounts';
import dotenv from 'dotenv';

dotenv.config();

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';
const SIGNER_PRIVATE_KEY = process.env.SIGNER_PRIVATE_KEY || '';

const signerAccount = SIGNER_PRIVATE_KEY
  ? privateKeyToAccount(SIGNER_PRIVATE_KEY.startsWith('0x') ? SIGNER_PRIVATE_KEY : `0x${SIGNER_PRIVATE_KEY}`)
  : null;
const WALLET_ADDRESS = process.env.WALLET_ADDRESS || signerAccount?.address || '0xYourWalletAddressHere';

if (signerAccount && process.env.WALLET_ADDRESS) {
  const envWallet = process.env.WALLET_ADDRESS.toLowerCase();
  const signerWallet = signerAccount.address.toLowerCase();
  if (envWallet !== signerWallet) {
    throw new Error(
      `WALLET_ADDRESS (${process.env.WALLET_ADDRESS}) does not match SIGNER_PRIVATE_KEY address (${signerAccount.address}).`
    );
  }
}

async function buildAuthHeaders(method, path, walletAddress) {
  if (!signerAccount) {
    throw new Error('Missing SIGNER_PRIVATE_KEY for request signing');
  }

  const timestamp = Date.now().toString();
  const nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const message = [
    'x402-auth',
    `wallet:${walletAddress.toLowerCase()}`,
    `method:${method.toUpperCase()}`,
    `path:${path}`,
    `timestamp:${timestamp}`,
    `nonce:${nonce}`,
  ].join('\n');

  const signature = await signerAccount.signMessage({ message });
  return {
    'x-wallet-address': walletAddress,
    'x-auth-signature': signature,
    'x-auth-timestamp': timestamp,
    'x-auth-nonce': nonce,
  };
}

/**
 * Step 1: Make initial API request
 * This will return HTTP 402 with payment instructions
 */
async function makeInitialRequest() {
  console.log('\n📤 Step 1: Making initial API request...\n');

  try {
    const response = await fetch(`${SERVER_URL}/api/data`, {
      method: 'GET',
      headers: await buildAuthHeaders('GET', '/api/data', WALLET_ADDRESS),
    });

    const data = await response.json();

    if (response.status === 402) {
      console.log('✅ Received HTTP 402 Payment Required\n');
      console.log('Payment Instructions:');
      console.log(JSON.stringify(data, null, 2));
      return data;
    } else if (response.status === 200) {
      console.log('✅ HTTP 200 — signature accepted, prepaid balance OK, deductPayment ran before this response.');
      if (data.payment?.deductionTxHash) {
        console.log(`   On-chain deduction tx: ${data.payment.deductionTxHash}`);
      }
      console.log('Response:', JSON.stringify(data, null, 2));
      return null;
    } else {
      console.log(`❌ Request returned HTTP ${response.status}`);
      console.log('Response:', JSON.stringify(data, null, 2));
      throw new Error(`Unexpected API status: ${response.status}`);
    }
  } catch (error) {
    console.error('❌ Request failed:', error.message);
    throw error;
  }
}

/**
 * Step 2: Display payment instructions
 * In a real implementation, this would trigger wallet interaction
 */
function displayPaymentInstructions(paymentData) {
  console.log('\n💰 Step 2: Payment Instructions\n');
  console.log('To pay for API access:');
  console.log(`  1. Contract Address: ${paymentData.payment.contract.address}`);
  console.log(`  2. Function: ${paymentData.payment.contract.function}()`);
  console.log(`  3. Amount: ${paymentData.payment.amount.formatted} ${paymentData.payment.amount.currency}`);
  console.log(`  4. Chain ID: ${paymentData.payment.network.chainId}`);
  console.log('\n📝 Example transaction (using viem or web3 library):');
  console.log(`
    import { createWalletClient, http } from 'viem';
    import { privateKeyToAccount } from 'viem/accounts';
    
    const account = privateKeyToAccount('0x...');
    const client = createWalletClient({
      account,
      chain: rootstockTestnet,
      transport: http(),
    });
    
    await client.writeContract({
      address: '${paymentData.payment.contract.address}',
      abi: ${JSON.stringify(paymentData.payment.contract.abi)},
      functionName: 'pay',
      value: BigInt('${paymentData.payment.amount.value}'),
    });
  `);
  console.log('\n⏳ Waiting for payment...');
  console.log('   (In production, wait for transaction confirmation)');
}

/**
 * Step 3: Check payment status
 */
async function checkPaymentStatus() {
  console.log('\n🔍 Step 3: Checking payment status...\n');

  try {
    const response = await fetch(`${SERVER_URL}/api/payment/status`, {
      method: 'GET',
      headers: await buildAuthHeaders('GET', '/api/payment/status', WALLET_ADDRESS),
    });

    const data = await response.json();
    console.log('Payment Status:');
    console.log(JSON.stringify(data, null, 2));

    return data.hasPaid;
  } catch (error) {
    console.error('❌ Failed to check payment status:', error.message);
    return false;
  }
}

/**
 * Step 4: Retry API request after payment
 */
async function retryRequest() {
  console.log('\n📤 Step 4: Retrying API request after payment...\n');

  try {
    const response = await fetch(`${SERVER_URL}/api/data`, {
      method: 'GET',
      headers: await buildAuthHeaders('GET', '/api/data', WALLET_ADDRESS),
    });

    const data = await response.json();

    if (response.status === 200) {
      console.log('✅ Success! Payment verified, received data:\n');
      console.log(JSON.stringify(data, null, 2));
      return data;
    } else if (response.status === 402) {
      console.log('⚠️  Still receiving HTTP 402 - payment may not be confirmed yet');
      console.log('Response:', JSON.stringify(data, null, 2));
      return null;
    } else {
      console.log(`❌ Unexpected status: ${response.status}`);
      console.log('Response:', JSON.stringify(data, null, 2));
      return null;
    }
  } catch (error) {
    console.error('❌ Request failed:', error.message);
    throw error;
  }
}

/**
 * Main test flow
 */
async function runTest() {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║           x402 Payment Flow Test Client                   ║
╚═══════════════════════════════════════════════════════════╝

Wallet Address: ${WALLET_ADDRESS}
Server URL: ${SERVER_URL}

  `);

  try {
    // Step 1: Initial request
    const paymentData = await makeInitialRequest();

    if (paymentData) {
      // Step 2: Display payment instructions
      displayPaymentInstructions(paymentData);

      // Step 3: Check payment status (simulate waiting)
      console.log('\n⏳ Simulating payment wait (5 seconds)...\n');
      await new Promise((resolve) => setTimeout(resolve, 5000));

      const hasPaid = await checkPaymentStatus();

      if (hasPaid) {
        // Step 4: Retry request
        await retryRequest();
      } else {
        console.log('\n⚠️  Payment not yet confirmed. Please:');
        console.log('   1. Send RBTC payment to the contract');
        console.log('   2. Wait for transaction confirmation');
        console.log('   3. Run this script again');
      }
    } else {
      console.log(
        '\n✅ First request succeeded with prepaid balance (no HTTP 402 this run). Each successful call still consumes one request via on-chain deductPayment.'
      );
    }

    console.log('\n✅ Test completed!\n');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
runTest();

