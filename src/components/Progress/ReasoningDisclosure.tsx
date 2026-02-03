/**
 * ReasoningDisclosure Component
 *
 * Displays the AI's reasoning/thinking steps in a collapsible section.
 * Used to show progress events after a message is complete.
 * 
 * Features:
 * - Animated expand/collapse using CSS Grid
 * - Accessible with ARIA attributes
 * - Keyboard navigation support
 */

import { h } from 'preact';
import { useState } from 'preact/hooks';
import type { ProgressEvent } from '../../store/chat';
import { ProgressRow } from './ProgressRow';

export interface ReasoningDisclosureProps {
  events: ProgressEvent[];
  defaultExpanded?: boolean;
  /** Unique ID for accessibility - defaults to 'reasoning' */
  id?: string;
}

export function ReasoningDisclosure({
  events,
  defaultExpanded = false,
  id = 'reasoning',
}: ReasoningDisclosureProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  if (!events || events.length === 0) return null;

  const contentId = `${id}-content`;

  return (
    <div 
      class="_pillar-reasoning-disclosure pillar-reasoning-disclosure"
      role="region"
      aria-label="AI reasoning steps"
    >
      <button
        type="button"
        class="_pillar-reasoning-header pillar-reasoning-header"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
        aria-controls={contentId}
        data-expanded={isExpanded}
      >
        <span
          class="_pillar-reasoning-icon pillar-reasoning-icon"
          aria-hidden="true"
        >
          ▶
        </span>
        <span class="_pillar-reasoning-label pillar-reasoning-label">
          Reasoning ({events.length} step{events.length !== 1 ? 's' : ''})
        </span>
      </button>

      {/* Always render content wrapper for smooth animation */}
      <div 
        class={`_pillar-reasoning-content-wrapper pillar-reasoning-content-wrapper ${isExpanded ? '_pillar-reasoning-content-wrapper--expanded pillar-reasoning-content-wrapper--expanded' : ''}`}
        id={contentId}
        role="region"
        aria-hidden={!isExpanded}
      >
        <div class="_pillar-reasoning-content pillar-reasoning-content">
          {events.map((event, idx) => (
            <ProgressRow
              key={event.id || event.progress_id || idx}
              progress={event}
              isActive={false}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
