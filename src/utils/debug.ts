/**
 * Debug Logger Utility
 *
 * Development-only logging utility for the Pillar SDK.
 * In production builds, log and warn calls are no-ops.
 * Errors are always logged.
 */

/**
 * Check if we're in development mode.
 * Works in both Node.js and browser environments.
 */
const isDevelopment = (): boolean => {
  // Check for Node.js process.env
  if (typeof process !== 'undefined' && process.env?.NODE_ENV) {
    return process.env.NODE_ENV === 'development';
  }
  // In browser without process.env, check for common dev indicators
  if (typeof window !== 'undefined') {
    // Check for localhost or development ports
    const hostname = window.location?.hostname || '';
    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.includes('.local')
    );
  }
  return false;
};

const DEBUG = isDevelopment();

/**
 * Debug logger for Pillar SDK.
 *
 * - log: Only logs in development mode
 * - warn: Only logs in development mode
 * - error: Always logs (errors should never be silenced)
 *
 * Note: Messages should include their own prefix (e.g., [Pillar], [PlanExecutor])
 * for better traceability.
 */
export const debug = {
  /**
   * Log debug information. Only outputs in development mode.
   */
  log: (...args: unknown[]): void => {
    if (DEBUG) {
      console.log(...args);
    }
  },

  /**
   * Log warnings. Only outputs in development mode.
   */
  warn: (...args: unknown[]): void => {
    if (DEBUG) {
      console.warn(...args);
    }
  },

  /**
   * Log errors. Always outputs regardless of environment.
   */
  error: (...args: unknown[]): void => {
    console.error(...args);
  },
};
