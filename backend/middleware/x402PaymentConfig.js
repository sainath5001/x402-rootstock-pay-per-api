/**
 * x402 Payment Middleware - Declarative Configuration Pattern
 * 
 * This implements the x402 pattern from their documentation:
 * 
 * app.use(
 *   paymentMiddleware({
 *     "GET /weather": {
 *       accepts: [...],
 *       description: "Weather data",
 *     },
 *   })
 * );
 */

import { x402PaymentMiddleware } from './x402Payment.js';

/**
 * Create x402 payment middleware with route configuration
 * 
 * @param {Object} routeConfig - Configuration object mapping routes to payment options
 * @returns {Function} Express middleware that checks routes and applies payment
 */
export function paymentMiddleware(routeConfig) {
    // Store route configurations
    const routes = new Map();

    for (const [route, config] of Object.entries(routeConfig)) {
        const [method, path] = route.split(' ').map(s => s.trim());
        const key = `${method.toUpperCase()} ${path}`;

        routes.set(key, {
            method: method.toUpperCase(),
            path,
            accepts: config.accepts || ['rootstock'],
            description: config.description || 'Protected endpoint',
        });

        console.log(`✅ Configured x402 payment for ${key}: ${config.description || 'Protected endpoint'}`);
    }

    // Return middleware that checks if current route needs payment
    return (req, res, next) => {
        const routeKey = `${req.method} ${req.path}`;
        const routeConfig = routes.get(routeKey);

        if (routeConfig) {
            // This route requires payment - use x402 middleware
            req.routeMetadata = routeConfig;
            return x402PaymentMiddleware(req, res, next);
        } else {
            // Route not configured for payment - proceed normally
            next();
        }
    };
}
