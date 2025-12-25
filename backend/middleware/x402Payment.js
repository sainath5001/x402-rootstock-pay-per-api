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

import { publicClient, CONTRACT_ADDRESS, payPerAPIContractABI, formatRBTC } from '../config/rootstock.js';
import { isAddress } from 'viem';

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
                    'Retry your API request',
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
export function x402PaymentMiddleware(req, res, next) {
    // Extract wallet address from request headers
    // Clients should send: x-wallet-address: 0x...
    const walletAddress = req.headers['x-wallet-address'];

    if (!walletAddress) {
        return res.status(400).json({
            error: 'Missing wallet address',
            message: 'Please include your wallet address in the x-wallet-address header',
        });
    }

    // Verify payment asynchronously
    verifyPayment(walletAddress)
        .then(({ hasPaid, balance, availableRequests, pricePerRequest }) => {
            if (!hasPaid) {
                // Client has not paid - return HTTP 402 Payment Required
                // This is the core of the x402 standard
                const paymentInstructions = generatePaymentInstructions(pricePerRequest);

                return res.status(402).json({
                    // HTTP 402 status code indicates payment is required
                    status: 402,
                    message: 'Payment Required',
                    // x402-compatible payment instructions
                    ...paymentInstructions,
                    // Current payment status
                    currentStatus: {
                        walletAddress,
                        balance: balance.toString(),
                        balanceFormatted: formatRBTC(balance),
                        hasPaid: false,
                        availableRequests: 0,
                    },
                });
            }

            // Payment verified! Attach payment info to request and proceed
            req.paymentInfo = {
                walletAddress,
                balance: balance.toString(),
                availableRequests,
                pricePerRequest: pricePerRequest.toString(),
            };

            next();
        })
        .catch((error) => {
            console.error('Payment verification error:', error);
            res.status(500).json({
                error: 'Payment verification failed',
                message: error.message || 'Unable to verify payment status',
            });
        });
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

