/**
 * Debug Logger Utility
 *
 * Development-only logging utility for the Pillar SDK.
 * In production builds, log and warn calls are no-ops.
 * Errors are always logged.
 * 
 * When configured with an MCP client, logs are buffered and forwarded
 * to the server every 5 seconds for debugging client-server communication.
 */

import type { MCPClient } from '../api/mcp-client';

/** Log entry structure for buffered logs */
export interface LogEntry {
  level: 'log' | 'warn' | 'error';
  message: string;
  data?: unknown;
  timestamp: string;
}

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

// Configuration for server-side log forwarding
let mcpClient: MCPClient | null = null;
let forwardToServer = false;

// Log buffering configuration
const DEFAULT_FLUSH_INTERVAL_MS = 5000;
const MAX_BUFFER_SIZE = 100;
let logBuffer: LogEntry[] = [];
let flushTimer: ReturnType<typeof setInterval> | null = null;
let flushIntervalMs = DEFAULT_FLUSH_INTERVAL_MS;

// Prefixes that should be forwarded to the server (action-related logs)
const FORWARD_PREFIXES = [
  '[Pillar]',
  '[MCPClient]',
  '[PlanExecutor]',
];

/**
 * Check if a message should be forwarded to the server.
 * Only forwards logs with specific prefixes related to action execution.
 */
function shouldForward(args: unknown[]): boolean {
  if (!forwardToServer || !mcpClient) return false;
  
  const firstArg = args[0];
  if (typeof firstArg !== 'string') return false;
  
  return FORWARD_PREFIXES.some(prefix => firstArg.startsWith(prefix));
}

/**
 * Flush all buffered logs to the server.
 */
function flush(): void {
  if (logBuffer.length === 0 || !mcpClient) return;
  
  // Take all logs and clear buffer
  const logs = logBuffer.splice(0);
  mcpClient.sendLogBatch(logs);
}

/**
 * Buffer a log message for later sending to the server.
 * Errors are flushed immediately.
 */
function bufferLog(level: 'log' | 'warn' | 'error', args: unknown[]): void {
  if (!mcpClient) return;
  
  // Convert args to a message string
  const message = args
    .map(arg => {
      if (typeof arg === 'string') return arg;
      try {
        return JSON.stringify(arg);
      } catch {
        return String(arg);
      }
    })
    .join(' ');
  
  // Extract any object data from args for structured logging
  const dataArg = args.find(arg => typeof arg === 'object' && arg !== null);
  
  const entry: LogEntry = {
    level,
    message,
    data: dataArg,
    timestamp: new Date().toISOString(),
  };
  
  logBuffer.push(entry);
  
  // Auto-flush if buffer is full
  if (logBuffer.length >= MAX_BUFFER_SIZE) {
    flush();
  }
  
  // Immediately flush errors (don't wait for timer)
  if (level === 'error') {
    flush();
  }
}

/**
 * Start the flush timer.
 */
function startFlushTimer(): void {
  if (flushTimer) return; // Already running
  
  flushTimer = setInterval(flush, flushIntervalMs);
}

/**
 * Stop the flush timer and flush remaining logs.
 */
function stopFlushTimer(): void {
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
  flush(); // Flush any remaining logs
}

/**
 * Handle page unload - flush logs before page closes.
 */
function handleBeforeUnload(): void {
  flush();
}

/**
 * Set up beforeunload listener for flushing on page close.
 */
function setupUnloadListener(): void {
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', handleBeforeUnload);
  }
}

/**
 * Remove beforeunload listener.
 */
function removeUnloadListener(): void {
  if (typeof window !== 'undefined') {
    window.removeEventListener('beforeunload', handleBeforeUnload);
  }
}

/**
 * Debug logger for Pillar SDK.
 *
 * - log: Only logs in development mode
 * - warn: Only logs in development mode
 * - error: Always logs (errors should never be silenced)
 *
 * When configured with an MCP client, logs are buffered and sent to the
 * server every 5 seconds (configurable). Errors are flushed immediately.
 *
 * Note: Messages should include their own prefix (e.g., [Pillar], [PlanExecutor])
 * for better traceability.
 */
export const debug = {
  /**
   * Configure the debug logger with an MCP client for server-side forwarding.
   * 
   * When enabled, important logs (action execution, errors) are buffered
   * and sent to the server periodically for debugging.
   * 
   * @param client - The MCP client to use for sending logs
   * @param options - Configuration options
   */
  configure: (client: MCPClient, options?: { 
    forwardToServer?: boolean;
    flushIntervalMs?: number;
  }): void => {
    // Clean up previous configuration
    stopFlushTimer();
    removeUnloadListener();
    
    mcpClient = client;
    forwardToServer = options?.forwardToServer ?? DEBUG; // Default: forward in dev mode
    flushIntervalMs = options?.flushIntervalMs ?? DEFAULT_FLUSH_INTERVAL_MS;
    
    if (forwardToServer && mcpClient) {
      startFlushTimer();
      setupUnloadListener();
    }
  },

  /**
   * Manually flush all buffered logs to the server.
   * Called automatically on timer and page unload.
   */
  flush,

  /**
   * Log debug information. Only outputs in development mode.
   */
  log: (...args: unknown[]): void => {
    if (DEBUG) {
      console.log(...args);
      if (shouldForward(args)) {
        bufferLog('log', args);
      }
    }
  },

  /**
   * Log warnings. Only outputs in development mode.
   */
  warn: (...args: unknown[]): void => {
    if (DEBUG) {
      console.warn(...args);
      if (shouldForward(args)) {
        bufferLog('warn', args);
      }
    }
  },

  /**
   * Log errors. Always outputs regardless of environment.
   * Errors are buffered and immediately flushed to server when configured.
   */
  error: (...args: unknown[]): void => {
    console.error(...args);
    // Always forward errors to server when configured (and flush immediately)
    if (mcpClient && forwardToServer) {
      bufferLog('error', args);
    }
  },

  /**
   * Clean up resources (stop timer, remove listeners).
   * Call this when the SDK is destroyed.
   */
  destroy: (): void => {
    stopFlushTimer();
    removeUnloadListener();
    logBuffer = [];
    mcpClient = null;
    forwardToServer = false;
  },
};
