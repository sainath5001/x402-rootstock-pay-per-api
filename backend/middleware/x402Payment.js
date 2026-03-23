/**
 * x402 Payment Middleware
 * 
 * This middleware implements the x402 payment standard for pay-per-request APIs.
 * 
 * x402 Flow:
 * 1. Client makes API request
 * 2. Server checks if client has paid on-chain
 * 3. If not paid: Respond with HTTP 402 Payment Required + payment instructions
 * 4. Client pays on Rootstock blockchain
 * 5. Client retries request
 * 6. Server verifies payment and serves response
 * 
 * Why HTTP 402?
 * HTTP 402 was reserved in the original HTTP spec for payment-required scenarios
 * but was never standardized. x402 brings this to life for crypto-native payments,
 * enabling programmatic, permissionless API monetization.
 */

import {
    publicClient,
    CONTRACT_ADDRESS,
    payPerAPIContractABI,
    formatRBTC,
    walletClient,
    ownerAccount,
} from '../config/rootstock.js';
import { isAddress, verifyMessage } from 'viem';

const AUTH_TIME_WINDOW_MS = 5 * 60 * 1000;
const usedNonces = new Map();

function pruneExpiredNonces(nowMs = Date.now()) {
    for (const [key, expiresAt] of usedNonces.entries()) {
        if (expiresAt <= nowMs) {
            usedNonces.delete(key);
        }
    }
}

function buildAuthMessage({ walletAddress, method, path, timestamp, nonce }) {
    return [
        'x402-auth',
        `wallet:${walletAddress.toLowerCase()}`,
        `method:${method.toUpperCase()}`,
        `path:${path}`,
        `timestamp:${timestamp}`,
        `nonce:${nonce}`,
    ].join('\n');
}

export function getAuthInstructions(req, walletAddress = '0xYourWalletAddress') {
    const timestamp = Date.now().toString();
    const nonce = 'unique-random-nonce';
    const message = buildAuthMessage({
        walletAddress,
        method: req.method,
        path: req.path,
        timestamp,
        nonce,
    });

    return {
        requiredHeaders: ['x-wallet-address', 'x-auth-signature', 'x-auth-timestamp', 'x-auth-nonce'],
        signMessage: message,
        notes: [
            'Sign the exact message using the private key of x-wallet-address',
            'Use a fresh nonce per request',
            `Timestamp must be within ${AUTH_TIME_WINDOW_MS / 60000} minutes`,
        ],
    };
}

export async function verifyWalletOwnership(req, walletAddress) {
    const signature = req.headers['x-auth-signature'];
    const timestampHeader = req.headers['x-auth-timestamp'];
    const nonce = req.headers['x-auth-nonce'];

    if (!signature || !timestampHeader || !nonce) {
        throw new Error('Missing auth signature headers');
    }

    const timestamp = Number(timestampHeader);
    if (!Number.isFinite(timestamp)) {
        throw new Error('Invalid auth timestamp');
    }

    const nowMs = Date.now();
    if (Math.abs(nowMs - timestamp) > AUTH_TIME_WINDOW_MS) {
        throw new Error('Expired auth timestamp');
    }

    const nonceString = String(nonce).trim();
    if (!nonceString || nonceString.length > 128) {
        throw new Error('Invalid auth nonce');
    }

    pruneExpiredNonces(nowMs);
    const nonceKey = `${walletAddress.toLowerCase()}:${nonceString}`;
    if (usedNonces.has(nonceKey)) {
        throw new Error('Auth nonce already used');
    }

    const message = buildAuthMessage({
        walletAddress,
        method: req.method,
        path: req.path,
        timestamp: timestampHeader,
        nonce: nonceString,
    });

    const isValid = await verifyMessage({
        address: walletAddress,
        message,
        signature: String(signature),
    });

    if (!isValid) {
        throw new Error('Invalid wallet signature');
    }

    usedNonces.set(nonceKey, nowMs + AUTH_TIME_WINDOW_MS);
}

/**
 * Verify if a wallet address has paid for API access
 * @param {string} walletAddress - The client's wallet address
 * @returns {Promise<{hasPaid: boolean, balance: bigint, availableRequests: number, pricePerRequest: bigint}>}
 */
export async function verifyPayment(walletAddress) {
    try {
        // Validate address format
        if (!isAddress(walletAddress)) {
            throw new Error('Invalid wallet address format');
        }

        // Read contract state in parallel for efficiency
        const [hasPaid, balance, availableRequests, pricePerRequest] = await Promise.all([
            publicClient.readContract({
                address: CONTRACT_ADDRESS,
                abi: payPerAPIContractABI,
                functionName: 'hasPaid',
                args: [walletAddress],
            }),
            publicClient.readContract({
                address: CONTRACT_ADDRESS,
                abi: payPerAPIContractABI,
                functionName: 'getPaymentBalance',
                args: [walletAddress],
            }),
            publicClient.readContract({
                address: CONTRACT_ADDRESS,
                abi: payPerAPIContractABI,
                functionName: 'getAvailableRequests',
                args: [walletAddress],
            }),
            publicClient.readContract({
                address: CONTRACT_ADDRESS,
                abi: payPerAPIContractABI,
                functionName: 'pricePerRequest',
            }),
        ]);

        return {
            hasPaid,
            balance: BigInt(balance),
            availableRequests: Number(availableRequests),
            pricePerRequest: BigInt(pricePerRequest),
        };
    } catch (error) {
        console.error('Error verifying payment:', error);
        throw error;
    }
}

