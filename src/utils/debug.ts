/**
 * Unified Debug Logger Utility
 *
 * Single source of truth for all SDK debugging:
 * - debugLog.add() is the primary API for structured logging
 * - debug.log/warn/error are convenience wrappers that route through debugLog
 * - Server forwarding is handled via subscription pattern
 * - DebugPanel subscribes for UI display
 *
 * Sources:
 * - 'sdk': Core SDK events (init, ready, errors)
 * - 'handler': Action handler execution
 * - 'network': API requests/responses
 * - 'server': Server-side events (via SSE)
 */

import type { MCPClient } from '../api/mcp-client';

// ============================================================================
// Types
// ============================================================================

/** Debug entry sources */
export type DebugSource = 'sdk' | 'handler' | 'network' | 'server';

/** Debug entry severity levels */
export type DebugLevel = 'info' | 'warn' | 'error';

/**
 * Unified debug entry for all logging.
 * Used by DebugPanel, server forwarding, and console output.
 */
export interface DebugEntry {
  /** Unix timestamp in milliseconds */
  timestamp: number;
  /** Event name or message (e.g., 'sdk:init:start', 'network:request') */
  event: string;
  /** Structured data associated with the event */
  data?: unknown;
  /** Source of the log entry */
  source: DebugSource;
  /** Severity level */
  level: DebugLevel;
  /** Optional prefix for backward compatibility (e.g., '[Pillar]', '[PlanExecutor]') */
  prefix?: string;
}

/**
 * Log entry structure for server forwarding (backward compatible).
 */
export interface LogEntry {
  level: 'log' | 'warn' | 'error';
  message: string;
  data?: unknown;
  timestamp: string;
}

// ============================================================================
// Debug Mode Configuration
// ============================================================================

/**
 * Runtime debug flag - can be enabled via Pillar.init({ debug: true })
 */
let runtimeDebugEnabled = false;

/**
 * Enable or disable runtime debug mode.
 * Called by Pillar.init() when debug: true is passed.
 */
export function setDebugMode(enabled: boolean): void {
  runtimeDebugEnabled = enabled;
  if (enabled) {
    // Use debugLog directly to avoid circular dependency during init
    console.log('[Pillar] Debug mode enabled - verbose logging active');
  }
}

/**
 * Check if debug mode is enabled (either via environment or runtime flag).
 */
export function isDebugEnabled(): boolean {
  return runtimeDebugEnabled || isDevelopment();
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
    const hostname = window.location?.hostname || '';
    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.includes('.local')
    );
  }
  return false;
};

// ============================================================================
// Server Log Forwarder
// ============================================================================

/** Prefixes that should be forwarded to the server */
const FORWARD_PREFIXES = ['[Pillar]', '[MCPClient]', '[PlanExecutor]'];

/** Sources that should be forwarded to the server */
const FORWARD_SOURCES: DebugSource[] = ['sdk', 'handler', 'network'];

/**
 * Handles buffering and forwarding logs to the server.
 */
class ServerLogForwarder {
  private mcpClient: MCPClient;
  private buffer: LogEntry[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private flushIntervalMs: number;
  private maxBufferSize = 100;

  constructor(client: MCPClient, flushIntervalMs = 5000) {
    this.mcpClient = client;
    this.flushIntervalMs = flushIntervalMs;
    this.startFlushTimer();
    this.setupUnloadListener();
  }

  /**
   * Check if a debug entry should be forwarded to the server.
   */
  shouldForward(entry: DebugEntry): boolean {
    // Forward based on source
    if (FORWARD_SOURCES.includes(entry.source)) {
      return true;
    }
    // Forward based on prefix (backward compatibility)
    if (entry.prefix && FORWARD_PREFIXES.some(p => entry.prefix?.startsWith(p))) {
      return true;
    }
    // Always forward errors
    if (entry.level === 'error') {
      return true;
    }
    return false;
  }

  /**
   * Buffer a debug entry for server forwarding.
   */
  bufferEntry(entry: DebugEntry): void {
    // Convert DebugEntry to LogEntry for server
    const logEntry: LogEntry = {
      level: entry.level === 'info' ? 'log' : entry.level,
      message: entry.prefix
        ? `${entry.prefix} ${entry.event}`
        : `[${entry.source}] ${entry.event}`,
      data: entry.data,
      timestamp: new Date(entry.timestamp).toISOString(),
    };

    this.buffer.push(logEntry);

    // Auto-flush if buffer is full
    if (this.buffer.length >= this.maxBufferSize) {
      this.flush();
    }

    // Immediately flush errors
    if (entry.level === 'error') {
      this.flush();
    }
  }

  /**
   * Flush all buffered logs to the server.
   */
  flush(): void {
    if (this.buffer.length === 0) return;
    const logs = this.buffer.splice(0);
    this.mcpClient.sendLogBatch(logs);
  }

  private startFlushTimer(): void {
    if (this.flushTimer) return;
    this.flushTimer = setInterval(() => this.flush(), this.flushIntervalMs);
  }

  private stopFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  private handleBeforeUnload = (): void => {
    this.flush();
  };

  private setupUnloadListener(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', this.handleBeforeUnload);
    }
  }

