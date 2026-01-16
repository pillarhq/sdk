/**
 * InlinePlanView Component
 *
 * A compact inline version of the plan display for embedding
 * within chat bubbles when plans are short (≤3 steps).
 *
 * This provides a more integrated experience where the plan
 * appears as part of the conversation flow rather than a
 * separate overlay.
 */

import { h } from 'preact';
import type { ExecutionPlan, ExecutionStep, StepStatus } from '../../core/plan';
import Pillar from '../../core/Pillar';

// ============================================================================
// Constants
// ============================================================================

/** Maximum steps before using full PlanView instead of inline */
export const INLINE_PLAN_MAX_STEPS = 3;

// ============================================================================
// Icons
// ============================================================================

const ICONS = {
  pending: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/></svg>`,
  ready: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4" fill="currentColor"/></svg>`,
  awaiting_confirmation: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
  executing: `<svg class="pillar-inline-plan__spinner" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>`,
  awaiting_result: `<svg class="pillar-inline-plan__spinner" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>`,
  completed: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="9,12 12,15 16,10"/></svg>`,
  skipped: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" stroke-dasharray="4,2"/><line x1="8" y1="12" x2="16" y2="12"/></svg>`,
  failed: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
};

function getStatusIcon(status: StepStatus): string {
  return ICONS[status] || ICONS.pending;
}

// ============================================================================
// InlineStepItem Component
// ============================================================================

interface InlineStepItemProps {
  step: ExecutionStep;
  onConfirm: (stepId: string) => void;
  onSkip: (stepId: string) => void;
  onRetry: (stepId: string) => void;
  onDone: (stepId: string) => void;
}

function InlineStepItem({ step, onConfirm, onSkip, onRetry, onDone }: InlineStepItemProps) {
  const canRetry = step.status === 'failed' && step.is_retriable && step.retry_count < step.max_retries;
  const isAwaitingResult = step.status === 'awaiting_result';

  return (
    <div class={`pillar-inline-plan__step pillar-inline-plan__step--${step.status}`}>
      <span
        class="pillar-inline-plan__step-icon"
        dangerouslySetInnerHTML={{ __html: getStatusIcon(step.status) }}
      />
      <div class="pillar-inline-plan__step-content">
        <span class="pillar-inline-plan__step-text">{step.description}</span>
        
        {isAwaitingResult && (
          <div class="pillar-inline-plan__step-instruction">
            <span class="pillar-inline-plan__action-badge">In Progress</span>
          </div>
        )}
      </div>

      {step.status === 'awaiting_confirmation' && (
        <div class="pillar-inline-plan__step-actions">
          <button
            type="button"
            class="pillar-inline-plan__btn pillar-inline-plan__btn--confirm"
            onClick={() => onConfirm(step.id)}
          >
            ✓
          </button>
          <button
            type="button"
            class="pillar-inline-plan__btn pillar-inline-plan__btn--skip"
            onClick={() => onSkip(step.id)}
          >
            Skip
          </button>
        </div>
      )}

      {isAwaitingResult && (
        <button
          type="button"
          class="pillar-inline-plan__btn pillar-inline-plan__btn--done"
          onClick={() => onDone(step.id)}
        >
          Done
        </button>
      )}

      {canRetry && (
        <button
          type="button"
          class="pillar-inline-plan__btn pillar-inline-plan__btn--retry"
          onClick={() => onRetry(step.id)}
        >
          Retry
        </button>
      )}
    </div>
  );
}

// ============================================================================
// InlinePlanView Component
// ============================================================================

interface InlinePlanViewProps {
  plan: ExecutionPlan;
}

