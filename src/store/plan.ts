/**
 * Plan Store
 * Signal-based state management for multi-step execution plans.
 */

import { signal, computed } from '@preact/signals';
import type { ExecutionPlan, ExecutionStep, StepStatus } from '../core/plan';

// ============================================================================
// State Signals
// ============================================================================

/** Active execution plan (only one at a time) */
export const activePlan = signal<ExecutionPlan | null>(null);

/** Completed/cancelled plans for the session (for analytics/history) */
export const planHistory = signal<ExecutionPlan[]>([]);

// ============================================================================
// Computed Values
// ============================================================================

/** Whether there's an active plan */
export const hasActivePlan = computed(() => activePlan.value !== null);

/** Current step of the active plan (first ready or executing step) */
export const currentPlanStep = computed((): ExecutionStep | null => {
  if (!activePlan.value) return null;

  // Find the first step that is ready, executing, or awaiting confirmation
  return (
    activePlan.value.steps.find(
      (s) =>
        s.status === 'ready' ||
        s.status === 'executing' ||
        s.status === 'awaiting_confirmation'
    ) || null
  );
});

/** Number of completed or skipped steps */
export const completedPlanStepsCount = computed((): number => {
  if (!activePlan.value) return 0;
  return activePlan.value.steps.filter(
    (s) => s.status === 'completed' || s.status === 'skipped'
  ).length;
});

/** Progress as a fraction (0-1) */
export const planProgress = computed((): number => {
  if (!activePlan.value || activePlan.value.total_steps === 0) return 0;
  return activePlan.value.completed_steps / activePlan.value.total_steps;
});

/** Whether the plan is awaiting user to start it */
export const isPlanAwaitingStart = computed((): boolean => {
  return activePlan.value?.status === 'awaiting_start';
});

// ============================================================================
// Actions
// ============================================================================

/**
 * Set a new active plan.
 * Replaces any existing active plan.
 */
export function setPlan(plan: ExecutionPlan): void {
  // Move current plan to history if exists
  if (activePlan.value) {
    planHistory.value = [...planHistory.value, activePlan.value];
  }
  activePlan.value = plan;
}

/**
 * Update the active plan with new data from server.
 */
export function updatePlan(plan: ExecutionPlan): void {
  activePlan.value = plan;
}

/**
 * Update a specific step in the active plan.
 */
export function updatePlanStep(
  stepId: string,
  updates: Partial<ExecutionStep>
): void {
  if (!activePlan.value) return;

  const steps = activePlan.value.steps.map((step) =>
    step.id === stepId ? { ...step, ...updates } : step
  );

  // Update completed_steps count if status changed to completed
  let completedSteps = activePlan.value.completed_steps;
  if (updates.status === 'completed') {
    completedSteps = steps.filter((s) => s.status === 'completed').length;
  }

  activePlan.value = {
    ...activePlan.value,
    steps,
    completed_steps: completedSteps,
  };
}

/**
 * Clear the active plan.
 * Optionally moves it to history.
 */
export function clearPlan(addToHistory: boolean = true): void {
  if (activePlan.value && addToHistory) {
    planHistory.value = [...planHistory.value, activePlan.value];
  }
  activePlan.value = null;
}

/**
 * Get a step by ID from the active plan.
 */
export function getPlanStep(stepId: string): ExecutionStep | undefined {
  return activePlan.value?.steps.find((s) => s.id === stepId);
}

/**
 * Reset all plan state.
 */
export function resetPlanStore(): void {
  activePlan.value = null;
  planHistory.value = [];
}
