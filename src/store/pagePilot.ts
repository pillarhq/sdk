/**
 * Page Pilot Store
 * Signal-based state for tracking when the AI agent is piloting the page
 * (executing interact_with_page actions like click, type, select, etc.)
 */

import { signal } from '@preact/signals';

/** Current piloting operation type */
export type PilotOperation = 'click' | 'type' | 'select' | 'focus' | 'toggle' | null;

/** Whether page interaction is currently in progress */
export const isPiloting = signal(false);

/** Current operation type being performed */
export const pilotOperation = signal<PilotOperation>(null);

/** Flag to indicate cancellation was requested */
export const isCancelled = signal(false);

/** Tool call ID of the current action (for sending cancellation result) */
export const currentToolCallId = signal<string | null>(null);

/**
 * Start piloting mode - called when an interact_with_page action begins
 */
export function startPiloting(operation: PilotOperation, toolCallId?: string): void {
  isPiloting.value = true;
  pilotOperation.value = operation;
  isCancelled.value = false;
  currentToolCallId.value = toolCallId ?? null;
}

/**
 * Stop piloting mode - called when an interact_with_page action completes
 */
export function stopPiloting(): void {
  isPiloting.value = false;
  pilotOperation.value = null;
  currentToolCallId.value = null;
  // Note: Don't reset isCancelled here - let the caller check it first
}

/**
 * Cancel the current piloting action - called when user clicks Stop
 */
export function cancelPiloting(): void {
  isCancelled.value = true;
  // Don't stop piloting yet - let the action handler detect cancellation and clean up
}

/**
 * Reset cancellation flag after it's been handled
 */
export function resetCancellation(): void {
  isCancelled.value = false;
}

/**
 * Check if cancellation was requested
 */
export function wasCancelled(): boolean {
  return isCancelled.value;
}

// ============================================================================
// Destructive Action Confirmation
// ============================================================================

/** Whether a destructive action is awaiting user confirmation */
export const needsConfirmation = signal(false);

/** Human-readable description of the action pending confirmation */
export const confirmationLabel = signal<string | null>(null);

/** Resolver function for the confirmation promise */
export const confirmationResolver = signal<((confirmed: boolean) => void) | null>(null);

/**
 * Request user confirmation for a destructive action.
 * Shows a confirmation UI and returns a Promise that resolves when the user responds.
 *
 * @param label - Description of the action (e.g., 'Agent wants to click "Delete Account"')
 * @returns Promise<boolean> - true if user confirmed, false if denied
 */
export function requestConfirmation(label: string): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    confirmationLabel.value = label;
    confirmationResolver.value = resolve;
    needsConfirmation.value = true;
  });
}

/**
 * Resolve the pending confirmation request.
 * Called by the UI when the user clicks Allow or Deny.
 *
 * @param confirmed - Whether the user confirmed the action
 */
export function resolveConfirmation(confirmed: boolean): void {
  const resolver = confirmationResolver.value;
  // Reset state before resolving to avoid stale UI
  needsConfirmation.value = false;
  confirmationLabel.value = null;
  confirmationResolver.value = null;
  // Resolve the promise last so the handler sees clean state
  resolver?.(confirmed);
}
