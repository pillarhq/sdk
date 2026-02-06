/**
 * MCP Client for Pillar SDK
 * 
 * Implements JSON-RPC 2.0 over HTTP with SSE streaming support
 * for communication with the MCP server.
 */

import type { TaskButtonData } from '../components/Panel/TaskButton';
import type { ResolvedConfig } from '../core/config';
import type { UserContextItem } from '../types/user-context';
import { debug, debugLog, type LogEntry } from '../utils/debug';
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
    /** Registered actions for dynamic action tools (persisted across turns) */
    registered_actions?: Record<string, unknown>[];
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

/** Action request from agent (unified for all action execution) */
export interface ActionRequest {
  /** Action name to execute */
  action_name: string;
  /** Parameters for the action */
  parameters: Record<string, unknown>;
  /** Full action definition (optional, for handler lookup) */
  action?: ActionData;
  /** Unique ID for this specific tool invocation (for result correlation) */
  tool_call_id?: string;
}

/** Token usage data from the agentic loop (sent after each LLM iteration) */
export interface TokenUsage {
  /** Input tokens for this iteration */
  prompt_tokens: number;
  /** Output tokens for this iteration */
  completion_tokens: number;
  /** Cumulative prompt tokens across all iterations */
  total_prompt_tokens: number;
  /** Cumulative completion tokens across all iterations */
  total_completion_tokens: number;
  /** Current total tokens in context */
  total_used: number;
  /** Maximum context window for the model */
  context_window: number;
  /** Current context occupancy percentage (0-100) */
  occupancy_pct: number;
  /** Name of the model in use */
  model_name: string;
  /** Current iteration number (0-indexed) */
  iteration: number;
}

/** Streaming callbacks for tool calls */
export interface StreamCallbacks {
  /** Called for each text token */
  onToken?: (token: string) => void;
  /** Called when sources are available */
  onSources?: (sources: ArticleSummary[]) => void;
  /** Called when actions are available */
  onActions?: (actions: ActionData[]) => void;
  /** Called when registered actions are received (for dynamic action tools) */
  onRegisteredActions?: (actions: Record<string, unknown>[]) => void;
  /** Called on error */
  onError?: (error: string) => void;
  /** Called when conversation_started event is received (confirms conversation tracking) */
  onConversationStarted?: (conversationId: string, assistantMessageId?: string) => void;
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
  /** Called immediately with the request ID (for cancellation support) */
  onRequestId?: (requestId: number) => void;
  /** Called when agent requests action execution (unified handler) */
  onActionRequest?: (request: ActionRequest) => Promise<void>;
  /** Called when token usage is updated (after each LLM iteration) */
  onTokenUsage?: (usage: TokenUsage) => void;
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
  private _externalUserId: string = '';

  constructor(config: ResolvedConfig) {
    this.config = config;
  }

  /**
   * Set the external user ID for authenticated users.
   * Enables cross-device conversation history.
   */
  setExternalUserId(userId: string): void {
    this._externalUserId = userId;
  }

  /**
   * Get or create a persistent visitor ID.
   * Stored in localStorage to persist across sessions.
   */
  private getVisitorId(): string {
    if (typeof window === 'undefined') return '';
    
    const KEY = 'pillar_visitor_id';
    try {
      let id = localStorage.getItem(KEY);
      if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem(KEY, id);
      }
      return id;
    } catch {
      // localStorage might be unavailable (e.g., private browsing)
      return '';
    }
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

  /**
   * Get the current page URL for analytics tracking.
   */
  private getPageUrl(): string {
    if (typeof window === 'undefined') return '';
    return window.location.href;
  }

  private get baseUrl(): string {
    return `${this.config.apiBaseUrl}/mcp/`;
  }

  private get headers(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-customer-id': this.config.productKey,
      'x-visitor-id': this.getVisitorId(),
      'x-page-url': this.getPageUrl(),
    };

