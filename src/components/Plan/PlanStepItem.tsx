/**
 * PlanStepItem Component
 *
 * Renders a single step in an execution plan.
 * Shows status icon, description, and action buttons for confirmation/skip.
 */

import { h } from 'preact';
import type { ExecutionStep, StepStatus } from '../../core/plan';

// ============================================================================
// Icons
// ============================================================================

const ICONS = {
  pending: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/></svg>`,
  ready: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4" fill="currentColor"/></svg>`,
  awaiting_confirmation: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
  executing: `<svg class="pillar-plan-step__spinner" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>`,
  awaiting_result: `<svg class="pillar-plan-step__spinner" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>`,
  completed: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="9,12 12,15 16,10"/></svg>`,
  skipped: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" stroke-dasharray="4,2"/><line x1="8" y1="12" x2="16" y2="12"/></svg>`,
  failed: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
};

function getStatusIcon(status: StepStatus): string {
  switch (status) {
    case 'pending':
      return ICONS.pending;
    case 'ready':
      return ICONS.ready;
    case 'awaiting_confirmation':
      return ICONS.awaiting_confirmation;
    case 'executing':
      return ICONS.executing;
    case 'awaiting_result':
      return ICONS.awaiting_result;
    case 'completed':
      return ICONS.completed;
    case 'skipped':
      return ICONS.skipped;
    case 'failed':
      return ICONS.failed;
    default:
      return ICONS.pending;
  }
}

// ============================================================================
// PlanStepItem Component
// ============================================================================

interface PlanStepItemProps {
  step: ExecutionStep;
  onConfirm: (stepId: string, data?: Record<string, unknown>) => void;
  onSkip: (stepId: string) => void;
  onRetry?: (stepId: string) => void;
  onDone?: (stepId: string) => void;
}

