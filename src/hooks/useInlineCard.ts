/**
 * useInlineCard Hook
 *
 * Shared hook for rendering inline_ui cards in plan steps.
 * Consolidates duplicated logic from InlinePlanView and PlanStepItem.
 */

import { useEffect } from 'preact/hooks';
import type { RefObject } from 'preact';
import Pillar from '../core/Pillar';
import { debug } from '../utils/debug';
import type { CardCallbacks } from '../core/events';
import type { ExecutionStep } from '../core/plan';
import { createDefaultConfirmCard } from '../components/Cards/ConfirmActionCard';
import type { TaskButtonData } from '../components/Panel/TaskButton';

export interface UseInlineCardOptions {
  /** The execution step to render a card for */
  step: ExecutionStep;
  /** Ref to the container element for the card */
  containerRef: RefObject<HTMLDivElement>;
  /** Called when the inline card is confirmed with optional data */
  onConfirm?: (stepId: string, data?: Record<string, unknown>) => void;
  /** Called when the inline card is cancelled/skipped */
  onSkip: (stepId: string) => void;
  /** Component name for debug logging */
  componentName?: string;
}

export interface UseInlineCardResult {
  /** Whether the inline card should be shown */
  shouldShow: boolean;
  /** Whether this step is an inline_ui type */
  isInlineUI: boolean;
}

/**
 * Hook to manage inline_ui card rendering for plan steps.
 *
 * Handles:
 * - Determining when to show the inline card
 * - Rendering custom or default confirm cards
 * - Wiring up confirm/cancel/stateChange callbacks
 */
export function useInlineCard({
  step,
  containerRef,
  onConfirm,
  onSkip,
  componentName = 'InlineCard',
}: UseInlineCardOptions): UseInlineCardResult {
  const isInlineUI = step.action_type === 'inline_ui';
  const shouldShow =
    isInlineUI && (step.status === 'ready' || step.status === 'awaiting_result');

  useEffect(() => {
    if (!shouldShow || !containerRef.current) return;

    // Clear existing content
    containerRef.current.innerHTML = '';

    const pillar = Pillar.getInstance();
    const cardType =
      (step.action_data?.card_type as string) || step.action_name || 'default';
    const customRenderer = pillar?.getCardRenderer(cardType);

    // Create TaskButtonData-like object for the card
    const actionForCard: TaskButtonData = {
      id: step.id,
      name: step.action_name || 'action',
      taskType: 'inline_ui',
      data: step.action_data || {},
    };

    const callbacks: CardCallbacks = {
      onConfirm: (data) => {
        if (onConfirm) {
          onConfirm(step.id, data);
        } else if (pillar) {
          // Execute the task with the data
          pillar.executeTask({
            id: step.id,
            name: step.action_name || 'action',
            taskType: 'inline_ui',
            data: data || step.action_data || {},
          });
        }
      },
      onCancel: () => {
        onSkip(step.id);
      },
      onStateChange: (_state, _message) => {
        // State change logging removed - can be added via debug utility if needed
      },
    };

    if (customRenderer) {
      try {
        customRenderer(containerRef.current, step.action_data || {}, callbacks);
      } catch (err) {
        debug.error(`[${componentName}] Custom card renderer error:`, err);
      }
    } else {
      const defaultCard = createDefaultConfirmCard(actionForCard, callbacks);
      containerRef.current.appendChild(defaultCard);
    }
  }, [shouldShow, step.id, step.action_data, step.action_name, onConfirm, onSkip, componentName]);

  return { shouldShow, isInlineUI };
}
