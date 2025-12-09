/**
 * Application-wide constants
 * 
 * Centralized version numbers and configuration to avoid hardcoding in components.
 */

// Molstar 3D viewer - loaded from CDN for bundle size optimization
// Update this when upgrading molstar in package.json
export const MOLSTAR_VERSION = '3.45.0';
export const MOLSTAR_CDN_BASE = `https://cdn.jsdelivr.net/npm/molstar@${MOLSTAR_VERSION}/build/viewer`;
export const MOLSTAR_CSS_URL = `${MOLSTAR_CDN_BASE}/molstar.css`;
export const MOLSTAR_JS_URL = `${MOLSTAR_CDN_BASE}/molstar.js`;
