/**
 * PlanStepItem Component
 *
 * Renders a single step in an execution plan.
 * Shows status icon, description, and action buttons for confirmation/skip.
 * 
 * For inline_ui action types, renders an inline card for user interaction
 * (e.g., invite form, confirmation dialog).
 */

import { h } from 'preact';
import { useRef } from 'preact/hooks';
import type { ExecutionStep } from '../../core/plan';
import { getStepStatusIcon } from '../shared/icons';
import { useInlineCard } from '../../hooks/useInlineCard';

// ============================================================================
// PlanStepItem Component
// ============================================================================

interface PlanStepItemProps {
  step: ExecutionStep;
  onConfirm: (stepId: string, data?: Record<string, unknown>) => void;
  onSkip: (stepId: string) => void;
  onRetry?: (stepId: string) => void;
  onDone?: (stepId: string) => void;
  /** Called when an inline_ui action is confirmed with data */
  onInlineConfirm?: (stepId: string, data?: Record<string, unknown>) => void;
}

export function PlanStepItem({ step, onConfirm, onSkip, onRetry, onDone, onInlineConfirm }: PlanStepItemProps) {
  // Ref for inline_ui card container
  const inlineCardRef = useRef<HTMLDivElement>(null);
  
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
  
  // Use shared hook for inline card rendering
  const { shouldShow: shouldShowInlineCard, isInlineUI } = useInlineCard({
    step,
    containerRef: inlineCardRef,
    onConfirm: onInlineConfirm,
    onSkip,
    componentName: 'PlanStepItem',
  });

  const canRetry = step.status === 'failed' && step.is_retriable && step.retry_count < step.max_retries;
  const statusClass = `pillar-plan-step pillar-plan-step--${step.status}`;

  return (
    <div class={statusClass}>
      <div class="pillar-plan-step__icon">
        <span dangerouslySetInnerHTML={{ __html: getStepStatusIcon(step.status, 18, 'pillar-plan-step__spinner') }} />
      </div>
      <div class="pillar-plan-step__content">
        <div class="pillar-plan-step__description">{step.description}</div>

        {/* Inline UI card for inline_ui action types */}
        {shouldShowInlineCard && (
          <div 
            ref={inlineCardRef} 
            class="pillar-plan-step__inline-card"
          />
        )}

        {step.status === 'awaiting_confirmation' && !isInlineUI && (
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

        {step.status === 'executing' && !isInlineUI && (
          <div class="pillar-plan-step__status-text">Running...</div>
        )}

        {step.status === 'awaiting_result' && !isInlineUI && (
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
/* Individual Step - minimal checklist style */
.pillar-plan-step {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 4px 0;
}

.pillar-plan-step__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  margin-top: 1px;
  color: var(--pillar-text-tertiary, #9ca3af);
}

.pillar-plan-step__icon svg {
  width: 16px;
  height: 16px;
}

.pillar-plan-step__content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.pillar-plan-step__description {
  font-size: 13px;
  font-weight: 400;
  color: var(--pillar-text-primary, #374151);
  line-height: 1.4;
}

.pillar-plan-step__status-text {
  font-size: 12px;
  color: var(--pillar-text-tertiary, #9ca3af);
}

.pillar-plan-step__error {
  font-size: 12px;
  color: var(--pillar-danger, #dc2626);
}

.pillar-plan-step__actions {
  display: flex;
  gap: 8px;
  margin-top: 2px;
}

/* Step States - minimal styling */
.pillar-plan-step--pending {
  opacity: 0.5;
}

.pillar-plan-step--pending .pillar-plan-step__icon {
  color: var(--pillar-text-tertiary, #9ca3af);
}

.pillar-plan-step--ready .pillar-plan-step__icon {
  color: var(--pillar-primary, #2563eb);
}

.pillar-plan-step--awaiting_confirmation .pillar-plan-step__icon {
  color: var(--pillar-warning-dark, #d97706);
}

.pillar-plan-step--executing .pillar-plan-step__icon,
.pillar-plan-step--awaiting_result .pillar-plan-step__icon {
  color: var(--pillar-primary, #2563eb);
}

.pillar-plan-step--completed .pillar-plan-step__icon {
  color: var(--pillar-success, #059669);
}

.pillar-plan-step--completed .pillar-plan-step__description {
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

/* Inline Card Container */
.pillar-plan-step__inline-card {
  margin-top: 8px;
}

.pillar-plan-step__inline-card .pillar-confirm-card {
  margin: 0;
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