    // Add session ID for request correlation (critical for query actions)
    const sessionId = this.getSessionId();
    if (sessionId) {
      headers['Mcp-Session-Id'] = sessionId;
    }

    // Add external user ID header for authenticated users (enables cross-device history)
    if (this._externalUserId) {
      headers['x-external-user-id'] = this._externalUserId;
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
    const startTime = performance.now();
    const request: JSONRPCRequest = {
      jsonrpc: '2.0',
      id: this.nextId(),
      method: 'tools/call',
      params: {
        name,
        arguments: args,
      },
    };

    debugLog.add({
      event: 'network:request',
      data: { method: 'tools/call', tool: name, url: this.baseUrl },
      source: 'network',
      level: 'info',
    });

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(request),
    });

    const duration = Math.round(performance.now() - startTime);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      debugLog.add({
        event: 'network:response',
        data: { status: response.status, duration, error: errorData.error?.message },
        source: 'network',
        level: 'error',
      });
      throw new Error(errorData.error?.message || `MCP error: ${response.status}`);
    }

    const jsonResponse = await response.json() as JSONRPCResponse<ToolResult>;

    debugLog.add({
      event: 'network:response',
      data: { status: response.status, duration, method: 'tools/call', tool: name },
      source: 'network',
      level: 'info',
    });

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
    const startTime = performance.now();
    const requestId = this.nextId();

    // Notify caller of request ID for cancellation support
    callbacks.onRequestId?.(requestId);

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

    debugLog.add({
      event: 'network:request',
      data: { method: 'tools/call', tool: name, stream: true, url: this.baseUrl },
      source: 'network',
      level: 'info',
    });

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        ...this.headers,
        Accept: 'text/event-stream',
      },
      body: JSON.stringify(request),
      signal,
    });

    const connectionTime = Math.round(performance.now() - startTime);

    if (!response.ok) {
      const errorText = await response.text();
      debugLog.add({
        event: 'network:response',
        data: { status: response.status, duration: connectionTime, error: errorText },
        source: 'network',
        level: 'error',
      });
      throw new Error(`MCP streaming request failed: ${response.statusText} - ${errorText}`);
    }

    debugLog.add({
      event: 'network:stream:connected',
      data: { status: response.status, connectionTime, tool: name },
      source: 'network',
      level: 'info',
    });

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
                    // Handle debug events from server (for SDK DebugPanel)
                    if (progress.type === 'debug') {
                      debugLog.add({
                        event: progress.event || 'server:event',
                        data: progress.data,
                        source: 'server',
                        level: 'info',
                      });
                      continue;
                    }

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
                    if (progress.kind !== 'token' && progress.type !== 'token') {
                      console.log(`[MCPClient] Progress event: kind=${progress.kind} type=${progress.type}`, progress);
                      debug.log(`[MCPClient] Progress event: ${progress.kind}`, progress);
                    }

                    if (progress.kind === 'token' && progress.token) {
                      collectedText.push(progress.token);
                      callbacks.onToken?.(progress.token);
                    } else if (progress.kind === 'conversation_started') {
                      // Conversation started - confirms tracking, returns assistant_message_id
                      callbacks.onConversationStarted?.(
                        progress.conversation_id,
                        progress.assistant_message_id
                      );
                    } else if (progress.kind === 'token_usage') {
                      // Token usage update — context gauge data
                      callbacks.onTokenUsage?.({
                        prompt_tokens: progress.prompt_tokens,
                        completion_tokens: progress.completion_tokens,
                        total_prompt_tokens: progress.total_prompt_tokens,
                        total_completion_tokens: progress.total_completion_tokens,
                        total_used: progress.total_used,
                        context_window: progress.context_window,
                        occupancy_pct: progress.occupancy_pct,
                        model_name: progress.model_name,
                        iteration: progress.iteration,
                      });
                    } else if (progress.kind === 'cancelled') {
                      // Stream was cancelled
                      break;
                    } else if (progress.kind === 'action_request' || progress.type === 'action_request') {
                      // Unified action request - agent wants to execute any action
                      // Note: backend sends "type" but we also check "kind" for consistency
                      console.log('[MCPClient] *** RECEIVED action_request ***', progress.action_name, progress.parameters);
                      debug.log('[MCPClient] Received action_request:', progress.action_name, progress.parameters);
                      
                      // Validate required fields
                      if (!progress.action_name || typeof progress.action_name !== 'string' || progress.action_name.trim() === '') {
                        console.error('[MCPClient] action_request INVALID - missing action_name:', progress);
                        debug.error('[MCPClient] Received action_request with missing or invalid action_name:', progress);
                        continue;
                      }
                      
                      if (callbacks.onActionRequest) {
                        console.log('[MCPClient] *** CALLING onActionRequest handler ***');
                        
                        // Validate tool_call_id is present - critical for result correlation
                        if (!progress.tool_call_id) {
                          console.warn('[MCPClient] action_request missing tool_call_id - result correlation may fail');
                          debug.warn('[MCPClient] action_request missing tool_call_id for action:', progress.action_name);
                        }
                        
                        const actionRequest: ActionRequest = {
                          action_name: progress.action_name,
                          parameters: progress.parameters || {},
                          action: progress.action,
                          tool_call_id: progress.tool_call_id,
                        };
                        
                        // Execute async but don't await - let the stream continue
                        callbacks.onActionRequest(actionRequest).catch((error) => {
                          console.error('[MCPClient] Action request handler FAILED:', error);
                          debug.error('[MCPClient] Action request handler failed:', error);
                        });
                      } else {
                        console.warn('[MCPClient] action_request received but NO HANDLER registered');
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

                  // Extract registered actions (for dynamic action tools)
                  if (finalResult.structuredContent?.registered_actions) {
                    callbacks.onRegisteredActions?.(finalResult.structuredContent.registered_actions);
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
      const totalDuration = Math.round(performance.now() - startTime);
      debugLog.add({
        event: 'network:stream:complete',
        data: { duration: totalDuration, tool: name },
        source: 'network',
        level: 'info',
      });
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
      /** Registered actions from previous turns (for dynamic action tools) */
      registeredActions?: Record<string, unknown>[];
      signal?: AbortSignal;
      /** Conversation ID - generated client-side, always provided */
      conversationId?: string;
    }
  ): Promise<ToolResult> {
    const args: Record<string, unknown> = {
      query,
    };

    if (options?.conversationId) {
      args.conversation_id = options.conversationId;
    }

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

    // Pass registered actions for dynamic action tools (multi-turn persistence)
    if (options?.registeredActions && options.registeredActions.length > 0) {
      args.registered_actions = options.registeredActions;
    }

    return this.callToolStream('ask', args, callbacks, options?.signal);
  }

  // ============================================================================
  // Stream Cancellation
  // ============================================================================

  /**
   * Cancel an active streaming request.
   *
   * Sends a notifications/cancel JSON-RPC request to the backend, which
   * signals the StreamRegistry to stop the LLM stream and cease billing.
   *
   * @param requestId - The JSON-RPC request ID of the stream to cancel
   */
  async cancelStream(requestId: number | string): Promise<void> {
    const request: JSONRPCRequest = {
      jsonrpc: '2.0',
      id: this.nextId(),
      method: 'notifications/cancel',
      params: { request_id: requestId },
    };

    debug.log(`[MCPClient] Cancelling stream request_id=${requestId}`);

    try {
      await fetch(this.baseUrl, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(request),
        keepalive: true,
      });
    } catch (error) {
      // Best-effort -- don't throw if cancel request fails
      debug.warn('[MCPClient] Failed to send cancel request:', error);
    }
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
   * @param toolCallId - Unique ID for this specific tool invocation (for result correlation)
   * @returns Promise that resolves when the result is delivered, or rejects on error
   */
  async sendActionResult(actionName: string, result: unknown, toolCallId?: string): Promise<void> {
    const startTime = performance.now();
    
    // Warn if tool_call_id is missing - will cause result correlation to fail on server
    if (!toolCallId) {
      console.warn(`[MCPClient] sendActionResult called without toolCallId for action "${actionName}" - server will not be able to correlate result`);
      debug.warn('[MCPClient] Missing toolCallId in sendActionResult for:', actionName);
    }
    
    const request: JSONRPCRequest = {
      jsonrpc: '2.0',
      id: this.nextId(),
      method: 'action/result',
      params: {
        action_name: actionName,
        result,
        tool_call_id: toolCallId,
      },
    };

    debugLog.add({
      event: 'network:request',
      data: { method: 'action/result', action: actionName, tool_call_id: toolCallId, url: this.baseUrl },
      source: 'network',
      level: 'info',
    });

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
        debugLog.add({
          event: 'network:response',
          data: { status: response.status, duration: elapsed, action: actionName, error: errorText },
          source: 'network',
          level: 'error',
        });
        debug.error(
          `[MCPClient] Action result delivery failed: ${response.status} ${response.statusText}`,
          errorText
        );
        throw new Error(`Failed to send action result: ${response.status}`);
      }
      
      debugLog.add({
        event: 'network:response',
        data: { status: response.status, duration: elapsed, action: actionName },
        source: 'network',
        level: 'info',
      });
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

  // ============================================================================
  // Client Logging Methods
  // ============================================================================

  /**
   * Send a client-side log to the server for debugging.
   * 
   * Logs are correlated with agent sessions via the MCP session ID.
   * Use this to forward important SDK events to server logs.
   * 
   * @param level - Log level: 'log', 'warn', or 'error'
   * @param message - The log message
   * @param data - Optional additional data to include
   */
  async sendLog(
    level: 'log' | 'warn' | 'error',
    message: string,
    data?: unknown
  ): Promise<void> {
    const request: JSONRPCRequest = {
      jsonrpc: '2.0',
      id: this.nextId(),
      method: 'client/log',
      params: {
        level,
        message,
        data,
        timestamp: new Date().toISOString(),
      },
    };

    try {
      // Fire and forget - don't block on log delivery
      // Use keepalive to ensure request completes even if page unloads
      fetch(this.baseUrl, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(request),
        keepalive: true,
      }).catch(() => {
        // Silently ignore log delivery failures - don't spam console
      });
    } catch {
      // Silently ignore - logging should never throw
    }
  }

  /**
   * Send a batch of client-side logs to the server.
   * 
   * Logs are buffered and sent periodically (every 5 seconds by default)
   * to reduce network requests. This method is called by the debug module.
   * 
   * @param logs - Array of log entries to send
   */
  sendLogBatch(logs: LogEntry[]): void {
    if (logs.length === 0) return;

    const request: JSONRPCRequest = {
      jsonrpc: '2.0',
      id: this.nextId(),
      method: 'client/log-batch',
      params: { logs },
    };

    try {
      // Fire and forget - don't block on log delivery
      // Use keepalive to ensure request completes even if page unloads
      fetch(this.baseUrl, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(request),
        keepalive: true,
      }).catch(() => {
        // Silently ignore log delivery failures
      });
    } catch {
      // Silently ignore - logging should never throw
    }
  }

  // ============================================================================
  // Session Resumption Methods
  // ============================================================================

  /**
   * Check if a conversation has a resumable interrupted session.
   * 
   * @param conversationId - The conversation UUID to check
   * @returns Session status with resumption details, or null if not resumable
   */
  async getConversationStatus(conversationId: string): Promise<ConversationStatus | null> {
    try {
      const response = await fetch(
        `${this.baseUrl}conversations/${conversationId}/status/`,
        {
          method: 'GET',
          headers: this.headers,
        }
      );

      if (!response.ok) {
        debug.warn(`[MCPClient] Failed to get conversation status: ${response.status}`);
        return null;
      }

      const data = await response.json();
      return data as ConversationStatus;
    } catch (error) {
      debug.warn('[MCPClient] Error getting conversation status:', error);
      return null;
    }
  }

  /**
   * Resume an interrupted conversation.
   * 
   * Returns a streaming response that continues the conversation
   * from where it was interrupted.
   * 
   * @param conversationId - The conversation to resume
   * @param userContext - Optional current page context (highlighted text, DOM snapshot, etc.)
   * @param callbacks - Streaming callbacks
   */
  async resumeConversation(
    conversationId: string,
    userContext: UserContextItem[] | undefined,
    callbacks: StreamCallbacks
  ): Promise<void> {
    try {
      const response = await fetch(
        `${this.baseUrl}conversations/${conversationId}/resume/`,
        {
          method: 'POST',
          headers: {
            ...this.headers,
            'Accept': 'text/event-stream',
          },
          body: JSON.stringify({ user_context: userContext }),
        }
      );

      if (!response.ok) {
        callbacks.onError?.(`Failed to resume conversation: ${response.status}`);
        return;
      }

      if (!response.body) {
        callbacks.onError?.('No response body for resume stream');
        return;
      }

      // Process SSE stream (reuse existing streaming logic)
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data.trim()) {
                try {
                  const parsed = JSON.parse(data);
                  this.handleResumeStreamEvent(parsed, callbacks);
                } catch {
                  // Ignore parse errors
                }
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      callbacks.onComplete?.();
    } catch (error) {
      callbacks.onError?.(`Resume error: ${error}`);
    }
  }

  /**
   * Handle events from the resume stream.
   */
  private handleResumeStreamEvent(
    event: JSONRPCResponse | JSONRPCNotification,
    callbacks: StreamCallbacks
  ): void {
    // Handle notifications (progress events)
    if ('method' in event && event.method === 'notifications/progress') {
      const progress = (event.params as { progress?: Record<string, unknown> })?.progress;
      if (!progress) return;

      const kind = progress.kind as string;

      if (kind === 'token') {
        callbacks.onToken?.(progress.token as string);
      } else if (kind === 'token_usage') {
        callbacks.onTokenUsage?.({
          prompt_tokens: progress.prompt_tokens as number,
          completion_tokens: progress.completion_tokens as number,
          total_prompt_tokens: progress.total_prompt_tokens as number,
          total_completion_tokens: progress.total_completion_tokens as number,
          total_used: progress.total_used as number,
          context_window: progress.context_window as number,
          occupancy_pct: progress.occupancy_pct as number,
          model_name: progress.model_name as string,
          iteration: progress.iteration as number,
        });
      } else if (kind === 'action_request') {
        callbacks.onActionRequest?.({
          action_name: progress.action_name as string,
          parameters: progress.parameters as Record<string, unknown>,
          action: progress.action as ActionData | undefined,
          tool_call_id: progress.tool_call_id as string | undefined,
        });
      } else {
        callbacks.onProgress?.({
          kind,
          id: progress.id as string | undefined,
          label: progress.label as string | undefined,
          status: progress.status as 'active' | 'done' | 'error' | undefined,
          text: progress.text as string | undefined,
        });
      }
      return;
    }

    // Handle final response
    if ('result' in event) {
      const result = event.result as ToolResult;
      
      if (result.structuredContent?.registered_actions) {
        callbacks.onRegisteredActions?.(result.structuredContent.registered_actions);
      }
      
      if (result.structuredContent?.sources) {
        callbacks.onSources?.(result.structuredContent.sources);
      }
      
      if (result.structuredContent?.actions) {
        callbacks.onActions?.(result.structuredContent.actions);
      }
    }

    // Handle errors
    if ('error' in event && event.error) {
      callbacks.onError?.(event.error.message);
    }
  }

}

/**
 * Conversation status for session resumption.
 */
export interface ConversationStatus {
  resumable: boolean;
  message_id?: string;
  elapsed_ms?: number;
  user_message?: string;
  partial_response?: string;
  summary?: string;
  accomplished?: Array<{ action: string; result_summary: string }>;
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
