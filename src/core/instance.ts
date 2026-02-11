/**
 * Pillar Singleton Instance Registry
 *
 * Lightweight module that holds the Pillar singleton reference.
 * Components import from here instead of Pillar.ts to avoid circular dependencies.
 *
 * The cycle exists because Pillar.ts imports components (Panel, DebugPanel)
 * to render them, and those components need Pillar.getInstance() for config,
 * events, and task execution. This module breaks that cycle.
 */

import type { APIClient } from "../api/client";

// The singleton instance, set by Pillar.init() and cleared by Pillar.destroy()
let _instance: any = null;

/** Store the Pillar singleton (called from Pillar.ts) */
export function setPillarInstance(instance: any): void {
  _instance = instance;
}

/** Get the current Pillar instance (replaces Pillar.getInstance() in components) */
export function getPillarInstance(): any {
  return _instance;
}

/**
 * Get the API client from the current Pillar instance.
 * Returns null if SDK is not initialized.
 */
export function getApiClient(): APIClient | null {
  return _instance?.["_api"] ?? null;
}
