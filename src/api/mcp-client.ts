/**
 * MCP Client for Pillar SDK
 * 
 * Implements JSON-RPC 2.0 over HTTP with SSE streaming support
 * for communication with the MCP server.
 * 
 * @deprecated MCPClient is deprecated for chat operations.
 * Use AGUIClient for all chat streaming.
 * MCPClient is retained only for plan management operations.
 * 
 * TODO: Move plan management to AG-UI protocol and remove this client.
 */

import type { TaskButtonData } from '../components/Panel/TaskButton';
import type { ResolvedConfig } from '../core/config';
import type { ExecutionPlan } from '../core/plan';
import type { UserContextItem } from '../types/user-context';
import { debug } from '../utils/debug';
import type { ArticleSummary } from './client';

// ============================================================================
// Types
// ============================================================================

/** JSON-RPC 2.0 request */
interface JSONRPCRequest {
  jsonrpc: '2.0';
  id: number | string;
  method: string;
  params?: Record<string, unknown>;
}

/** JSON-RPC 2.0 response */
interface JSONRPCResponse<T = unknown> {
  jsonrpc: '2.0';
  id: number | string | null;
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

/** JSON-RPC 2.0 notification (streaming progress) */
interface JSONRPCNotification {
  jsonrpc: '2.0';
  method: string;
  params?: Record<string, unknown>;
}

/** MCP Tool result content */
interface ToolResultContent {
  type: 'text' | 'image' | 'resource';
  text?: string;
  data?: string;
  mimeType?: string;
}

/** MCP Tool result */
export interface ToolResult {
  content: ToolResultContent[];
  isError?: boolean;
  structuredContent?: {
    sources?: ArticleSummary[];
    actions?: ActionData[];
    plan?: ExecutionPlan;
  };
  _meta?: {
    conversation_id?: string;
    query_log_id?: string;
  };
}

/** Action data from MCP server */
export interface ActionData {
  id: string;
  name: string;
  description: string;
  action_type: string;
  /** If true, action executes immediately without user clicking */
  auto_run: boolean;
  /** If true, action completes without waiting for host confirmation */
  auto_complete: boolean;
  /** If true, action returns data for agent reasoning */
  returns_data: boolean;
  score: number;
  data: Record<string, unknown>;
}

/** Response from plans/step-complete endpoint */
export interface StepCompleteResponse {
  success: boolean;
  /** Action to take: proceed, retry, modify_step, or end_plan */
  action: 'proceed' | 'modify_step' | 'retry' | 'end_plan';
  /** Updated plan with new step statuses */
  plan: ExecutionPlan;
  /** Step ID to retry (when action='retry') */
  retry_step_id?: string;
  /** Optional message from agent */
  message?: string;
  /** Error code if failed */
  error?: string;
}

/** Action request from agent (unified for all action execution) */
export interface ActionRequest {
  /** Action name to execute */
  action_name: string;
  /** Parameters for the action */
  parameters: Record<string, unknown>;
  /** Full action definition (optional, for handler lookup) */
  action?: ActionData;
}

/** Streaming callbacks for tool calls */
export interface StreamCallbacks {
  /** Called for each text token */
  onToken?: (token: string) => void;
  /** Called when sources are available */
  onSources?: (sources: ArticleSummary[]) => void;
  /** Called when actions are available */
  onActions?: (actions: ActionData[]) => void;
  /** Called when a plan is created (from plan.created event) */
  onPlan?: (plan: ExecutionPlan) => void;
  /** Called on error */
  onError?: (error: string) => void;
  /** Called when conversation_started event is received (early conversation_id) */
  onConversationStarted?: (conversationId: string, messageId?: string) => void;
  /** Called when stream is complete */
  onComplete?: (conversationId?: string, queryLogId?: string) => void;
  /** Called for progress updates (search, query, generating, thinking, etc.) */
  onProgress?: (progress: {
    kind: string;              // Event type: "thinking", "search", "tool_call", "plan", "generating"
    id?: string;               // Unique ID for streaming updates (new schema)
    label?: string;            // Display label from server (e.g., "Thinking...", "Searching...")
    status?: 'active' | 'done' | 'error';  // Event status for UI rendering
    text?: string;             // Streaming text content (delta mode)
    children?: Array<{id: string; label: string; url?: string}>;  // Sub-items (e.g., sources)
    metadata?: Record<string, unknown>;  // Event-specific data
    // Legacy fields for backwards compatibility
    progress_id?: string;      // Deprecated: use id
    message?: string;          // Deprecated: use label
  }) => void;
  /** Called when agent requests action execution (unified handler) */
  onActionRequest?: (request: ActionRequest) => Promise<void>;
}

/** Image for chat requests (from upload-image endpoint) */
export interface ChatImage {
  /** Signed GCS URL from upload-image endpoint */
  url: string;
  /** Detail level for image analysis. 'low' is faster and cheaper. */
  detail?: 'low' | 'high';
}

/** Response from image upload endpoint */
export interface ImageUploadResponse {
  url: string;
  expires_at: string;
}

// ============================================================================
// MCP Client
// ============================================================================

export class MCPClient {
  private config: ResolvedConfig;
  private requestId = 0;

