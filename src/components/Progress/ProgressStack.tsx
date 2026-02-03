/**
 * ProgressStack Component
 *
 * Renders a stack of progress events during AI response generation.
 * Each event is displayed as a row with status icon, label, and optional streaming text.
 */

import type { ProgressEvent } from '../../store/chat';
import { ProgressRow } from './ProgressRow';

export interface ProgressStackProps {
  events: ProgressEvent[];
}

/**
 * Renders an array of progress events as stacked rows.
 * Used during active streaming to show the AI's progress.
 */
export function ProgressStack({ events }: ProgressStackProps) {
  if (!events || events.length === 0) return null;

  return (
    <div class="_pillar-progress-stack pillar-progress-stack">
      {events.map((event, idx) => (
        <ProgressRow
          key={event.id || event.progress_id || idx}
          progress={event}
          isActive={event.status === 'active'}
          isLast={idx === events.length - 1}
        />
      ))}
    </div>
  );
}
