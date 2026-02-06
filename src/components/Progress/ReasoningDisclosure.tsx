/**
 * ReasoningDisclosure Component
 *
 * Renders completed progress events inline after a message.
 * Each progress row handles its own expand/collapse (Cursor-style).
 * No outer collapsible wrapper — events are displayed directly.
 */

import type { ProgressEvent } from '../../store/chat';
import { ProgressRow } from './ProgressRow';

export interface ReasoningDisclosureProps {
  events: ProgressEvent[];
  /** @deprecated No longer used — kept for API compatibility */
  defaultExpanded?: boolean;
  /** @deprecated No longer used — kept for API compatibility */
  id?: string;
}

export function ReasoningDisclosure({
  events,
}: ReasoningDisclosureProps) {
  if (!events || events.length === 0) return null;

  return (
    <div class="_pillar-reasoning-disclosure pillar-reasoning-disclosure">
      {events.map((event, idx) => (
        <ProgressRow
          key={event.id || event.progress_id || idx}
          progress={event}
          isActive={false}
        />
      ))}
    </div>
  );
}
