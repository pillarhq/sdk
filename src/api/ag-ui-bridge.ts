/**
 * AG-UI Bridge
 *
 * Temporary bridge that converts Phase 1's JSON-RPC wrapped AG-UI events
 * to native AG-UI events. This allows the SDK to use AG-UI patterns while
 * the backend still uses JSON-RPC transport.
 *
 * Will be removed after Phase 3 (pure AG-UI transport).
 */

import type { AGUIEvent, EventType } from '@ag-ui/core';

/**
 * JSON-RPC notification structure from Phase 1 backend.
 */
interface JSONRPCNotification {
  jsonrpc: '2.0';
  method: string;
  params?: {
    ag_ui_event?: AGUIEvent;
    progress?: Record<string, unknown>;
    [key: string]: unknown;
  };
}

/**
 * Unwrap an AG-UI event from a JSON-RPC notification.
 *
 * Phase 1 backend wraps AG-UI events like this:
 * {
 *   "jsonrpc": "2.0",
 *   "method": "notifications/progress",
 *   "params": {
 *     "ag_ui_event": { "type": "RUN_STARTED", ... }
 *   }
 * }
 *
 * @param jsonRpcEvent - The JSON-RPC notification from the backend
 * @returns The unwrapped AG-UI event, or null if not an AG-UI event
 */
export function unwrapAGUIEvent(jsonRpcEvent: unknown): AGUIEvent | null {
  if (!jsonRpcEvent || typeof jsonRpcEvent !== 'object') {
    return null;
  }

  const event = jsonRpcEvent as JSONRPCNotification;

  // Check for JSON-RPC structure
  if (event.jsonrpc !== '2.0') {
    return null;
  }

  // Check for notifications/progress method (our event transport)
  if (event.method !== 'notifications/progress') {
    return null;
  }

  // Extract AG-UI event from params
  if (event.params?.ag_ui_event) {
    return event.params.ag_ui_event;
  }

  return null;
}

/**
 * Check if a JSON-RPC event contains an AG-UI event.
 */
export function isAGUIWrappedEvent(jsonRpcEvent: unknown): boolean {
  return unwrapAGUIEvent(jsonRpcEvent) !== null;
}

/**
 * Convert legacy MCP progress events to AG-UI events.
 *
 * This is for backwards compatibility during the transition.
 * Converts old-style progress events to AG-UI events.
 *
 * @param legacyEvent - The legacy MCP progress event
 * @returns An array of AG-UI events (may be multiple for some conversions)
 */
export function convertLegacyProgressToAGUI(
  legacyEvent: Record<string, unknown>
): AGUIEvent[] {
  const events: AGUIEvent[] = [];
  const progress = legacyEvent.progress as Record<string, unknown> | undefined;

  if (!progress) {
    return events;
  }

  const kind = progress.kind as string | undefined;
  const progressId = (progress.progress_id as string) || 'legacy';

  switch (kind) {
    case 'conversation_started':
      events.push({
        type: 'RUN_STARTED' as EventType,
        runId: (progress.conversation_id as string) || crypto.randomUUID(),
        threadId: progress.conversation_id as string,
      } as AGUIEvent);
      break;

    case 'token':
      // Response token streaming
      events.push({
        type: 'TEXT_MESSAGE_CONTENT' as EventType,
        messageId: 'response',
        delta: progress.token as string,
      } as AGUIEvent);
      break;

    case 'plan_created':
      events.push({
        type: 'STATE_DELTA' as EventType,
        delta: { plan: progress.plan },
      } as AGUIEvent);
      break;

    default:
      // Handle step-based progress
      if (progress.is_step_start) {
        events.push({
          type: 'STEP_STARTED' as EventType,
          stepName: 'reasoning',
        } as AGUIEvent);
        events.push({
          type: 'TEXT_MESSAGE_START' as EventType,
          messageId: progressId,
          role: 'assistant',
        } as AGUIEvent);
      }

      if (progress.markdown) {
        events.push({
          type: 'TEXT_MESSAGE_CONTENT' as EventType,
          messageId: progressId,
          delta: progress.markdown as string,
        } as AGUIEvent);
      }

      if (progress.is_step_complete) {
        events.push({
          type: 'TEXT_MESSAGE_END' as EventType,
          messageId: progressId,
        } as AGUIEvent);
        events.push({
          type: 'STEP_FINISHED' as EventType,
          stepName: 'reasoning',
        } as AGUIEvent);
      }
  }

  return events;
}

/**
 * Process a raw SSE event and extract AG-UI events.
 *
 * Handles both new AG-UI wrapped events and legacy progress events.
 *
 * @param rawEvent - The parsed JSON from an SSE data line
 * @returns An array of AG-UI events
 */
export function processSSEEvent(rawEvent: unknown): AGUIEvent[] {
  // First, try to unwrap as AG-UI event
  const aguiEvent = unwrapAGUIEvent(rawEvent);
  if (aguiEvent) {
    return [aguiEvent];
  }

  // Fall back to legacy conversion
  if (rawEvent && typeof rawEvent === 'object') {
    const event = rawEvent as Record<string, unknown>;
    if (event.jsonrpc === '2.0' && event.method === 'notifications/progress') {
      const params = event.params as Record<string, unknown> | undefined;
      if (params?.progress) {
        return convertLegacyProgressToAGUI(params);
      }
    }
  }

  return [];
}
