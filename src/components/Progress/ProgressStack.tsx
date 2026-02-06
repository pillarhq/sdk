/**
 * ProgressStack Component
 *
 * Renders a stack of progress events for an assistant message.
 * Used both during active streaming and after completion.
 *
 * Each event's expand/collapse state is driven by its actual `status` field
 * from the server (active = expanded, done/error = collapsed). This ensures
 * events transition naturally as the server sends status updates, rather than
 * being forced collapsed when response content arrives.
 */

import type { ProgressEvent } from '../../store/chat';
import { ProgressRow } from './ProgressRow';

export interface ProgressStackProps {
  events: ProgressEvent[];
}

/**
 * Renders an array of progress events as stacked rows.
 * Events are permanent — once yielded by the server, they remain in the
 * thread until a new conversation is started.
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
