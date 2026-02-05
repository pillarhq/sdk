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
