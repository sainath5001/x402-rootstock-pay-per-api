/**
 * x402 Pay-Per-API Server
 * 
 * A REST API server that implements the x402 payment standard
 * for pay-per-request API access using Rootstock (RBTC).
 * 
 * This server demonstrates:
 * - HTTP 402 Payment Required responses
 * - On-chain payment verification via Rootstock smart contracts
 * - Bitcoin-secured API monetization
 * - Programmatic, permissionless payments
 * 
 * Why Rootstock?
 * Rootstock provides Bitcoin security with EVM compatibility,
 * enabling Bitcoin-backed payments for APIs while using familiar
 * Ethereum tooling (like viem).
 */

import express from 'express';
import dotenv from 'dotenv';
import { x402PaymentMiddleware } from './middleware/x402Payment.js';
import { paymentMiddleware } from './middleware/x402PaymentConfig.js';

// Load environment variables
dotenv.config();

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
    });
});

/**
 * Protected API Endpoint - Requires Payment
 * 
 * Payment is already configured via paymentMiddleware above.
 * The x402 middleware will check payment before this handler runs.
 * 
 * x402 Flow:
 * 1. Client sends request with x-wallet-address header
 * 2. Middleware checks on-chain payment status
 * 3. If not paid: Returns HTTP 402 with payment instructions
 * 4. If paid: This handler runs and returns data
 */
app.get('/api/data', (req, res) => {
    // Payment has been verified by middleware
    // req.paymentInfo contains wallet address and balance info

    const { walletAddress, availableRequests, balance } = req.paymentInfo;

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
            message: `You have ${availableRequests} request(s) remaining`,
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
        });
    }

    try {
        const { verifyPayment } = await import('./middleware/x402Payment.js');
        const { formatRBTC } = await import('./config/rootstock.js');
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
  GET  /api/data            - Protected data (requires payment)
  GET  /api/weather         - Weather API (requires payment)
  POST /api/ai/infer        - AI inference (requires payment)
  GET  /api/payment/status  - Check payment status

Example request:
  curl -H "x-wallet-address: 0x..." http://localhost:${PORT}/api/data

  `);
});

