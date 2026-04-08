/**
 * Prepaid pay-per-request API (x402-inspired) on Rootstock (RBTC).
 *
 * - HTTP 402 + structured payment JSON when prepaid balance is too low.
 * - EIP-191 signed headers prove control of x-wallet-address.
 * - deductPayment runs on-chain before route handlers (requires OWNER_PRIVATE_KEY).
 */

import express from 'express';
import dotenv from 'dotenv';
import { ownerAccount } from './config/rootstock.js';
import { paymentMiddleware } from './middleware/x402PaymentConfig.js';
import {
    getAuthInstructions,
    verifyWalletOwnership,
    getWalletAuthSpec,
} from './middleware/x402Payment.js';

// Load environment variables
dotenv.config();

if (!ownerAccount) {
    console.error(`
FATAL: OWNER_PRIVATE_KEY is not set or invalid.

Pay-per-request is enforced by calling deductPayment on-chain before any protected handler runs.
Set OWNER_PRIVATE_KEY to the PayPerAPI contract owner key (see backend/.env.example), then restart.
`);
    process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// x402 Declarative Pattern - Configure all paid routes upfront
// This matches the pattern from x402 documentation
app.use(
    paymentMiddleware({
        "GET /api/data": {
            accepts: ["rootstock"],
            description: "Protected data API",
        },
        "GET /api/weather": {
            accepts: ["rootstock"],
            description: "Weather data API",
        },
        "POST /api/ai/infer": {
            accepts: ["rootstock"],
            description: "AI inference service",
        },
    })
);

// Health check endpoint (no payment required)
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        message: 'x402 Pay-Per-API Server is running',
        contract: process.env.CONTRACT_ADDRESS,
        network: 'Rootstock Testnet',
        enforcement: {
            payPerRequest: 'on-chain deductPayment before protected handlers',
            walletAuth: 'EIP-191 signature headers required on paid routes and /api/payment/status',
        },
        docs: {
            walletAuthSpec: '/api/auth/spec',
            exampleClient: 'node examples/test-client.js',
        },
    });
});

/**
 * Wallet ownership signing spec (for integrators / reviewers).
 * Demonstrates that access is not granted from x-wallet-address alone.
 */
app.get('/api/auth/spec', (req, res) => {
    const wallet = typeof req.query.wallet === 'string' && req.query.wallet.startsWith('0x')
        ? req.query.wallet
        : '0x0000000000000000000000000000000000000000';
    res.json({
        title: 'Wallet ownership verification (required with payment)',
        ...getWalletAuthSpec({
            method: 'GET',
            path: '/api/data',
            walletAddress: wallet,
        }),
    });
});

/**
 * Protected API Endpoint - Requires Payment
 * 
 * Payment is already configured via paymentMiddleware above.
 * The x402 middleware will check payment before this handler runs.
 * 
 * Flow:
 * 1. Client sends x-wallet-address + signed auth headers (see GET /api/auth/spec)
 * 2. Middleware verifies signature, then on-chain balance
 * 3. If not paid: HTTP 402 + payment instructions
 * 4. If paid: deductPayment on-chain, then this handler runs
 */
app.get('/api/data', (req, res) => {
    // Payment has been verified by middleware
    // req.paymentInfo contains wallet address and balance info

    const { walletAddress, availableRequests, balance, deductionTxHash } = req.paymentInfo;

    // Return the protected data
    res.json({
        success: true,
        message: 'Payment verified - here is your data',
        data: {
            // Example API response
            timestamp: new Date().toISOString(),
            value: Math.random() * 100,
            description: 'This is protected API data that requires payment',
        },
        // Include payment info in response
        payment: {
            walletAddress,
            availableRequests,
            balanceRemaining: balance,
            deductionTxHash: deductionTxHash ?? null,
            message: `You have ${availableRequests} request(s) remaining (one deducted on-chain for this call)`,
        },
    });
});

/**
 * Example: Weather API Endpoint
 * Payment already configured via paymentMiddleware above
 */
app.get('/api/weather', (req, res) => {
    // Simulated weather data
    res.json({
        success: true,
        weather: {
            location: 'San Francisco',
            temperature: '72°F',
            condition: 'Sunny',
            humidity: '65%',
        },
        payment: req.paymentInfo,
    });
});

/**
 * Example: AI Inference Endpoint
 * Payment already configured via paymentMiddleware above
 */
app.post('/api/ai/infer', express.json(), (req, res) => {
    const { prompt } = req.body;

    if (!prompt) {
        return res.status(400).json({ error: 'Missing prompt in request body' });
    }

    // Simulated AI inference
    res.json({
        success: true,
        inference: {
            prompt,
            response: `AI response to: "${prompt}"`,
            model: 'example-model',
            tokens: 150,
        },
        payment: req.paymentInfo,
    });
});

/**
 * Payment Status Endpoint
 * Allows clients to check their payment status without making a request
 */
app.get('/api/payment/status', async (req, res) => {
    const walletAddress = req.headers['x-wallet-address'];

    if (!walletAddress) {
        return res.status(400).json({
            error: 'Missing wallet address',
            message: 'Please include your wallet address in the x-wallet-address header',
            auth: getAuthInstructions(req),
        });
    }

    try {
        const { verifyPayment } = await import('./middleware/x402Payment.js');
        const { formatRBTC } = await import('./config/rootstock.js');
        await verifyWalletOwnership(req, walletAddress);
        const { hasPaid, balance, availableRequests, pricePerRequest } = await verifyPayment(walletAddress);

        res.json({
            walletAddress,
            hasPaid,
            balance: balance.toString(),
            balanceFormatted: formatRBTC(balance),
            availableRequests,
            pricePerRequest: pricePerRequest.toString(),
            pricePerRequestFormatted: formatRBTC(pricePerRequest),
        });
    } catch (error) {
        const authError = [
            'Missing auth signature headers',
            'Invalid auth timestamp',
            'Expired auth timestamp',
            'Invalid auth nonce',
            'Auth nonce already used',
            'Invalid wallet signature',
        ].includes(error.message);
        if (authError) {
            return res.status(401).json({
                error: 'Wallet ownership verification failed',
                message: error.message,
                auth: getAuthInstructions(req, walletAddress),
            });
        }

        res.status(500).json({
            error: 'Failed to check payment status',
            message: error.message,
        });
    }
});

// Import formatRBTC helper
import { formatRBTC } from './config/rootstock.js';

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({
        error: 'Internal server error',
        message: err.message,
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Not found',
        message: `Route ${req.method} ${req.path} not found`,
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║     x402 Pay-Per-API Server - Rootstock Edition          ║
╚═══════════════════════════════════════════════════════════╝

🚀 Server running on http://localhost:${PORT}
📝 Contract: ${process.env.CONTRACT_ADDRESS || 'Not configured'}
🌐 Network: Rootstock Testnet (Chain ID: 31)

Endpoints:
  GET  /health              - Health check (no payment)
  GET  /api/auth/spec       - Wallet signing format (no payment)
  GET  /api/data            - Protected (signature + prepaid deduct)
  GET  /api/weather         - Protected (signature + prepaid deduct)
  POST /api/ai/infer        - Protected (signature + prepaid deduct)
  GET  /api/payment/status  - Balance check (signature required)

Example client:
  node examples/test-client.js

  `);
});