  constructor(config: ResolvedConfig) {
    this.config = config;
  }

  /**
   * Get or create a session ID for MCP request correlation.
   * Stored in sessionStorage to persist only for the current browser session.
   */
  private getSessionId(): string {
    if (typeof window === 'undefined') return '';
    
    const KEY = 'pillar_mcp_session_id';
    try {
      let id = sessionStorage.getItem(KEY);
      if (!id) {
        id = crypto.randomUUID();
        sessionStorage.setItem(KEY, id);
      }
      return id;
    } catch {
      // sessionStorage might be unavailable
      return '';
    }
  }

  private get baseUrl(): string {
    return `${this.config.apiBaseUrl}/mcp/`;
  }

  private get headers(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-customer-id': this.config.productKey,
    };

    // Add session ID for request correlation (critical for query actions)
    const sessionId = this.getSessionId();
    if (sessionId) {
      headers['Mcp-Session-Id'] = sessionId;
    }

    // Add browser language for multilingual AI responses
    if (typeof navigator !== 'undefined') {
      headers['Accept-Language'] = navigator.language || navigator.languages?.[0] || 'en';
    }

    // Add platform/version headers for code-first action filtering
    if (this.config.platform) {
      headers['X-Pillar-Platform'] = this.config.platform;
    }
    if (this.config.version) {
      headers['X-Pillar-Action-Version'] = this.config.version;
    }

    return headers;
  }

  private nextId(): number {
    return ++this.requestId;
  }

