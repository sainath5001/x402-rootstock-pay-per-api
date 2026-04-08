/**
 * Demonstrates wallet ownership signing for reviewers.
 * Run: node examples/demonstrate-auth.js
 *
 * Prints the same message shape the API expects, then signs it with SIGNER_PRIVATE_KEY
 * and verifies with viem (local check only — server still validates on each request).
 */

import dotenv from 'dotenv';
import { privateKeyToAccount } from 'viem/accounts';
import { verifyMessage } from 'viem';

dotenv.config();

const SIGNER_PRIVATE_KEY = process.env.SIGNER_PRIVATE_KEY || '';
const WALLET_ADDRESS =
    process.env.WALLET_ADDRESS ||
    (SIGNER_PRIVATE_KEY
        ? privateKeyToAccount(
              SIGNER_PRIVATE_KEY.startsWith('0x') ? SIGNER_PRIVATE_KEY : `0x${SIGNER_PRIVATE_KEY}`
          ).address
        : null);

if (!SIGNER_PRIVATE_KEY || !WALLET_ADDRESS) {
    console.error('Set SIGNER_PRIVATE_KEY (and optionally WALLET_ADDRESS) in .env');
    process.exit(1);
}

const method = 'GET';
const path = '/api/data';
const timestamp = Date.now().toString();
const nonce = `demo-${Date.now()}`;

const message = [
    'x402-auth',
    `wallet:${WALLET_ADDRESS.toLowerCase()}`,
    `method:${method.toUpperCase()}`,
    `path:${path}`,
    `timestamp:${timestamp}`,
    `nonce:${nonce}`,
].join('\n');

async function main() {
    console.log('--- Message to sign (exact bytes, including newlines) ---\n');
    console.log(message);
    console.log('\n--- Headers to send ---');
    console.log(`x-wallet-address: ${WALLET_ADDRESS}`);
    console.log(`x-auth-timestamp: ${timestamp}`);
    console.log(`x-auth-nonce: ${nonce}`);

    const account = privateKeyToAccount(
        SIGNER_PRIVATE_KEY.startsWith('0x') ? SIGNER_PRIVATE_KEY : `0x${SIGNER_PRIVATE_KEY}`
    );
    const signature = await account.signMessage({ message });
    console.log(`x-auth-signature: ${signature}`);

    const ok = await verifyMessage({
        address: WALLET_ADDRESS,
        message,
        signature,
    });
    console.log(`\nLocal verifyMessage: ${ok ? 'OK' : 'FAILED'}`);
    console.log('\nLive spec from server (when running): GET http://localhost:3000/api/auth/spec');
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
