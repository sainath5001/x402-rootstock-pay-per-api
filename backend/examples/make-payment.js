/**
 * Make Payment Script
 * 
 * This script helps you make a payment to the PayPerAPI contract
 * so you can test the full x402 flow.
 * 
 * Usage:
 *   1. Set your private key in .env or as environment variable
 *   2. Run: node examples/make-payment.js
 * 
 * WARNING: Never commit your private key to git!
 */

import { createWalletClient, http, parseEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { rootstockTestnet, CONTRACT_ADDRESS, payPerAPIContractABI } from '../config/rootstock.js';
import dotenv from 'dotenv';

dotenv.config();

// Get private key from environment
const PRIVATE_KEY = process.env.PRIVATE_KEY || process.env.PAYER_PRIVATE_KEY;

if (!PRIVATE_KEY || PRIVATE_KEY === '0xYourPrivateKeyHere' || PRIVATE_KEY.includes('YourPrivateKey')) {
    console.error('❌ Error: PRIVATE_KEY or PAYER_PRIVATE_KEY not set or is placeholder');
    console.log('\n📝 Please set your actual private key:');
    console.log('\n  Option 1: Add to .env file');
    console.log('    PAYER_PRIVATE_KEY=0xYourActualPrivateKey64Characters');
    console.log('\n  Option 2: Export as environment variable');
    console.log('    export PAYER_PRIVATE_KEY=0xYourActualPrivateKey64Characters');
    console.log('\n⚠️  WARNING: Never share your private key!');
    console.log('   Use a testnet wallet with testnet RBTC only.');
    console.log('\n💡 Don\'t have a testnet wallet?');
    console.log('   1. Create one in MetaMask');
    console.log('   2. Get testnet RBTC from: https://faucet.testnet.rsk.co');
    console.log('   3. Export the private key (Settings > Security & Privacy > Show Private Key)');
    process.exit(1);
}

// Validate private key format
if (!PRIVATE_KEY.startsWith('0x')) {
    console.error('❌ Error: Private key must start with 0x');
    process.exit(1);
}

if (PRIVATE_KEY.length !== 66) {
    console.error('❌ Error: Private key must be 66 characters (0x + 64 hex characters)');
    console.log(`   Your key length: ${PRIVATE_KEY.length}`);
    process.exit(1);
}

async function makePayment() {
    try {
        console.log('\n╔═══════════════════════════════════════════════════════════╗');
        console.log('║           Make Payment to PayPerAPI Contract              ║');
        console.log('╚═══════════════════════════════════════════════════════════╝\n');

        // Create account from private key
        const account = privateKeyToAccount(PRIVATE_KEY);
        console.log(`📝 Wallet Address: ${account.address}\n`);

        // Create wallet client
        const client = createWalletClient({
            account,
            chain: rootstockTestnet,
            transport: http(process.env.ROOTSTOCK_TESTNET_RPC_URL || 'https://public-node.testnet.rsk.co'),
        });

        // Payment amount: 0.0001 RBTC
        const amount = parseEther('0.0001');
        console.log(`💰 Payment Amount: 0.0001 RBTC\n`);

        console.log('📤 Sending payment transaction...\n');

        // Call the pay() function on the contract
        const hash = await client.writeContract({
            address: CONTRACT_ADDRESS,
            abi: payPerAPIContractABI,
            functionName: 'pay',
            value: amount,
        });

        console.log(`✅ Transaction sent!`);
        console.log(`📝 Transaction Hash: ${hash}`);
        console.log(`🔗 Explorer: https://explorer.testnet.rootstock.io/tx/${hash}\n`);

        console.log('⏳ Waiting for transaction confirmation...\n');

        // Wait for transaction receipt
        const publicClient = (await import('../config/rootstock.js')).publicClient;
        const receipt = await publicClient.waitForTransactionReceipt({ hash });

        console.log('✅ Transaction confirmed!');
        console.log(`📦 Block Number: ${receipt.blockNumber}`);
        console.log(`⛽ Gas Used: ${receipt.gasUsed.toString()}\n`);

        console.log('🎉 Payment successful! You can now make API requests.\n');
        console.log('Test it with:');
        console.log(`  curl -H "x-wallet-address: ${account.address}" http://localhost:3000/api/data\n`);

    } catch (error) {
        console.error('\n❌ Payment failed:', error.message);
        if (error.cause) {
            console.error('Details:', error.cause);
        }
        process.exit(1);
    }
}

// Run the payment
makePayment();

