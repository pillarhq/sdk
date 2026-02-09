/**
 * ProgressStack Component
 *
 * Renders a stack of progress events with 3-level visual hierarchy:
 * 1. Thinking rows — "Thought for Xs" (top level, standalone)
 * 2. Tool groups — collapsible summary like "Searched 2 sources, ran 1 tool"
 * 3. Individual tool rows — nested inside groups (visible when expanded)
 *
 * Content tokens from the model flow through onToken and render as inline
 * message text in the ChatView — they don't appear as progress events.
 * Segmentation only handles thinking and tool events.
 */

import type { ProgressEvent } from '../../store/chat';
import { ProgressRow } from './ProgressRow';
import { ProgressGroup } from './ProgressGroup';

export interface ProgressStackProps {
  events: ProgressEvent[];
  /** When true, the response has started streaming - collapse non-manually-opened rows */
  responseStarted?: boolean;
}

/**
 * A segment is either a standalone thinking event or a group of tool events.
 */
type Segment =
  | { type: 'thinking'; event: ProgressEvent }
  | { type: 'tool_group'; events: ProgressEvent[]; summary: string };

/**
 * Tool-related event kinds that get grouped together.
 */
const TOOL_KINDS = new Set([
  'search',
  'search_complete',
  'tool_call',
  'plan',
  'generating',
  'query',
  'query_complete',
  'query_failed',
  'step_complete',
  'processing',
]);

/**
 * Walk the events array and group consecutive tool-related events together.
 * Thinking events break groups and appear as standalone segments.
 */
function segmentEvents(events: ProgressEvent[]): Segment[] {
  const segments: Segment[] = [];
  let currentToolGroup: ProgressEvent[] = [];

  const flushToolGroup = () => {
    if (currentToolGroup.length > 0) {
      segments.push({
        type: 'tool_group',
        events: [...currentToolGroup],
        summary: generateSummary(currentToolGroup),
      });
      currentToolGroup = [];
    }
  };

  for (const event of events) {
    const isThinking = event.kind === 'thinking' || event.kind === 'step_start';

    if (isThinking) {
      flushToolGroup();
      segments.push({ type: 'thinking', event });
    } else if (TOOL_KINDS.has(event.kind)) {
      currentToolGroup.push(event);
    } else {
      // Unknown kind — treat as tool event to group it
      currentToolGroup.push(event);
    }
  }

  // Flush any remaining tool events
  flushToolGroup();

  return segments;
}

/**
 * Status-update event kinds that don't represent a distinct user-visible action.
 * These are filtered out when deciding whether to use a single-event label.
 */
const STATUS_UPDATE_KINDS = new Set([
  'search_complete',
  'query_complete',
  'step_complete',
]);

/**
 * Generate a human-readable summary for a group of tool events.
 * e.g., "Searched 2 sources, ran 1 action"
 *
 * Special case: when only one "real" event exists (ignoring status updates),
 * use that event's label directly for a more descriptive summary.
 */
function generateSummary(events: ProgressEvent[]): string {
  // Filter to meaningful events (skip pure status-update kinds)
  const meaningfulEvents = events.filter(e => !STATUS_UPDATE_KINDS.has(e.kind));

  // Special case: single meaningful event — use its label directly
  if (meaningfulEvents.length === 1 && meaningfulEvents[0].label) {
    return meaningfulEvents[0].label;
  }

  let searchCount = 0;
  let actionCount = 0;
  let otherCount = 0;

  for (const event of events) {
    switch (event.kind) {
      case 'search':
      case 'search_complete':
        searchCount++;
        break;
      case 'query':
      case 'query_complete':
      case 'query_failed':
      case 'tool_call':
        actionCount++;
        break;
      default:
        otherCount++;
        break;
    }
  }

  // Deduplicate: search + search_complete for the same search = 1 search
  // Count unique search pairs (search_complete implies a completed search)
  const searchCompleteCount = events.filter(e => e.kind === 'search_complete').length;
  const searchStartCount = events.filter(e => e.kind === 'search').length;
  const uniqueSearches = Math.max(searchCompleteCount, searchStartCount);

  const parts: string[] = [];
  if (uniqueSearches > 0) {
    parts.push(`Searched ${uniqueSearches} ${uniqueSearches === 1 ? 'source' : 'sources'}`);
  }
  if (actionCount > 0) {
    parts.push(`Ran ${actionCount} ${actionCount === 1 ? 'action' : 'actions'}`);
  }
  if (otherCount > 0 && parts.length === 0) {
    parts.push(`${otherCount} ${otherCount === 1 ? 'step' : 'steps'}`);
  }

  return parts.length > 0 ? parts.join(', ') : `${events.length} steps`;
}

/**
 * Renders an array of progress events as a segmented stack.
 * Events are permanent — once yielded by the server, they remain in the
 * thread until a new conversation is started.
 */
export function ProgressStack({ events, responseStarted = false }: ProgressStackProps) {
  if (!events || events.length === 0) return null;

  const segments = segmentEvents(events);

  return (
    <div class="_pillar-progress-stack pillar-progress-stack">
      {segments.flatMap((segment, idx) => {
        if (segment.type === 'thinking') {
          return [
            <ProgressRow
              key={segment.event.id || segment.event.progress_id || `thinking-${idx}`}
              progress={segment.event}
              isActive={segment.event.status === 'active'}
              isLast={idx === segments.length - 1}
              responseStarted={responseStarted}
            />
          ];
        }

        // Simple group (≤ 2 distinct tool calls) — render flat without
        // the collapsible group wrapper to avoid redundant nesting.
        const meaningfulEvents = segment.events.filter(
          e => !STATUS_UPDATE_KINDS.has(e.kind)
        );

        if (meaningfulEvents.length <= 2) {
          return segment.events.map((event, eventIdx) => (
            <ProgressRow
              key={event.id || event.progress_id || `flat-${idx}-${eventIdx}`}
              progress={event}
              isActive={event.status === 'active'}
              isLast={idx === segments.length - 1 && eventIdx === segment.events.length - 1}
              responseStarted={responseStarted}
            />
          ));
        }

        // Complex group (3+ tool calls) — use collapsible wrapper
        return [
          <ProgressGroup
            key={`group-${idx}`}
            events={segment.events}
            summary={segment.summary}
            isLast={idx === segments.length - 1}
            responseStarted={responseStarted}
          />
        ];
      })}
    </div>
  );
}
