/**
 * AG-UI Event Handler
 *
 * Processes AG-UI protocol events and maintains UI state.
 * Replaces the complex JSON-RPC parsing in mcp-client.ts.
 */

import type {
  AGUIEvent,
  EventType,
  RunStartedEvent,
  RunFinishedEvent,
  RunErrorEvent,
  StepStartedEvent,
  StepFinishedEvent,
  TextMessageStartEvent,
  TextMessageContentEvent,
  TextMessageEndEvent,
  ToolCallStartEvent,
  ToolCallArgsEvent,
  ToolCallEndEvent,
  ToolCallResultEvent,
  StateDeltaEvent,
} from '@ag-ui/core';

// ============================================================================
// State Types
// ============================================================================

/** A streaming text message being accumulated */
export interface StreamingMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  complete: boolean;
  /** Which step this message belongs to (for thinking vs response) */
  stepName?: string;
}

/** A tool call being tracked */
export interface ToolCallState {
  id: string;
  name: string;
  args: string;
  result?: unknown;
  complete: boolean;
  /** True if this tool executes on the client (query action) */
  isClientSide?: boolean;
}

/** State delta data (sources, actions, plan, etc.) */
export interface StateDeltaData {
  type: string;
  data: unknown;
  timestamp: number;
}

/** Complete AG-UI state */
export interface AGUIState {
  /** Current run ID */
  runId: string | null;
  /** Thread ID (replaces conversation_id) */
  threadId: string | null;
  /** Current step name (e.g., "reasoning", "tool_execution") */
  currentStep: string | null;
  /** Streaming messages keyed by message ID */
  messages: Map<string, StreamingMessage>;
  /** Tool calls keyed by tool call ID */
  toolCalls: Map<string, ToolCallState>;
  /** State deltas received (sources, actions, plans) */
  stateDeltas: StateDeltaData[];
  /** Whether the run is complete */
  isComplete: boolean;
  /** Error if run failed */
  error: Error | null;
}

// ============================================================================
// Event Handler Factory
// ============================================================================

export interface AGUIHandlerCallbacks {
  /** Called whenever state changes */
  onStateChange: (state: AGUIState) => void;
  /** Called when an error occurs */
  onError: (error: Error) => void;
  /** Called when run completes successfully */
  onComplete: () => void;
  /** Called when a client-side tool needs execution */
  onClientToolCall?: (toolCall: ToolCallState) => Promise<unknown>;
}

/**
 * Create an AG-UI event handler.
 *
 * Returns an object with a handleEvent method that processes
 * AG-UI events and updates internal state.
 */
