/**
 * API Configuration Utilities
 * Shared utilities for configuring API endpoints based on environment
 */

import { logger } from './logger';

/**
 * Automatically detects the environment and returns the appropriate backend URL
 * - In local development (localhost:3000): returns 'http://localhost:5000'
 * - In Docker/production: returns '' (relative URLs for same-origin requests)
 * @returns {string} The backend URL to use for API calls
 */
export const getBackendUrl = () => {
    const isDevelopment = process.env.NODE_ENV === 'development';
    const isLocalhost = window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname === '::1';
    const currentPort = window.location.port;

    logger.debug('Environment detection:', { isDevelopment, isLocalhost, currentPort });

    // Use localhost:5000 for local development
    if (isDevelopment && isLocalhost) {
        return 'http://localhost:5000';
    }
    // Fallback: if running on localhost with typical dev ports, assume local dev
    else if (isLocalhost && (currentPort === '3000' || currentPort === '3001' || currentPort === '8080')) {
        return 'http://localhost:5000';
    }
    // Production/Docker - use relative URLs
    return '';
};

export default getBackendUrl;
