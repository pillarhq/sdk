/**
 * ProgressGroup Component
 *
 * Collapsible group of tool-related progress events.
 * Level 2 in the 3-level hierarchy:
 *   1. Thinking rows (standalone, rendered by ProgressStack)
 *   2. ProgressGroup — summary header with chevron, expands to show children
 *   3. ProgressRow — individual tool items inside the group
 *
 * Auto-expands when any child is active; collapses when all are done.
 * User can manually toggle.
 */

import { useState, useEffect } from 'preact/hooks';
import type { ProgressEvent } from '../../store/chat';
import { ProgressRow } from './ProgressRow';

export interface ProgressGroupProps {
  events: ProgressEvent[];
  summary: string;
  isLast?: boolean;
  responseStarted?: boolean;
}

export function ProgressGroup({
  events,
  summary,
  isLast = false,
  responseStarted = false,
}: ProgressGroupProps) {
  // Check if any child is still active
  const hasActiveChild = events.some(e => e.status === 'active');

  // Manual toggle state
  const [isManuallyToggled, setIsManuallyToggled] = useState(false);
  const [manualExpandState, setManualExpandState] = useState(false);

  // Auto-expand when a child becomes active, auto-collapse when all done.
  // Stay expanded if this is the last group and narration text hasn't arrived yet.
  // User can override with manual toggle.
  const isExpanded = isManuallyToggled
    ? manualExpandState
    : (hasActiveChild || (isLast && !responseStarted));

  // Reset manual toggle when active state changes
  useEffect(() => {
    if (hasActiveChild) {
      // If a child becomes active, reset manual toggle so it auto-expands
      setIsManuallyToggled(false);
    }
  }, [hasActiveChild]);

  const handleToggle = () => {
    setIsManuallyToggled(true);
    setManualExpandState(!isExpanded);
  };

  const chevronRotation = isExpanded ? 'rotate(90deg)' : 'rotate(0deg)';

  return (
    <div
      class={`_pillar-progress-group pillar-progress-group${hasActiveChild ? ' _pillar-progress-group--active pillar-progress-group--active' : ''}${isLast ? ' _pillar-progress-group--last pillar-progress-group--last' : ''}`}
    >
      {/* Summary header */}
      <div
        class="_pillar-progress-group-header pillar-progress-group-header"
        onClick={handleToggle}
        role="button"
        aria-expanded={isExpanded}
        tabIndex={0}
        onKeyDown={(e: KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleToggle();
          }
        }}
      >
        <span
          class="_pillar-progress-group-chevron pillar-progress-group-chevron"
          style={{
            transform: chevronRotation,
            transition: 'transform 0.2s ease',
          }}
          aria-hidden="true"
        >
          ▶
        </span>
        <span class="_pillar-progress-group-summary pillar-progress-group-summary">
          {summary}
        </span>
        {hasActiveChild && (
          <span class="_pillar-progress-group-active-dot pillar-progress-group-active-dot" />
        )}
      </div>

      {/* Expandable children */}
      <div
        class={`_pillar-progress-group-children pillar-progress-group-children ${isExpanded ? '_pillar-progress-group-children--expanded pillar-progress-group-children--expanded' : ''}`}
      >
        <div class="_pillar-progress-group-children-inner pillar-progress-group-children-inner">
          {events.map((event, idx) => (
            <ProgressRow
              key={event.id || event.progress_id || idx}
              progress={event}
              isActive={event.status === 'active'}
              isLast={idx === events.length - 1}
              responseStarted={responseStarted}
              nested={true}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