  private removeUnloadListener(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('beforeunload', this.handleBeforeUnload);
    }
  }

  /**
   * Clean up resources.
   */
  destroy(): void {
    this.stopFlushTimer();
    this.removeUnloadListener();
    this.flush();
    this.buffer = [];
  }
}

// ============================================================================
// Debug Log Store (Single Source of Truth)
// ============================================================================

/**
 * Central debug log store.
 * All debug entries flow through here and are distributed to:
 * - Console (in debug mode)
 * - DebugPanel UI (via subscription)
 * - Server (via ServerLogForwarder subscription)
 */
class DebugLogStore {
  private entries: DebugEntry[] = [];
  private maxEntries = 500;
  private listeners: Set<(entries: DebugEntry[]) => void> = new Set();
  private serverForwarder: ServerLogForwarder | null = null;
  private forwarderUnsubscribe: (() => void) | null = null;

  /**
   * Add a debug entry.
   * This is the primary API for all logging.
   */
  add(entry: Omit<DebugEntry, 'timestamp'>): void {
    const fullEntry: DebugEntry = {
      ...entry,
      timestamp: Date.now(),
    };
    this.entries.push(fullEntry);

    // Trim old entries
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-this.maxEntries);
    }

    // Notify all listeners
    this.listeners.forEach((listener) => listener(this.entries));

    // Log to console in debug mode (skip if already logged via debug.* wrapper)
    // We check for prefix to avoid double-logging from debug.* calls
    if (isDebugEnabled() && !entry.prefix) {
      this.logToConsole(fullEntry);
    }

    // Forward to server if configured
    if (this.serverForwarder?.shouldForward(fullEntry)) {
      this.serverForwarder.bufferEntry(fullEntry);
    }
  }

  private logToConsole(entry: DebugEntry): void {
    const time = new Date(entry.timestamp).toISOString().split('T')[1].slice(0, 12);
    const prefix = `[${time}] [${entry.source}]`;
    const args = entry.data !== undefined ? [prefix, entry.event, entry.data] : [prefix, entry.event];

    if (entry.level === 'error') {
      console.error(...args);
    } else if (entry.level === 'warn') {
      console.warn(...args);
    } else {
      console.log(...args);
    }
  }

  /**
   * Enable server forwarding of logs.
   */
  enableServerForwarding(
    client: MCPClient,
    options?: { flushIntervalMs?: number }
  ): void {
    // Clean up previous forwarder
    this.disableServerForwarding();

    this.serverForwarder = new ServerLogForwarder(
      client,
      options?.flushIntervalMs
    );
  }

  /**
   * Disable server forwarding.
   */
  disableServerForwarding(): void {
    if (this.serverForwarder) {
      this.serverForwarder.destroy();
      this.serverForwarder = null;
    }
    if (this.forwarderUnsubscribe) {
      this.forwarderUnsubscribe();
      this.forwarderUnsubscribe = null;
    }
  }

  /**
   * Manually flush logs to server.
   */
  flush(): void {
    this.serverForwarder?.flush();
  }

  /**
   * Get all entries.
   */
  getEntries(): DebugEntry[] {
    return [...this.entries];
  }

  /**
   * Clear all entries.
   */
  clear(): void {
    this.entries = [];
    this.listeners.forEach((listener) => listener(this.entries));
  }

  /**
   * Subscribe to entry updates.
   */
  subscribe(listener: (entries: DebugEntry[]) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Clean up all resources.
   */
  destroy(): void {
    this.disableServerForwarding();
    this.entries = [];
    this.listeners.clear();
  }
}