/**
 * Generate x402-compatible payment instructions
 * This format follows the x402 standard for payment metadata
 * 
 * @param {bigint} pricePerRequest - Required payment amount in wei
 * @returns {Object} x402 payment instructions
 */
function generatePaymentInstructions(pricePerRequest) {
    return {
        // x402 standard fields
        payment: {
            // Network information
            network: {
                chainId: 31, // Rootstock Testnet
                name: 'Rootstock Testnet',
                currency: 'RBTC',
            },
            // Smart contract payment details
            contract: {
                address: CONTRACT_ADDRESS,
                function: 'pay',
                abi: [
                    {
                        inputs: [],
                        name: 'pay',
                        outputs: [],
                        stateMutability: 'payable',
                        type: 'function',
                    },
                ],
            },
            // Required payment amount
            amount: {
                value: pricePerRequest.toString(),
                formatted: formatRBTC(pricePerRequest),
                currency: 'RBTC',
            },
            // Instructions for the client
            instructions: {
                description: 'Send RBTC payment to the PayPerAPI contract',
                steps: [
                    'Call the pay() function on the contract',
                    `Send at least ${formatRBTC(pricePerRequest)} RBTC`,
                    'Wait for transaction confirmation',
                    'Retry your API request with wallet ownership signature headers',
                ],
            },
        },
        // Additional metadata
        metadata: {
            standard: 'x402',
            version: '1.0',
            endpoint: 'PayPerAPI on Rootstock',
        },
    };
}

async function deductPaymentOnChain(walletAddress, amount) {
    if (!walletClient || !ownerAccount) {
        throw new Error('OWNER_PRIVATE_KEY is required to deduct payment per request');
    }

    const hash = await walletClient.writeContract({
        address: CONTRACT_ADDRESS,
        abi: payPerAPIContractABI,
        functionName: 'deductPayment',
        args: [walletAddress, amount],
        account: ownerAccount,
    });

    await publicClient.waitForTransactionReceipt({ hash });
    return hash;
}

/**
 * x402 Payment Middleware
 * 
 * This middleware:
 * 1. Extracts wallet address from request headers
 * 2. Verifies on-chain payment status
 * 3. Returns HTTP 402 with payment instructions if not paid
 * 4. Allows request to proceed if payment is verified
 * 
 * Usage:
 *   app.get('/api/data', x402PaymentMiddleware, (req, res) => {
 *     res.json({ data: 'Your protected data' });
 *   });
 */
export async function x402PaymentMiddleware(req, res, next) {
    // Extract wallet address from request headers
    // Clients should send: x-wallet-address: 0x...
    const walletAddress = req.headers['x-wallet-address'];

    if (!walletAddress) {
        return res.status(400).json({
            error: 'Missing wallet address',
            message: 'Please include your wallet address in the x-wallet-address header',
        });
    }

    try {
        // Require proof that caller controls walletAddress to prevent spoofing.
        await verifyWalletOwnership(req, walletAddress);

        const { hasPaid, balance, availableRequests, pricePerRequest } = await verifyPayment(walletAddress);
        if (!hasPaid) {
            const paymentInstructions = generatePaymentInstructions(pricePerRequest);

            return res.status(402).json({
                status: 402,
                message: 'Payment Required',
                ...paymentInstructions,
                auth: getAuthInstructions(req, walletAddress),
                currentStatus: {
                    walletAddress,
                    balance: balance.toString(),
                    balanceFormatted: formatRBTC(balance),
                    hasPaid: false,
                    availableRequests: 0,
                },
            });
        }

        // Enforce pay-per-request by deducting one request worth of balance.
        const deductionTxHash = await deductPaymentOnChain(walletAddress, pricePerRequest);
        const remainingBalance = balance - pricePerRequest;
        const remainingRequests = availableRequests > 0 ? availableRequests - 1 : 0;

        req.paymentInfo = {
            walletAddress,
            balance: remainingBalance.toString(),
            availableRequests: remainingRequests,
            pricePerRequest: pricePerRequest.toString(),
            deductionTxHash,
        };

        next();
    } catch (error) {
        console.error('Payment verification error:', error);
        const message = error.message || 'Unable to verify payment status';
        const authError = [
            'Missing auth signature headers',
            'Invalid auth timestamp',
            'Expired auth timestamp',
            'Invalid auth nonce',
            'Auth nonce already used',
            'Invalid wallet signature',
        ].includes(message);

        if (authError) {
            return res.status(401).json({
                error: 'Wallet ownership verification failed',
                message,
                auth: getAuthInstructions(req, walletAddress),
            });
        }

        res.status(500).json({
            error: 'Payment verification failed',
            message,
        });
    }
}

/**
 * Optional: Middleware to deduct payment after serving request
 * This can be used to track usage, but is optional since the contract
 * already tracks balances. You might want to deduct to enforce per-request
 * payment rather than accumulated balance.
 * 
 * Note: This requires the API server to have owner privileges on the contract.
 */
export async function deductPaymentAfterRequest(walletAddress, amount) {
    // This would require a wallet client with owner private key
    // For now, we'll just log it - implement if needed
    console.log(`[Optional] Would deduct ${formatRBTC(amount)} RBTC from ${walletAddress}`);
}

