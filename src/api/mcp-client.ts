/**
 * MCP Client for Pillar SDK
 * 
 * Implements JSON-RPC 2.0 over HTTP with SSE streaming support
 * for communication with the MCP server.
 */

import type { TaskButtonData } from '../components/Panel/TaskButton';
import type { ResolvedConfig } from '../core/config';
import type { ExecutionPlan } from '../core/plan';
import type { UserContextItem } from '../types/user-context';
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
  /** Called when stream is complete */
  onComplete?: (conversationId?: string, queryLogId?: string) => void;
  /** Called for progress updates */
  onProgress?: (progress: { kind: string; message?: string }) => void;
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

  private get baseUrl(): string {
    return `${this.config.apiBaseUrl}/mcp/`;
  }

  private get headers(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Pillar-Key': this.config.publicKey,
      'x-customer-id': this.config.helpCenter,
    };

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
                    if (progress.kind === 'token' && progress.token) {
                      collectedText.push(progress.token);
                      callbacks.onToken?.(progress.token);
                    } else if (progress.kind === 'plan_created' && progress.plan) {
                      // Plan was created by the ReAct agent
                      callbacks.onPlan?.(progress.plan as ExecutionPlan);
                    } else if (progress.kind === 'cancelled') {
                      // Stream was cancelled
                      break;
                    } else {
                      // Other progress types (search, generating, thinking)
                      callbacks.onProgress?.(progress);
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
              console.error('[MCPClient] Failed to parse event:', parseError, line);
            }
          }
        }
      }
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        // Request was cancelled
        throw error;
      }
      callbacks.onError?.(error instanceof Error ? error.message : 'Stream reading failed');
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
        'x-customer-id': this.config.helpCenter,
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
   * Only works if the step is retriable and hasn't exceeded max_retries.
   * 
   * @param planId - UUID of the plan
   * @param stepId - UUID of the step to retry
   * @returns Updated plan with step reset to ready
   */
  async retryStep(planId: string, stepId: string): Promise<{ plan: ExecutionPlan }> {
    const response = await this.callTool('plans/retry-step', {
      plan_id: planId,
      step_id: stepId,
    });
    return response as unknown as { plan: ExecutionPlan };
  }

  /**
   * Mark a step as failed.
   * 
   * Records the error and determines if the plan should also fail
   * (if step is not retriable or out of retries).
   * 
   * @param planId - UUID of the plan
   * @param stepId - UUID of the failed step
   * @param errorMessage - Optional error message
   * @returns Updated plan with failed step
   */
  async failStep(planId: string, stepId: string, errorMessage?: string): Promise<{ plan: ExecutionPlan }> {
    const response = await this.callTool('plans/fail-step', {
      plan_id: planId,
      step_id: stepId,
      error_message: errorMessage || '',
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
    const response = await this.callTool('plans/skip-step', {
      plan_id: planId,
      step_id: stepId,
    });
    return response as unknown as { plan: ExecutionPlan };
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
   */
  sendActionResult(actionName: string, result: unknown): void {
    // Send via fire-and-forget POST request
    // The server will inject this into the ongoing conversation
    const request: JSONRPCRequest = {
      jsonrpc: '2.0',
      id: this.nextId(),
      method: 'action/result',
      params: {
        action_name: actionName,
        result,
      },
    };

    // Fire-and-forget - don't wait for response
    fetch(this.baseUrl, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(request),
    }).catch((error) => {
      console.error('[MCPClient] Failed to send action result:', error);
    });
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