/**
 * Global debug log store instance.
 */
export const debugLog = new DebugLogStore();

// ============================================================================
// Convenience Wrappers (debug.log/warn/error)
// ============================================================================

/**
 * Parse log arguments to extract prefix, event, and data.
 * Handles the common pattern: debug.log('[Prefix]', 'message', { data })
 */
function parseLogArgs(args: unknown[]): {
  prefix?: string;
  event: string;
  data?: unknown;
} {
  if (args.length === 0) {
    return { event: '' };
  }

  const firstArg = args[0];
  let prefix: string | undefined;
  let eventParts: string[] = [];
  let data: unknown;

  // Check if first arg is a prefix like '[Pillar]'
  if (typeof firstArg === 'string' && firstArg.startsWith('[') && firstArg.endsWith(']')) {
    prefix = firstArg;
    args = args.slice(1);
  }

  // Collect string parts as event, last object as data
  for (const arg of args) {
    if (typeof arg === 'string') {
      eventParts.push(arg);
    } else if (typeof arg === 'object' && arg !== null) {
      data = arg;
    }
  }

  return {
    prefix,
    event: eventParts.join(' '),
    data,
  };
}

/**
 * Map prefix to source for backward compatibility.
 */
function prefixToSource(prefix?: string): DebugSource {
  if (!prefix) return 'sdk';
  if (prefix.includes('MCPClient')) return 'network';
  if (prefix.includes('PlanExecutor')) return 'sdk';
  return 'sdk';
}

/**
 * Debug logger convenience API.
 *
 * Routes all calls through debugLog for unified handling.
 * Maintains backward compatibility with existing debug.log/warn/error calls.
 */
export const debug = {
  /**
   * Configure server-side log forwarding.
   * @deprecated Use debugLog.enableServerForwarding() instead
   */
  configure: (
    client: MCPClient,
    options?: {
      forwardToServer?: boolean;
      flushIntervalMs?: number;
    }
  ): void => {
    if (options?.forwardToServer !== false) {
      debugLog.enableServerForwarding(client, {
        flushIntervalMs: options?.flushIntervalMs,
      });
    }
  },

  /**
   * Manually flush logs to server.
   */
  flush: (): void => {
    debugLog.flush();
  },

  /**
   * Log debug information.
   * Only outputs in development mode or when debug is enabled.
   */
  log: (...args: unknown[]): void => {
    if (!isDebugEnabled()) return;

    const { prefix, event, data } = parseLogArgs(args);

    // Log to console (debug.* calls handle their own console output for backward compat)
    console.log(...args);

    // Add to debugLog store (with prefix to avoid double console logging)
    debugLog.add({
      event,
      data,
      source: prefixToSource(prefix),
      level: 'info',
      prefix,
    });
  },

  /**
   * Log warnings.
   * Only outputs in development mode or when debug is enabled.
   */
  warn: (...args: unknown[]): void => {
    if (!isDebugEnabled()) return;

    const { prefix, event, data } = parseLogArgs(args);

    console.warn(...args);

    debugLog.add({
      event,
      data,
      source: prefixToSource(prefix),
      level: 'warn',
      prefix,
    });
  },

  /**
   * Log errors.
   * Always outputs regardless of environment.
   */
  error: (...args: unknown[]): void => {
    const { prefix, event, data } = parseLogArgs(args);

    console.error(...args);

    debugLog.add({
      event,
      data,
      source: prefixToSource(prefix),
      level: 'error',
      prefix,
    });
  },

  /**
   * Clean up resources.
   */
  destroy: (): void => {
    debugLog.destroy();
  },
};
