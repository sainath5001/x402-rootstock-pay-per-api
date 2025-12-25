/**
 * Example: Using x402 Declarative Configuration Pattern
 * 
 * This demonstrates the pattern from x402 documentation:
 * 
 * app.use(
 *   paymentMiddleware({
 *     "GET /weather": {
 *       accepts: [...],
 *       description: "Weather data",
 *     },
 *   })
 * );
 * 
 * This is a more declarative approach where you configure
 * all your paid routes upfront.
 */

import express from 'express';
import { paymentMiddleware } from '../middleware/x402PaymentConfig.js';

const app = express();
app.use(express.json());

/**
 * Configure all your paid routes upfront
 * This matches the x402 documentation pattern
 */
app.use(
    paymentMiddleware({
        // Weather API endpoint
        "GET /api/weather": {
            accepts: ["rootstock"], // Payment networks you accept
            description: "Weather data API", // What this endpoint does
        },

        // AI Inference endpoint
        "POST /api/ai/infer": {
            accepts: ["rootstock"],
            description: "AI inference service",
        },

        // Data endpoint
        "GET /api/data": {
            accepts: ["rootstock"],
            description: "Protected data API",
        },
    })
);

/**
 * Now define your actual route handlers
 * The payment middleware will check payment before these run
 */
app.get('/api/weather', (req, res) => {
    // Payment already verified by middleware
    res.json({
        weather: {
            location: 'San Francisco',
            temperature: '72°F',
            condition: 'Sunny',
        },
        payment: req.paymentInfo, // Payment info attached by middleware
    });
});

app.post('/api/ai/infer', express.json(), (req, res) => {
    const { prompt } = req.body;

    res.json({
        inference: {
            prompt,
            response: `AI response to: "${prompt}"`,
        },
        payment: req.paymentInfo,
    });
});

app.get('/api/data', (req, res) => {
    res.json({
        data: {
            timestamp: new Date().toISOString(),
            value: Math.random() * 100,
        },
        payment: req.paymentInfo,
    });
});

// Health check (no payment)
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log('\nConfigured paid routes:');
    console.log('  GET  /api/weather');
    console.log('  POST /api/ai/infer');
    console.log('  GET  /api/data');
});

