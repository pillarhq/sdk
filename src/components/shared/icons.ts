/**
 * Shared Icons Module
 *
 * Centralized step status icons used across Plan and Workflow components.
 * Icons are parameterized by size and optional spinner class.
 */

import type { StepStatus } from '../../core/plan';
import type { WorkflowStepStatus } from '../../core/workflow';

export type IconSize = 14 | 16 | 18;

// ============================================================================
// Icon Generators
// ============================================================================

/**
 * Generate SVG icon with given size and optional class
 */
const createIcon = (
  size: IconSize,
  content: string,
  className?: string
): string => {
  const classAttr = className ? ` class="${className}"` : '';
  return `<svg${classAttr} width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${content}</svg>`;
};

// ============================================================================
// Step Status Icons
// ============================================================================

const ICON_CONTENT = {
  pending: '<circle cx="12" cy="12" r="10"/>',
  ready: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4" fill="currentColor"/>',
  awaiting_confirmation:
    '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
  spinner:
    '<path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>',
  completed:
    '<circle cx="12" cy="12" r="10"/><polyline points="9,12 12,15 16,10"/>',
  skipped:
    '<circle cx="12" cy="12" r="10" stroke-dasharray="4,2"/><line x1="8" y1="12" x2="16" y2="12"/>',
  failed:
    '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>',
  guidance:
    '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  plan: '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>',
  workflow:
    '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
};

/**
 * Get step status icon for execution plans.
 *
 * @param status - The step status
 * @param size - Icon size (14, 16, or 18)
 * @param spinnerClass - CSS class for spinner animation (executing/awaiting_result states)
 */
export function getStepStatusIcon(
  status: StepStatus,
  size: IconSize = 18,
  spinnerClass?: string
): string {
  switch (status) {
    case 'pending':
      return createIcon(size, ICON_CONTENT.pending);
    case 'ready':
      return createIcon(size, ICON_CONTENT.ready);
    case 'awaiting_confirmation':
      return createIcon(size, ICON_CONTENT.awaiting_confirmation);
    case 'executing':
    case 'awaiting_result':
      return createIcon(size, ICON_CONTENT.spinner, spinnerClass);
    case 'completed':
      return createIcon(size, ICON_CONTENT.completed);
    case 'skipped':
      return createIcon(size, ICON_CONTENT.skipped);
    case 'failed':
      return createIcon(size, ICON_CONTENT.failed);
    default:
      return createIcon(size, ICON_CONTENT.pending);
  }
}

/**
 * Get workflow step status icon.
 *
 * @param status - The workflow step status
 * @param size - Icon size (14, 16, or 18)
 * @param spinnerClass - CSS class for spinner animation (active state)
 */
export function getWorkflowStatusIcon(
  status: WorkflowStepStatus,
  size: IconSize = 18,
  spinnerClass?: string
): string {
  switch (status) {
    case 'pending':
      return createIcon(size, ICON_CONTENT.pending);
    case 'awaiting_initiation':
      return createIcon(size, ICON_CONTENT.ready); // Same as "ready" - dot in circle
    case 'active':
      return createIcon(size, ICON_CONTENT.spinner, spinnerClass);
    case 'completed':
      return createIcon(size, ICON_CONTENT.completed);
    case 'skipped':
      return createIcon(size, ICON_CONTENT.skipped);
    case 'failed':
      return createIcon(size, ICON_CONTENT.failed);
    default:
      return createIcon(size, ICON_CONTENT.pending);
  }
}

/**
 * Get the guidance icon (question mark in circle).
 */
export function getGuidanceIcon(size: IconSize = 14): string {
  return createIcon(size, ICON_CONTENT.guidance);
}

/**
 * Get the plan header icon (checkmark with document).
 */
export function getPlanIcon(size: IconSize = 16): string {
  return createIcon(size, ICON_CONTENT.plan);
}

/**
 * Get the workflow header icon (grid of squares).
 */
export function getWorkflowIcon(size: IconSize = 16): string {
  return createIcon(size, ICON_CONTENT.workflow);
}