export function PlanStepItem({ step, onConfirm, onSkip, onRetry, onDone }: PlanStepItemProps) {
  const handleConfirm = () => {
    onConfirm(step.id);
  };

  const handleSkip = () => {
    onSkip(step.id);
  };

  const handleRetry = () => {
    onRetry?.(step.id);
  };

  const handleDone = () => {
    onDone?.(step.id);
  };

  const isActive =
    step.status === 'ready' ||
    step.status === 'executing' ||
    step.status === 'awaiting_confirmation' ||
    step.status === 'awaiting_result';

  const canRetry = step.status === 'failed' && step.is_retriable && step.retry_count < step.max_retries;
  const statusClass = `pillar-plan-step pillar-plan-step--${step.status}`;

  return (
    <div class={statusClass}>
      <div class="pillar-plan-step__icon">
        <span dangerouslySetInnerHTML={{ __html: getStatusIcon(step.status) }} />
      </div>
      <div class="pillar-plan-step__content">
        <div class="pillar-plan-step__description">{step.description}</div>

        {step.status === 'awaiting_confirmation' && (
          <div class="pillar-plan-step__actions">
            <button
              type="button"
              class="pillar-plan-step__confirm-btn"
              onClick={handleConfirm}
            >
              Confirm
            </button>
            <button
              type="button"
              class="pillar-plan-step__skip-btn"
              onClick={handleSkip}
            >
              Skip
            </button>
          </div>
        )}

        {step.status === 'executing' && (
          <div class="pillar-plan-step__status-text">Running...</div>
        )}

        {step.status === 'awaiting_result' && (
          <div class="pillar-plan-step__awaiting-container">
            <div class="pillar-plan-step__instruction-row">
              <span class="pillar-plan-step__action-badge">In Progress</span>
              <span class="pillar-plan-step__instruction">Complete this step to continue</span>
            </div>
            <button
              type="button"
              class="pillar-plan-step__done-btn"
              onClick={handleDone}
            >
              Done
            </button>
          </div>
        )}

        {step.status === 'failed' && (
          <div class="pillar-plan-step__error-container">
            {step.error_message && (
              <div class="pillar-plan-step__error">{step.error_message}</div>
            )}
            {canRetry && (
              <div class="pillar-plan-step__retry-info">
                <span class="pillar-plan-step__retry-count">
                  Attempt {step.retry_count + 1} of {step.max_retries + 1}
                </span>
                <button
                  type="button"
                  class="pillar-plan-step__retry-btn"
                  onClick={handleRetry}
                >
                  Retry
                </button>
              </div>
            )}
            {!canRetry && step.retry_count >= step.max_retries && (
              <div class="pillar-plan-step__retry-exhausted">
                All retry attempts exhausted
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Styles
// ============================================================================

export const PLAN_STEP_STYLES = `
/* Individual Step */
.pillar-plan-step {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  background: var(--pillar-bg-primary, #ffffff);
  border: 1px solid var(--pillar-border, #e5e7eb);
  border-radius: 8px;
  transition: all 0.15s ease;
}

.pillar-plan-step__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  color: var(--pillar-text-tertiary, #9ca3af);
}

.pillar-plan-step__icon svg {
  width: 18px;
  height: 18px;
}

.pillar-plan-step__content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.pillar-plan-step__description {
  font-size: 13px;
  font-weight: 500;
  color: var(--pillar-text-primary, #374151);
  line-height: 1.4;
}

.pillar-plan-step__status-text {
  font-size: 12px;
  color: var(--pillar-primary, #2563eb);
  font-style: italic;
}

.pillar-plan-step__error {
  font-size: 12px;
  color: var(--pillar-danger, #dc2626);
}

.pillar-plan-step__actions {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}

/* Step States */
.pillar-plan-step--pending {
  opacity: 0.6;
}

.pillar-plan-step--ready {
  background: var(--pillar-bg-info-subtle, #eff6ff);
  border-color: var(--pillar-info, #93c5fd);
}

.pillar-plan-step--ready .pillar-plan-step__icon {
  color: var(--pillar-primary, #2563eb);
}

.pillar-plan-step--awaiting_confirmation {
  background: var(--pillar-bg-warning-subtle, #fef3c7);
  border-color: var(--pillar-warning, #fcd34d);
}

.pillar-plan-step--awaiting_confirmation .pillar-plan-step__icon {
  color: var(--pillar-warning-dark, #d97706);
}

.pillar-plan-step--executing,
.pillar-plan-step--awaiting_result {
  background: var(--pillar-bg-info-subtle, #eff6ff);
  border-color: var(--pillar-info, #93c5fd);
}

.pillar-plan-step--executing .pillar-plan-step__icon,
.pillar-plan-step--awaiting_result .pillar-plan-step__icon {
  color: var(--pillar-primary, #2563eb);
}

.pillar-plan-step--completed .pillar-plan-step__icon {
  color: var(--pillar-success, #059669);
}

.pillar-plan-step--completed .pillar-plan-step__description {
  text-decoration: line-through;
  color: var(--pillar-text-secondary, #6b7280);
}

.pillar-plan-step--skipped {
  opacity: 0.5;
}

.pillar-plan-step--skipped .pillar-plan-step__icon {
  color: var(--pillar-text-tertiary, #9ca3af);
}

.pillar-plan-step--skipped .pillar-plan-step__description {
  text-decoration: line-through;
  color: var(--pillar-text-tertiary, #9ca3af);
}

.pillar-plan-step--failed {
  background: var(--pillar-bg-danger-subtle, #fef2f2);
  border-color: var(--pillar-danger-light, #fca5a5);
}

.pillar-plan-step--failed .pillar-plan-step__icon {
  color: var(--pillar-danger, #dc2626);
}

/* Error Container */
.pillar-plan-step__error-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.pillar-plan-step__retry-info {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 2px;
}

.pillar-plan-step__retry-count {
  font-size: 11px;
  color: var(--pillar-text-tertiary, #9ca3af);
}

.pillar-plan-step__retry-exhausted {
  font-size: 11px;
  color: var(--pillar-text-tertiary, #9ca3af);
  font-style: italic;
  margin-top: 2px;
}

/* Retry Button */
.pillar-plan-step__retry-btn {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  font-size: 11px;
  font-weight: 600;
  font-family: inherit;
  background: var(--pillar-danger, #dc2626);
  color: #ffffff;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.pillar-plan-step__retry-btn:hover {
  background: var(--pillar-danger-hover, #b91c1c);
}

/* Confirm Button */
.pillar-plan-step__confirm-btn {
  display: inline-flex;
  align-items: center;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 600;
  font-family: inherit;
  background: var(--pillar-primary, #2563eb);
  color: #ffffff;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.pillar-plan-step__confirm-btn:hover {
  background: var(--pillar-primary-hover, #1d4ed8);
}

/* Skip Button */
.pillar-plan-step__skip-btn {
  display: inline-flex;
  align-items: center;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 500;
  font-family: inherit;
  background: transparent;
  color: var(--pillar-text-secondary, #6b7280);
  border: 1px solid var(--pillar-border, #d1d5db);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.pillar-plan-step__skip-btn:hover {
  background: var(--pillar-bg-tertiary, #f3f4f6);
  color: var(--pillar-text-primary, #374151);
}

/* Awaiting Result Container */
.pillar-plan-step__awaiting-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.pillar-plan-step__instruction-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.pillar-plan-step__action-badge {
  display: inline-block;
  padding: 2px 6px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  background: var(--pillar-warning, #f59e0b);
  color: white;
  border-radius: 3px;
  flex-shrink: 0;
}

.pillar-plan-step__instruction {
  font-size: 12px;
  color: var(--pillar-text-secondary, #6b7280);
}

/* Done Button */
.pillar-plan-step__done-btn {
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  padding: 6px 14px;
  font-size: 12px;
  font-weight: 600;
  font-family: inherit;
  background: var(--pillar-primary, #2563eb);
  color: #ffffff;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.pillar-plan-step__done-btn:hover {
  background: var(--pillar-primary-hover, #1d4ed8);
}

/* Spinner Animation for Executing Step */
@keyframes pillar-plan-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.pillar-plan-step__spinner {
  animation: pillar-plan-spin 1s linear infinite;
}
`;