  /**
   * Call an MCP tool (non-streaming).
   */
  async callTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
    const request: JSONRPCRequest = {
      jsonrpc: '2.0',
      id: this.nextId(),
      method: 'tools/call',
      params: {
        name,
        arguments: args,
      },
    };

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `MCP error: ${response.status}`);
    }

    const jsonResponse = await response.json() as JSONRPCResponse<ToolResult>;

    if (jsonResponse.error) {
      throw new Error(jsonResponse.error.message);
    }

    return jsonResponse.result!;
  }

  /**
   * Call an MCP tool with streaming support.
   * 
   * @param name - Tool name (e.g., 'ask')
   * @param args - Tool arguments
   * @param callbacks - Streaming event callbacks
   * @param signal - Optional AbortSignal for cancellation
   */
  async callToolStream(
    name: string,
    args: Record<string, unknown>,
    callbacks: StreamCallbacks,
    signal?: AbortSignal
  ): Promise<ToolResult> {
    const requestId = this.nextId();
    const request: JSONRPCRequest = {
      jsonrpc: '2.0',
      id: requestId,
      method: 'tools/call',
      params: {
        name,
        arguments: args,
        stream: true,
      },
    };

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        ...this.headers,
        Accept: 'text/event-stream',
      },
      body: JSON.stringify(request),
      signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`MCP streaming request failed: ${response.statusText} - ${errorText}`);
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }

    // Read the stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let collectedText: string[] = [];
    let finalResult: ToolResult | null = null;

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        // Decode and add to buffer
        const decoded = decoder.decode(value, { stream: true });
        buffer += decoded;

        // Process complete events
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (!line.trim()) continue;

          // MCP SSE format: data: {...}
          if (line.startsWith('data: ')) {
            try {
              const jsonStr = line.substring(6);
              const event = JSON.parse(jsonStr);

              // Handle JSON-RPC response
              if (event.jsonrpc === '2.0') {
                // Check for error
                if (event.error) {
                  callbacks.onError?.(event.error.message || 'Unknown error');
                  throw new Error(event.error.message);
                }

                // Handle streaming token events (notifications/progress)
                if (event.method === 'notifications/progress') {
                  const progress = event.params?.progress;
                  if (progress) {
                    // Handle new nested format: {type: 'progress', data: {...}}
                    // This is the new schema from Phase 1 streaming_events.py
                    if (progress.type === 'progress' && progress.data) {
                      const data = progress.data;
                      debug.log(`[MCPClient] Progress event (new schema): ${data.kind}`, data);
                      
                      // Map new schema to ProgressEvent
                      callbacks.onProgress?.({
                        kind: data.kind,
                        id: data.id,
                        label: data.label,
                        status: data.status,
                        text: data.text,        // Delta text - store will accumulate
                        children: data.children,
                        metadata: data.metadata,
                      });
                      continue;
                    }

                    // Log all progress events for debugging (except tokens which are too verbose)
                    if (progress.kind !== 'token') {
                      debug.log(`[MCPClient] Progress event: ${progress.kind}`, progress);
                    }

                    if (progress.kind === 'token' && progress.token) {
                      collectedText.push(progress.token);
                      callbacks.onToken?.(progress.token);
                    } else if (progress.kind === 'conversation_started') {
                      // Conversation started - early conversation_id from pre-generated UUID
                      callbacks.onConversationStarted?.(
                        progress.conversation_id,
                        progress.message_id
                      );
                    } else if (progress.kind === 'plan_created' && progress.plan) {
                      // Plan was created by the ReAct agent
                      callbacks.onPlan?.(progress.plan as ExecutionPlan);
                    } else if (progress.kind === 'cancelled') {
                      // Stream was cancelled
                      break;
                    } else if (progress.kind === 'action_request') {
                      // Unified action request - agent wants to execute any action
                      debug.log('[MCPClient] Received action_request:', progress.action_name, progress.parameters);
                      
                      // Validate required fields
                      if (!progress.action_name || typeof progress.action_name !== 'string' || progress.action_name.trim() === '') {
                        debug.error('[MCPClient] Received action_request with missing or invalid action_name:', progress);
                        continue;
                      }
                      
                      if (callbacks.onActionRequest) {
                        const actionRequest: ActionRequest = {
                          action_name: progress.action_name,
                          parameters: progress.parameters || {},
                          action: progress.action,
                        };
                        
                        // Execute async but don't await - let the stream continue
                        callbacks.onActionRequest(actionRequest).catch((error) => {
                          debug.error('[MCPClient] Action request handler failed:', error);
                        });
                      } else {
                        debug.warn('[MCPClient] Received action_request but no handler registered');
                      }
                    } else {
                      // Progress types - pass through all fields from server
                      // The backend sends id, label, status, text for the new schema
                      // Also supports legacy progress_id and message fields
                      callbacks.onProgress?.({
                        kind: progress.kind,
                        id: progress.id,  // New schema: unique ID for event updates
                        label: progress.label,
                        status: progress.status,  // New schema: active/done/error
                        text: progress.text || progress.content,  // content is legacy for thinking events
                        children: progress.children,  // New schema: sub-items
                        message: progress.message,  // Legacy: display message
                        progress_id: progress.progress_id,  // Legacy: unique ID
                        metadata: {
                          sources: progress.sources || progress.metadata?.sources,
                          result_count: progress.result_count ?? progress.metadata?.result_count,
                          query: progress.query || progress.metadata?.query,
                          action_name: progress.action_name || progress.metadata?.action_name,
                          no_sources_used: progress.no_sources_used ?? progress.metadata?.no_sources_used,
                        },
                      });
                    }
                  }
                }

                // Handle final result event
                if (event.result && event.id === requestId) {
                  finalResult = event.result as ToolResult;

                  // Extract sources
                  if (finalResult.structuredContent?.sources) {
                    callbacks.onSources?.(finalResult.structuredContent.sources);
                  }

                  // Extract actions
                  if (finalResult.structuredContent?.actions) {
                    callbacks.onActions?.(finalResult.structuredContent.actions);
                  }

                  // Extract plan (from plan.created event)
                  if (finalResult.structuredContent?.plan) {
                    callbacks.onPlan?.(finalResult.structuredContent.plan);
                  }

                  // Extract metadata
                  const conversationId = finalResult._meta?.conversation_id;
                  const queryLogId = finalResult._meta?.query_log_id;

                  // Fire done callback
                  callbacks.onComplete?.(conversationId, queryLogId);
                }
              }
            } catch (parseError) {
              debug.error('[MCPClient] Failed to parse event:', parseError, line);
            }
          }
        }
      }
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        // Request was cancelled
        throw error;
      }
      
      // Emit a progress event for the error so UI can display it
      const errorMessage = error instanceof Error ? error.message : 'Stream reading failed';
      callbacks.onProgress?.({
        kind: 'error',
        id: 'stream-error',
        label: 'Connection interrupted',
        status: 'error',
        text: errorMessage,
        metadata: { error: errorMessage },
      });
      
      callbacks.onError?.(errorMessage);
      throw error;
    } finally {
      reader.releaseLock();
    }

    // Build result if not received via final event
    if (!finalResult) {
      finalResult = {
        content: [{ type: 'text', text: collectedText.join('') }],
        isError: false,
      };
    }

    return finalResult;
  }

  /**
   * Upload an image for use in chat.
   * 
   * Returns a signed URL that can be passed to the ask tool.
   * The URL expires after 24 hours.
   * 
   * @param file - The image file to upload
   * @returns Promise with signed URL and expiration
   */
  async uploadImage(file: File): Promise<ImageUploadResponse> {
    const uploadUrl = `${this.config.apiBaseUrl}/mcp/upload-image/`;

    const formData = new FormData();
    formData.append('image', file);

    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'x-customer-id': this.config.productKey,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({
        error: 'Upload failed',
      })) as { error?: string };
      throw new Error(errorData.error || 'Upload failed');
    }

    return response.json() as Promise<ImageUploadResponse>;
  }

  /**
   * Ask a question using the MCP 'ask' tool with streaming.
   * 
   * This is a convenience method for the common use case of asking questions.
   * 
   * @param query - The question to ask
   * @param callbacks - Streaming callbacks
   * @param options - Optional configuration including images
   */
  async ask(
    query: string,
    callbacks: StreamCallbacks,
    options?: {
      articleSlug?: string;
      userContext?: UserContextItem[];
      images?: ChatImage[];
      history?: Array<{ role: 'user' | 'assistant'; content: string }>;
      signal?: AbortSignal;
    }
  ): Promise<ToolResult> {
    const args: Record<string, unknown> = {
      query,
    };

    if (options?.articleSlug) {
      args.article_slug = options.articleSlug;
    }

    if (options?.userContext && options.userContext.length > 0) {
      args.user_context = options.userContext;
    }

    if (options?.images && options.images.length > 0) {
      args.images = options.images;
    }

    if (options?.history && options.history.length > 0) {
      args.history = options.history;
    }

    return this.callToolStream('ask', args, callbacks, options?.signal);
  }

  // ============================================================================
  // Plan Methods
  // ============================================================================

  /**
   * Continue plan execution after receiving step result.
   * 
   * Called by the SDK after executing a step that has
   * requires_result_feedback=true. The server analyzes the result
   * and updates subsequent steps if needed.
   * 
   * @param planId - UUID of the plan
   * @param stepId - UUID of the completed step
   * @param result - Step execution result
   * @returns Updated plan with all steps
   */
  async continuePlan(
    planId: string,
    stepId: string,
    result: unknown
  ): Promise<{ plan: ExecutionPlan }> {
    const response = await this.callTool('plans/continue', {
      plan_id: planId,
      step_id: stepId,
      result,
    });
    return response as unknown as { plan: ExecutionPlan };
  }

  /**
   * Cancel an in-progress plan.
   * 
   * Marks the plan as cancelled and skips any pending steps.
   * 
   * @param planId - UUID of the plan to cancel
   * @returns Updated plan with cancelled status
   */
  async cancelPlan(planId: string): Promise<{ plan: ExecutionPlan }> {
    const response = await this.callTool('plans/cancel', {
      plan_id: planId,
    });
    return response as unknown as { plan: ExecutionPlan };
  }

  /**
   * Get current state of a plan.
   * 
   * Returns the plan and all its steps with current statuses.
   * 
   * @param planId - UUID of the plan
   * @returns Plan with all steps
   */
  async getPlan(planId: string): Promise<{ plan: ExecutionPlan }> {
    const response = await this.callTool('plans/get', {
      plan_id: planId,
    });
    return response as unknown as { plan: ExecutionPlan };
  }

  /**
   * Start a plan that was waiting for user confirmation.
   * 
   * For plans with auto_execute=false, the user must explicitly
   * start execution by calling this method.
   * 
   * @param planId - UUID of the plan to start
   * @returns Updated plan with executing status
   */
  async startPlan(planId: string): Promise<{ plan: ExecutionPlan }> {
    const response = await this.callTool('plans/start', {
      plan_id: planId,
    });
    return response as unknown as { plan: ExecutionPlan };
  }

  /**
   * Retry a failed step.
   * 
   * Increments the retry count and resets the step to ready status.
   * 
   * @param planId - UUID of the plan
   * @param stepId - UUID of the step to retry
   * @returns Updated plan with step reset to ready
   */
  async retryStep(planId: string, stepId: string): Promise<{ plan: ExecutionPlan }> {
    const response = await this.callTool('plans/retry', {
      plan_id: planId,
      step_id: stepId,
    });
    return response as unknown as { plan: ExecutionPlan };
  }

  /**
   * Skip a step and advance to the next one.
   * 
   * @param planId - UUID of the plan
   * @param stepId - UUID of the step to skip
   * @returns Updated plan with skipped step and next step ready
   */
  async skipStep(planId: string, stepId: string): Promise<{ plan: ExecutionPlan }> {
    const response = await this.callTool('plans/skip', {
      plan_id: planId,
      step_id: stepId,
    });
    return response as unknown as { plan: ExecutionPlan };
  }

  /**
   * Report step completion and get server decision on next action.
   * 
   * This is the core of step-by-step verification:
   * - Called after every step execution (success or failure)
   * - Server decides what to do next: proceed, retry, modify, or end
   * 
   * @param planId - UUID of the plan
   * @param stepId - UUID of the completed step
   * @param success - Whether the step executed successfully
   * @param result - Result data from the step execution
   * @param errorMessage - Error message if step failed
   * @returns Decision with updated plan
   */
  async stepComplete(
    planId: string,
    stepId: string,
    success: boolean,
    result: unknown,
    errorMessage?: string
  ): Promise<StepCompleteResponse> {
    const response = await this.callTool('plans/step-complete', {
      plan_id: planId,
      step_id: stepId,
      success,
      result: result || {},
      error_message: errorMessage || '',
    });
    return response as unknown as StepCompleteResponse;
  }

  // ============================================================================
  // Query Action Methods
  // ============================================================================

  /**
   * Send action result back to the agent.
   * 
   * Called after executing a query action (returns_data=true).
   * The result is sent to the agent for further reasoning in the ReAct loop.
   * 
   * @param actionName - The name of the action that was executed
   * @param result - The result data to send back to the agent
   * @returns Promise that resolves when the result is delivered, or rejects on error
   */
  async sendActionResult(actionName: string, result: unknown): Promise<void> {
    const startTime = performance.now();
    
    const request: JSONRPCRequest = {
      jsonrpc: '2.0',
      id: this.nextId(),
      method: 'action/result',
      params: {
        action_name: actionName,
        result,
      },
    };

    try {
      debug.log(`[MCPClient] Sending action result for "${actionName}"...`);
      
      // Yield to event loop before fetch to ensure other async operations can complete
      await new Promise(resolve => setTimeout(resolve, 0));
      
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(request),
        // Use keepalive to ensure request completes even if page unloads
        keepalive: true,
      });
      
      const elapsed = Math.round(performance.now() - startTime);
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        debug.error(
          `[MCPClient] Action result delivery failed: ${response.status} ${response.statusText}`,
          errorText
        );
        throw new Error(`Failed to send action result: ${response.status}`);
      }
      
      debug.log(`[MCPClient] Action result for "${actionName}" delivered in ${elapsed}ms`);
    } catch (error) {
      const elapsed = Math.round(performance.now() - startTime);
      debug.error(
        `[MCPClient] Failed to send action result for "${actionName}" after ${elapsed}ms:`,
        error
      );
      throw error;
    }
  }

}

/**
 * Convert ActionData from MCP response to TaskButtonData for UI rendering.
 */
export function actionToTaskButton(action: ActionData): TaskButtonData {
  return {
    id: action.id,
    name: action.name,
    taskType: action.action_type as TaskButtonData['taskType'],
    data: action.data,
    autoRun: action.auto_run,
    autoComplete: action.auto_complete,
  };
}