export function InlinePlanView({ plan }: InlinePlanViewProps) {
  const pillar = Pillar.getInstance();

  const handleConfirm = (stepId: string) => {
    pillar?.confirmPlanStep(stepId);
  };

  const handleSkip = (stepId: string) => {
    pillar?.skipPlanStep(stepId);
  };

  const handleRetry = (stepId: string) => {
    pillar?.retryPlanStep(stepId);
  };

  const handleDone = (stepId: string) => {
    pillar?.markPlanStepDone(stepId);
  };

  const handleStart = () => {
    pillar?.startPlan();
  };

  const handleCancel = () => {
    pillar?.cancelPlan();
  };

  const isAwaitingStart = plan.status === 'awaiting_start';
  const isComplete = plan.status === 'completed';
  const isFailed = plan.status === 'failed';
  const isCancelled = plan.status === 'cancelled';

  return (
    <div class={`pillar-inline-plan pillar-inline-plan--${plan.status}`}>
      {/* Steps */}
      <div class="pillar-inline-plan__steps">
        {plan.steps.map((step) => (
          <InlineStepItem
            key={step.id}
            step={step}
            onConfirm={handleConfirm}
            onSkip={handleSkip}
            onRetry={handleRetry}
            onDone={handleDone}
          />
        ))}
      </div>

      {/* Footer actions */}
      {isAwaitingStart && (
        <div class="pillar-inline-plan__footer">
          <button
            type="button"
            class="pillar-inline-plan__btn pillar-inline-plan__btn--start"
            onClick={handleStart}
          >
            Start
          </button>
          <button
            type="button"
            class="pillar-inline-plan__btn pillar-inline-plan__btn--cancel"
            onClick={handleCancel}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Status messages */}
      {isComplete && (
        <div class="pillar-inline-plan__status pillar-inline-plan__status--success">
          ✓ Completed
        </div>
      )}

      {isFailed && (
        <div class="pillar-inline-plan__status pillar-inline-plan__status--error">
          Plan failed
        </div>
      )}

      {isCancelled && (
        <div class="pillar-inline-plan__status pillar-inline-plan__status--cancelled">
          Cancelled
        </div>
      )}
    </div>
  );
}

/**
 * Check if a plan should be displayed inline.
 */
export function shouldDisplayInline(plan: ExecutionPlan): boolean {
  return plan.total_steps <= INLINE_PLAN_MAX_STEPS;
}

// ============================================================================
// Styles
// ============================================================================

export const INLINE_PLAN_STYLES = `
/* Inline Plan Container */
.pillar-inline-plan {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 0;
}

/* Steps list */
.pillar-inline-plan__steps {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

/* Individual step */
.pillar-inline-plan__step {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 13px;
  background: transparent;
  transition: all 0.15s ease;
}

.pillar-inline-plan__step-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: var(--pillar-text-tertiary, #9ca3af);
}

.pillar-inline-plan__step-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.pillar-inline-plan__step-text {
  color: var(--pillar-text-primary, #374151);
  line-height: 1.4;
}

.pillar-inline-plan__step-instruction {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.pillar-inline-plan__action-badge {
  display: inline-block;
  padding: 1px 5px;
  font-size: 9px;
  font-weight: 600;
  text-transform: uppercase;
  background: var(--pillar-warning, #f59e0b);
  color: white;
  border-radius: 3px;
  flex-shrink: 0;
}

.pillar-inline-plan__instruction-text {
  font-size: 11px;
  color: var(--pillar-text-secondary, #6b7280);
}

.pillar-inline-plan__step-actions {
  display: flex;
  gap: 4px;
}

/* Step states */
.pillar-inline-plan__step--pending {
  opacity: 0.6;
}

.pillar-inline-plan__step--ready .pillar-inline-plan__step-icon {
  color: var(--pillar-primary, #2563eb);
}

.pillar-inline-plan__step--awaiting_confirmation {
  background: var(--pillar-bg-warning-subtle, rgba(251, 191, 36, 0.1));
}

.pillar-inline-plan__step--awaiting_confirmation .pillar-inline-plan__step-icon {
  color: var(--pillar-warning-dark, #d97706);
}

.pillar-inline-plan__step--executing .pillar-inline-plan__step-icon,
.pillar-inline-plan__step--awaiting_result .pillar-inline-plan__step-icon {
  color: var(--pillar-primary, #2563eb);
}

.pillar-inline-plan__step--completed .pillar-inline-plan__step-icon {
  color: var(--pillar-success, #059669);
}

.pillar-inline-plan__step--completed .pillar-inline-plan__step-text {
  text-decoration: line-through;
  color: var(--pillar-text-secondary, #6b7280);
}

.pillar-inline-plan__step--skipped {
  opacity: 0.5;
}

.pillar-inline-plan__step--skipped .pillar-inline-plan__step-text {
  text-decoration: line-through;
}

.pillar-inline-plan__step--failed {
  background: var(--pillar-bg-danger-subtle, rgba(220, 38, 38, 0.1));
}

.pillar-inline-plan__step--failed .pillar-inline-plan__step-icon {
  color: var(--pillar-danger, #dc2626);
}

/* Buttons */
.pillar-inline-plan__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 3px 8px;
  font-size: 11px;
  font-weight: 500;
  font-family: inherit;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s ease;
  border: none;
}

.pillar-inline-plan__btn--confirm {
  background: var(--pillar-success, #059669);
  color: #ffffff;
  min-width: 24px;
}

.pillar-inline-plan__btn--confirm:hover {
  background: var(--pillar-success-hover, #047857);
}

.pillar-inline-plan__btn--skip {
  background: transparent;
  color: var(--pillar-text-secondary, #6b7280);
  border: 1px solid var(--pillar-border, #d1d5db);
}

.pillar-inline-plan__btn--skip:hover {
  background: var(--pillar-bg-tertiary, #f3f4f6);
}

.pillar-inline-plan__btn--retry {
  background: var(--pillar-danger, #dc2626);
  color: #ffffff;
}

.pillar-inline-plan__btn--retry:hover {
  background: var(--pillar-danger-hover, #b91c1c);
}

.pillar-inline-plan__btn--done {
  background: var(--pillar-primary, #2563eb);
  color: #ffffff;
}

.pillar-inline-plan__btn--done:hover {
  background: var(--pillar-primary-hover, #1d4ed8);
}

.pillar-inline-plan__btn--start {
  background: var(--pillar-primary, #2563eb);
  color: #ffffff;
}

.pillar-inline-plan__btn--start:hover {
  background: var(--pillar-primary-hover, #1d4ed8);
}

.pillar-inline-plan__btn--cancel {
  background: transparent;
  color: var(--pillar-text-secondary, #6b7280);
  border: 1px solid var(--pillar-border, #d1d5db);
}

.pillar-inline-plan__btn--cancel:hover {
  background: var(--pillar-bg-tertiary, #f3f4f6);
  color: var(--pillar-danger, #dc2626);
  border-color: var(--pillar-danger, #dc2626);
}

/* Footer */
.pillar-inline-plan__footer {
  display: flex;
  gap: 8px;
  padding-top: 6px;
}

/* Status messages */
.pillar-inline-plan__status {
  font-size: 12px;
  font-weight: 500;
  padding: 4px 8px;
  border-radius: 4px;
}

.pillar-inline-plan__status--success {
  color: var(--pillar-success, #059669);
  background: var(--pillar-bg-success-subtle, rgba(5, 150, 105, 0.1));
}

.pillar-inline-plan__status--error {
  color: var(--pillar-danger, #dc2626);
  background: var(--pillar-bg-danger-subtle, rgba(220, 38, 38, 0.1));
}

.pillar-inline-plan__status--cancelled {
  color: var(--pillar-text-tertiary, #9ca3af);
  background: var(--pillar-bg-tertiary, #f3f4f6);
}

/* Spinner animation */
@keyframes pillar-inline-plan-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.pillar-inline-plan__spinner {
  animation: pillar-inline-plan-spin 1s linear infinite;
}
`;
