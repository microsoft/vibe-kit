/**
 * Simple logger utility for development debugging
 * Set DEBUG=true in localStorage to enable verbose logging
 * 
 * Usage:
 *   import { logger } from '../utils/logger';
 *   logger.debug('Message', data);  // Only in debug mode
 *   logger.info('Message', data);   // Always logged
 *   logger.warn('Message', data);   // Always logged
 *   logger.error('Message', data);  // Always logged
 */

const isDebugMode = () => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('DEBUG') === 'true' ||
        process.env.NODE_ENV === 'development';
};

export const logger = {
    /**
     * Debug level - only logs when DEBUG mode is enabled
     */
    debug: (...args) => {
        if (isDebugMode()) {
            console.log('[DEBUG]', ...args);
        }
    },

    /**
     * Info level - always logs
     */
    info: (...args) => {
        console.log('[INFO]', ...args);
    },

    /**
     * Warning level - always logs
     */
    warn: (...args) => {
        console.warn('[WARN]', ...args);
    },

    /**
     * Error level - always logs
     */
    error: (...args) => {
        console.error('[ERROR]', ...args);
    },

    /**
     * Group related logs together (debug only)
     */
    group: (label, fn) => {
        if (isDebugMode()) {
            console.group(label);
            fn();
            console.groupEnd();
        }
    }
};

export default logger;
