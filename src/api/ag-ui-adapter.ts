/**
 * AG-UI Client Adapter for Pillar SDK
 *
 * Bridges the new AGUIClient to existing chat store patterns.
 * Allows gradual migration without changing all components at once.
 *
 * Copyright (C) 2025 Pillar Team
 */

import type { ResolvedConfig } from '../core/config';
import type { ExecutionPlan } from '../core/plan';
import type { TaskButtonData } from '../components/Panel/TaskButton';
import type { UserContextItem } from '../types/user-context';
import type { ArticleSummary, ChatMessage, ChatResponse, ProgressEvent } from './client';
import type { QueryRequest, ChatImage } from './mcp-client';
import { AGUIClient, type AGUIStreamCallbacks, type ClientTool } from './ag-ui-client';

// ============================================================================
// Legacy Callback Types (matching mcp-client.ts interface)
// ============================================================================

export interface LegacyStreamCallbacks {
  /** Called for each text token */
  onToken?: (token: string) => void;
  /** Called when sources are available */
  onSources?: (sources: ArticleSummary[]) => void;
  /** Called when actions are available */
  onActions?: (actions: TaskButtonData[]) => void;
  /** Called when a plan is created */
  onPlan?: (plan: ExecutionPlan) => void;
  /** Called for progress updates */
  onProgress?: (progress: ProgressEvent) => void;
  /** Called when conversation starts (early conversation_id) */
  onConversationStarted?: (conversationId: string, messageId?: string) => void;
  /** Called when agent requests data from host app */
  onQueryRequest?: (request: QueryRequest) => Promise<void>;
  /** Called on error */
  onError?: (error: string) => void;
  /** Called when stream is complete */
  onComplete?: (conversationId?: string, queryLogId?: string) => void;
}

// ============================================================================
// AG-UI Client Adapter
// ============================================================================

/**
 * Wraps AGUIClient to provide the same interface as the legacy MCPClient.
 * Used during migration to minimize component changes.
 */
export class AGUIClientAdapter {
  private client: AGUIClient;
  private currentStep: string | null = null;

  constructor(config: ResolvedConfig) {
    this.client = new AGUIClient(config);
  }

  /**
   * Register a client-side tool (query action).
   */
  registerTool(tool: ClientTool): void {
    this.client.registerTool(tool);
  }

  /**
   * Unregister a client-side tool.
   */
  unregisterTool(toolName: string): void {
    this.client.unregisterTool(toolName);
  }

  /**
   * Chat with streaming, using legacy callback patterns.
   */
  async chat(
    message: string,
    callbacks: LegacyStreamCallbacks,
    options?: {
      history?: ChatMessage[];
      userContext?: UserContextItem[];
      images?: ChatImage[];
      signal?: AbortSignal;
    }
  ): Promise<ChatResponse> {
    let fullMessage = '';
    this.currentStep = null;
    const sources: ArticleSummary[] = [];
    const actions: TaskButtonData[] = [];
    let conversationId: string | undefined;
    let plan: ExecutionPlan | null = null;

    const aguiCallbacks: AGUIStreamCallbacks = {
      onRunStarted: (runId) => {
        conversationId = runId;
        callbacks.onConversationStarted?.(runId);
      },

      onRunFinished: () => {
        callbacks.onComplete?.(conversationId);
      },

      onError: (error) => {
        callbacks.onError?.(error.message);
      },

      onStepStarted: (stepName) => {
        this.currentStep = stepName;
        callbacks.onProgress?.({
          progress_id: stepName,
          markdown: '',
          is_step_start: true,
        });
      },

      onStepFinished: (stepName) => {
        callbacks.onProgress?.({
          progress_id: stepName,
          markdown: '',
          is_step_complete: true,
        });
        this.currentStep = null;
      },

      onTextContent: (msgId, delta) => {
        // Distinguish thinking (inside reasoning step) from final response
        if (this.currentStep === 'reasoning') {
          // Thinking content goes to progress
          callbacks.onProgress?.({
            progress_id: msgId,
            markdown: delta,
            is_streaming: true,
          });
        } else {
          // Final response - stream as tokens
          fullMessage += delta;
          callbacks.onToken?.(delta);
        }
      },

      onToolCallStart: (toolCallId, toolName) => {
        // Emit progress for tool execution
        callbacks.onProgress?.({
          progress_id: toolCallId,
          markdown: `Executing: ${toolName}`,
          is_step_start: true,
        });
      },

      onToolCallEnd: (toolCallId) => {
        callbacks.onProgress?.({
          progress_id: toolCallId,
          markdown: '',
          is_step_complete: true,
        });
      },

      onStateDelta: (delta) => {
        // Parse JSON Patch operations to extract sources, actions, plan
        if (!Array.isArray(delta)) return;

        for (const op of delta) {
          const patchOp = op as { op: string; path: string; value: unknown };
          if (patchOp.op === 'replace' || patchOp.op === 'add') {
            if (patchOp.path === '/sources' && Array.isArray(patchOp.value)) {
              sources.push(...(patchOp.value as ArticleSummary[]));
              callbacks.onSources?.(sources);
            } else if (patchOp.path === '/actions' && Array.isArray(patchOp.value)) {
              actions.push(...(patchOp.value as TaskButtonData[]));
              callbacks.onActions?.(actions);
            } else if (patchOp.path === '/plan' && patchOp.value) {
              plan = patchOp.value as ExecutionPlan;
              callbacks.onPlan?.(plan);
            }
          }
        }
      },
    };

    // Convert history format
    const history = options?.history?.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    // Convert user context - spread first, then override type to ensure it's set
    const userContext = options?.userContext?.map((item) => {
      const { type: itemType, ...rest } = item;
      return {
        ...rest,
        type: itemType,
      };
    });

    try {
      await this.client.chat(message, aguiCallbacks, {
        history,
        userContext,
        signal: options?.signal,
      });
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        throw error;
      }
      callbacks.onError?.(error instanceof Error ? error.message : String(error));
      throw error;
    }

    return {
      message: fullMessage,
      sources,
      actions,
      conversationId,
    };
  }

  /**
   * Get current thread ID.
   */
  get threadId(): string {
    return this.client.threadId;
  }

  /**
   * Start a new conversation.
   */
  newThread(): string {
    return this.client.newThread();
  }

  /**
   * Send action result back to the agent (for query actions).
   * 
   * @param actionName - The name of the action that was executed
   * @param result - The result data to send back to the agent
   */
  async sendActionResult(actionName: string, result: unknown): Promise<void> {
    // In AG-UI, we use tool_call_id instead of action_name
    // The adapter maps action_name to tool_call_id for compatibility
    await this.client.sendToolResult(actionName, result);
  }
}