export function createAGUIHandler(callbacks: AGUIHandlerCallbacks) {
  // Internal state
  const state: AGUIState = {
    runId: null,
    threadId: null,
    currentStep: null,
    messages: new Map(),
    toolCalls: new Map(),
    stateDeltas: [],
    isComplete: false,
    error: null,
  };

  // Helper to notify state change with a deep copy
  const notifyStateChange = () => {
    callbacks.onStateChange({
      ...state,
      messages: new Map(state.messages),
      toolCalls: new Map(state.toolCalls),
      stateDeltas: [...state.stateDeltas],
    });
  };

  // Event processing
  const handleEvent = async (event: AGUIEvent): Promise<void> => {
    const eventType = event.type as EventType;

    switch (eventType) {
      // ========================================
      // Lifecycle Events
      // ========================================
      case 'RUN_STARTED': {
        const e = event as RunStartedEvent;
        state.runId = e.runId ?? null;
        state.threadId = e.threadId ?? null;
        state.isComplete = false;
        state.error = null;
        notifyStateChange();
        break;
      }

      case 'RUN_FINISHED': {
        state.isComplete = true;
        notifyStateChange();
        callbacks.onComplete();
        break;
      }

      case 'RUN_ERROR': {
        const e = event as RunErrorEvent;
        const error = new Error(e.message || 'Run failed');
        state.error = error;
        state.isComplete = true;
        notifyStateChange();
        callbacks.onError(error);
        break;
      }

      // ========================================
      // Step Events
      // ========================================
      case 'STEP_STARTED': {
        const e = event as StepStartedEvent;
        state.currentStep = e.stepName ?? null;
        notifyStateChange();
        break;
      }

      case 'STEP_FINISHED': {
        state.currentStep = null;
        notifyStateChange();
        break;
      }

      // ========================================
      // Text Message Events
      // ========================================
      case 'TEXT_MESSAGE_START': {
        const e = event as TextMessageStartEvent;
        state.messages.set(e.messageId, {
          id: e.messageId,
          role: (e.role as 'user' | 'assistant') || 'assistant',
          content: '',
          complete: false,
          stepName: state.currentStep || undefined,
        });
        notifyStateChange();
        break;
      }

      case 'TEXT_MESSAGE_CONTENT': {
        const e = event as TextMessageContentEvent;
        const contentMsg = state.messages.get(e.messageId);
        if (contentMsg) {
          contentMsg.content += e.delta;
          notifyStateChange();
        }
        break;
      }

      case 'TEXT_MESSAGE_END': {
        const e = event as TextMessageEndEvent;
        const endMsg = state.messages.get(e.messageId);
        if (endMsg) {
          endMsg.complete = true;
          notifyStateChange();
        }
        break;
      }

      // ========================================
      // Thinking Text Message Events (separate from regular text)
      // ========================================
      case 'THINKING_TEXT_MESSAGE_START': {
        const e = event as TextMessageStartEvent;
        state.messages.set(e.messageId, {
          id: e.messageId,
          role: 'assistant',
          content: '',
          complete: false,
          stepName: 'reasoning', // Always mark as reasoning
        });
        notifyStateChange();
        break;
      }

      case 'THINKING_TEXT_MESSAGE_CONTENT': {
        const e = event as TextMessageContentEvent;
        const contentMsg = state.messages.get(e.messageId);
        if (contentMsg) {
          contentMsg.content += e.delta;
          notifyStateChange();
        }
        break;
      }

      case 'THINKING_TEXT_MESSAGE_END': {
        const e = event as TextMessageEndEvent;
        const endMsg = state.messages.get(e.messageId);
        if (endMsg) {
          endMsg.complete = true;
          notifyStateChange();
        }
        break;
      }

      // ========================================
      // Tool Call Events
      // ========================================
      case 'TOOL_CALL_START': {
        const e = event as ToolCallStartEvent;
        state.toolCalls.set(e.toolCallId, {
          id: e.toolCallId,
          name: e.toolCallName,
          args: '',
          complete: false,
        });
        notifyStateChange();
        break;
      }

      case 'TOOL_CALL_ARGS': {
        const e = event as ToolCallArgsEvent;
        const argsCall = state.toolCalls.get(e.toolCallId);
        if (argsCall) {
          argsCall.args += e.delta;
          notifyStateChange();
        }
        break;
      }

      case 'TOOL_CALL_END': {
        const e = event as ToolCallEndEvent;
        const endCall = state.toolCalls.get(e.toolCallId);
        if (endCall) {
          endCall.complete = true;

          // Check if this is a client-side tool that needs execution
          if (callbacks.onClientToolCall && isClientSideTool(endCall.name)) {
            endCall.isClientSide = true;
            try {
              const result = await callbacks.onClientToolCall(endCall);
              endCall.result = result;
            } catch (err) {
              endCall.result = {
                error: err instanceof Error ? err.message : String(err),
              };
            }
          }
          notifyStateChange();
        }
        break;
      }

      case 'TOOL_CALL_RESULT': {
        const e = event as ToolCallResultEvent;
        const resultCall = state.toolCalls.get(e.toolCallId);
        if (resultCall) {
          resultCall.result = e.result;
          notifyStateChange();
        }
        break;
      }

      // ========================================
      // State Events (sources, actions, plan)
      // ========================================
      case 'STATE_DELTA': {
        const e = event as StateDeltaEvent;
        // Delta is an array in AG-UI spec, process each item
        const deltaArray = Array.isArray(e.delta) ? e.delta : [e.delta];
        for (const deltaItem of deltaArray) {
          if (deltaItem && typeof deltaItem === 'object') {
            const delta = deltaItem as Record<string, unknown>;
            const deltaType = Object.keys(delta)[0] || 'unknown';
            state.stateDeltas.push({
              type: deltaType,
              data: delta,
              timestamp: Date.now(),
            });
          }
        }
        notifyStateChange();
        break;
      }

      case 'STATE_SNAPSHOT': {
        // Full state snapshot - handle if needed
        console.debug('[AG-UI] State snapshot received:', event);
        break;
      }

      case 'MESSAGES_SNAPSHOT': {
        // Messages snapshot - handle if needed
        console.debug('[AG-UI] Messages snapshot received:', event);
        break;
      }

      // ========================================
      // Raw/Custom Events
      // ========================================
      case 'RAW': {
        console.debug('[AG-UI] Raw event:', event);
        break;
      }

      case 'CUSTOM': {
        // Handle custom events if any
        console.debug('[AG-UI] Custom event:', event);
        break;
      }

      default: {
        console.debug('[AG-UI] Unhandled event type:', eventType);
      }
    }
  };

  // Reset state for new run
  const reset = () => {
    state.runId = null;
    state.threadId = null;
    state.currentStep = null;
    state.messages.clear();
    state.toolCalls.clear();
    state.stateDeltas = [];
    state.isComplete = false;
    state.error = null;
  };

  // Get current state snapshot
  const getState = (): AGUIState => ({
    ...state,
    messages: new Map(state.messages),
    toolCalls: new Map(state.toolCalls),
    stateDeltas: [...state.stateDeltas],
  });

  return {
    handleEvent,
    reset,
    getState,
  };
}

// ============================================================================
// Client-Side Tool Registry
// ============================================================================

/**
 * Set of tool names that execute on the client side.
 * These tools will trigger the onClientToolCall callback.
 */
const CLIENT_SIDE_TOOLS = new Set<string>();

/**
 * Register a tool as client-side.
 * Called when the SDK registers an action with returns: true.
 */
export function registerClientSideTool(toolName: string): void {
  CLIENT_SIDE_TOOLS.add(toolName);
}

/**
 * Unregister a client-side tool.
 */
export function unregisterClientSideTool(toolName: string): void {
  CLIENT_SIDE_TOOLS.delete(toolName);
}

/**
 * Check if a tool executes on the client side.
 */
export function isClientSideTool(toolName: string): boolean {
  return CLIENT_SIDE_TOOLS.has(toolName);
}

/**
 * Get all registered client-side tools.
 */
export function getClientSideTools(): string[] {
  return Array.from(CLIENT_SIDE_TOOLS);
}
