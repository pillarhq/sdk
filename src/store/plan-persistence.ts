/**
 * Plan Persistence Module
 *
 * Handles localStorage persistence for active execution plans.
 * Enables plan recovery when the page is refreshed or the user
 * navigates away and returns.
 */

import type { ExecutionPlan } from '../core/plan';

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY = 'pillar:active_plan';
const STORAGE_VERSION = 1;

/**
 * Stored plan data with metadata.
 */
interface StoredPlanData {
  version: number;
  plan: ExecutionPlan;
  siteId: string;
  storedAt: string;
}

// ============================================================================
// Persistence Functions
// ============================================================================

/**
 * Save the active plan to localStorage.
 *
 * @param plan - The plan to persist
 * @param siteId - The site ID for scoping
 */
export function savePlan(plan: ExecutionPlan, siteId: string): void {
  if (!plan || !siteId) return;

  // Only save active plans (not completed/cancelled/failed)
  const activeStatuses = ['planning', 'ready', 'executing', 'awaiting_start', 'awaiting_input', 'awaiting_result'];
  if (!activeStatuses.includes(plan.status)) {
    // Clear instead of saving
    clearSavedPlan(siteId);
    return;
  }

  try {
    const data: StoredPlanData = {
      version: STORAGE_VERSION,
      plan,
      siteId,
      storedAt: new Date().toISOString(),
    };

    const key = getStorageKey(siteId);
    localStorage.setItem(key, JSON.stringify(data));

    console.log(`[PlanPersistence] Saved plan ${plan.id} to localStorage`);
  } catch (error) {
    console.warn('[PlanPersistence] Failed to save plan:', error);
  }
}

/**
 * Load a saved plan from localStorage.
 *
 * @param siteId - The site ID for scoping
 * @returns The saved plan or null if not found/invalid
 */
export function loadSavedPlan(siteId: string): ExecutionPlan | null {
  if (!siteId) return null;

  try {
    const key = getStorageKey(siteId);
    const stored = localStorage.getItem(key);

    if (!stored) return null;

    const data: StoredPlanData = JSON.parse(stored);

    // Version check
    if (data.version !== STORAGE_VERSION) {
      console.warn('[PlanPersistence] Stored plan has incompatible version, clearing');
      clearSavedPlan(siteId);
      return null;
    }

    // Site ID check
    if (data.siteId !== siteId) {
      console.warn('[PlanPersistence] Stored plan is for different site, clearing');
      clearSavedPlan(siteId);
      return null;
    }

    // Check if plan has timed out
    const storedAt = new Date(data.storedAt);
    const now = new Date();
    const timeoutMinutes = data.plan.timeout_minutes || 30;
    const ageMinutes = (now.getTime() - storedAt.getTime()) / (1000 * 60);

    if (ageMinutes > timeoutMinutes) {
      console.warn(
        `[PlanPersistence] Stored plan has timed out (${Math.round(ageMinutes)} minutes old, timeout: ${timeoutMinutes} minutes)`
      );
      clearSavedPlan(siteId);
      return null;
    }

    console.log(`[PlanPersistence] Loaded plan ${data.plan.id} from localStorage`);
    return data.plan;
  } catch (error) {
    console.warn('[PlanPersistence] Failed to load plan:', error);
    clearSavedPlan(siteId);
    return null;
  }
}

/**
 * Clear any saved plan from localStorage.
 *
 * @param siteId - The site ID for scoping
 */
export function clearSavedPlan(siteId: string): void {
  if (!siteId) return;

  try {
    const key = getStorageKey(siteId);
    localStorage.removeItem(key);
    console.log('[PlanPersistence] Cleared saved plan');
  } catch (error) {
    console.warn('[PlanPersistence] Failed to clear plan:', error);
  }
}

/**
 * Check if there's a saved plan without loading it.
 *
 * @param siteId - The site ID for scoping
 * @returns true if a plan exists
 */
export function hasSavedPlan(siteId: string): boolean {
  if (!siteId) return false;

  try {
    const key = getStorageKey(siteId);
    return localStorage.getItem(key) !== null;
  } catch {
    return false;
  }
}

/**
 * Get metadata about the saved plan without full deserialization.
 *
 * @param siteId - The site ID for scoping
 * @returns Plan metadata or null
 */
export function getSavedPlanMetadata(
  siteId: string
): { planId: string; goal: string; storedAt: string; status: string } | null {
  if (!siteId) return null;

  try {
    const key = getStorageKey(siteId);
    const stored = localStorage.getItem(key);

    if (!stored) return null;

    const data: StoredPlanData = JSON.parse(stored);

    return {
      planId: data.plan.id,
      goal: data.plan.goal,
      storedAt: data.storedAt,
      status: data.plan.status,
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
