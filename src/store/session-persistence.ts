/**
 * Session Persistence Module
 *
 * Handles localStorage persistence for active streaming sessions.
 * Enables session recovery when the page is refreshed or the user
 * navigates away and returns.
 *
 * This is a lightweight "recovery hint" - the server is the source of truth.
 * We only store enough to know there might be a resumable session.
 */

import { debug } from '../utils/debug';

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY = 'pillar:active_session';
const STORAGE_VERSION = 1;

/**
 * Stored session data with metadata.
 * Minimal data - just enough to trigger a server check.
 */
interface StoredSessionData {
  version: number;
  conversationId: string;
  siteId: string;
  streamingStartedAt: string;
}

// ============================================================================
// Persistence Functions
// ============================================================================

/**
 * Save an active session hint to localStorage.
 *
 * Called when streaming starts to enable recovery on disconnect.
 *
 * @param conversationId - The conversation UUID
 * @param siteId - The site ID for scoping
 */
export function saveActiveSession(conversationId: string, siteId: string): void {
  if (!conversationId || !siteId) return;

  try {
    const data: StoredSessionData = {
      version: STORAGE_VERSION,
      conversationId,
      siteId,
      streamingStartedAt: new Date().toISOString(),
    };

    const key = getStorageKey(siteId);
    localStorage.setItem(key, JSON.stringify(data));

    debug.log(`[SessionPersistence] Saved session ${conversationId.slice(0, 8)}... to localStorage (key="${key}")`);
  } catch (error) {
    debug.warn('[SessionPersistence] Failed to save session:', error);
  }
}

/**
 * Load a saved session hint from localStorage.
 *
 * @param siteId - The site ID for scoping
 * @returns The saved session data or null if not found/invalid
 */
export function loadActiveSession(siteId: string): StoredSessionData | null {
  if (!siteId) {
    debug.warn('[SessionPersistence] loadActiveSession called with empty siteId');
    return null;
  }

  try {
    const key = getStorageKey(siteId);
    const stored = localStorage.getItem(key);

    if (!stored) {
      debug.log(`[SessionPersistence] No session found at key "${key}"`);
      return null;
    }

    const data: StoredSessionData = JSON.parse(stored);

    // Version check
    if (data.version !== STORAGE_VERSION) {
      debug.warn('[SessionPersistence] Stored session has incompatible version, clearing');
      clearActiveSession(siteId);
      return null;
    }

    // Site ID check
    if (data.siteId !== siteId) {
      debug.warn('[SessionPersistence] Stored session is for different site, clearing');
      clearActiveSession(siteId);
      return null;
    }

    debug.log(`[SessionPersistence] Loaded session ${data.conversationId.slice(0, 8)}... from localStorage`);
    return data;
  } catch (error) {
    debug.warn('[SessionPersistence] Failed to load session:', error);
    clearActiveSession(siteId);
    return null;
  }
}

/**
 * Clear any saved session from localStorage.
 *
 * Called when streaming completes, user discards, or on successful resume.
 *
 * @param siteId - The site ID for scoping
 */
export function clearActiveSession(siteId: string): void {
  if (!siteId) return;

  try {
    const key = getStorageKey(siteId);
    localStorage.removeItem(key);
    debug.log('[SessionPersistence] Cleared saved session');
  } catch (error) {
    debug.warn('[SessionPersistence] Failed to clear session:', error);
  }
}

/**
 * Check if there's a saved session without loading it.
 *
 * @param siteId - The site ID for scoping
 * @returns true if a session exists
 */
export function hasActiveSession(siteId: string): boolean {
  if (!siteId) return false;

  try {
    const key = getStorageKey(siteId);
    return localStorage.getItem(key) !== null;
  } catch {
    return false;
  }
}

/**
 * Get metadata about the saved session.
 *
 * @param siteId - The site ID for scoping
 * @returns Session metadata or null
 */
export function getActiveSessionMetadata(
  siteId: string
): { conversationId: string; streamingStartedAt: string } | null {
  if (!siteId) return null;

  try {
    const key = getStorageKey(siteId);
    const stored = localStorage.getItem(key);

    if (!stored) return null;

    const data: StoredSessionData = JSON.parse(stored);

    return {
      conversationId: data.conversationId,
      streamingStartedAt: data.streamingStartedAt,
    };
  } catch {
    return null;
  }
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Get the storage key scoped to a site.
 */
function getStorageKey(siteId: string): string {
  return `${STORAGE_KEY}:${siteId}`;
}
