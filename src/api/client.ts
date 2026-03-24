/**
 * API Client for Pillar SDK
 * Handles all communication with the Pillar backend
 */

import type { TaskButtonData } from "../components/Panel/TaskButton";
import type { ResolvedConfig } from "../core/config";
import type { Context, Suggestion, UserProfile } from "../core/context";
import type { Workflow } from "../core/workflow";
import type { UserContextItem } from "../types/user-context";
import { debug } from "../utils/debug";
import { resilientFetch } from "../utils/resilient-fetch";
import type {
  ActionData,
  ActionRequest,
  ChatImage,
  ImageUploadResponse,
} from "./mcp-client";
import { MCPClient, actionToTaskButton } from "./mcp-client";

// ============================================================================
// Types
// ============================================================================

export interface ArticleSummary {
  id: string;
  title: string;
  slug: string;
  excerpt?: string;
  category_name?: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface SuggestedQuestion {
  id: string;
  text: string;
  /** If true, this is an admin-configured suggestion that should rank first */
  manual?: boolean;
  /** Path pattern for filtering (e.g., "/pricing", "/blog/*", "/docs/**") */
  pathPattern?: string;
}

export interface ChatResponse {
  message: string;
  sources?: ArticleSummary[];
  workflow?: Workflow;
  conversationId?: string;
  messageId?: string;
  actions?: TaskButtonData[];
}

/**
 * Child item within a progress event (e.g., search source, plan step).
 */
export interface ProgressChild {
  id: string;
  label: string;
  url?: string; // For clickable items like sources
}

/**
 * Progress event for tracking AI response generation steps.
 * Uses a generic design where the server controls display text via `label`.
 *
 * The new schema uses `id` and `status` fields. Legacy fields are kept
 * for backwards compatibility with older backend versions.
 */
export interface ProgressEvent {
  kind: string; // Event type: "thinking", "search", "tool_call", "plan", "generating"
  id?: string; // Unique ID for streaming updates (new schema)
  label?: string; // Display label from server (e.g., "Thinking...", "Searching...")
  status?: "active" | "done" | "error"; // Event status for UI rendering
  text?: string; // Accumulated streaming text (delta mode - appended by store)
  children?: ProgressChild[]; // Sub-items (e.g., sources, plan steps)
  metadata?: Record<string, unknown>; // Event-specific data
  // Legacy fields for backwards compatibility
  progress_id?: string; // Deprecated: use id
  message?: string; // Deprecated: use label
}

/**
 * Server-side embed config response.
 * These are admin-configured settings that the SDK merges with local config.
 */
export interface ServerEmbedConfig {
  panel?: {
    enabled?: boolean;
    position?: "left" | "right";
    width?: number;
  };
  floatingButton?: {
    enabled?: boolean;
    position?: string;
    label?: string;
  };
  theme?: {
    colors?: {
      primary?: string;
    };
  };
  security?: {
    /** False when the requesting origin is not in the product's allowed domains list. */
    originAllowed?: boolean;
  };
}

/**
 * Conversation summary in history list.
 */
export interface ConversationSummary {
  id: string;
  title: string;
  startedAt: string | null;
  lastMessageAt: string | null;
  messageCount: number;
}

/**
 * Display step in the agent's timeline.
 * This is a human-readable timeline that includes thinking, tool decisions, and tool results.
 * Used for UI display of the agent's reasoning process.
 */
export interface DisplayStep {
  step_type:
    | "thinking"
    | "tool_decision"
    | "parallel_tool_decision"
    | "tool_result"
    | "token_summary"
    | "step_start"
    | "generating"
    | "narration";
  iteration?: number;
  timestamp_ms?: number;
  content?: string; // For thinking steps
  tool?: string; // For tool_decision/tool_result
  tools?: Array<{ tool: string; arguments: Record<string, unknown> }>; // For parallel_tool_decision
  arguments?: Record<string, unknown>; // For tool_decision
  success?: boolean; // For tool_result
  reasoning?: string; // Agent's reasoning for the decision
  label?: string; // Display label
  [key: string]: unknown; // Allow additional fields
}

/**
 * Message in conversation history.
 * Contains display-oriented fields for UI rendering.
 * LLM-native fields (llm_message) are kept server-side for conversation replay.
 */
export interface HistoryMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string | null;
  // Display field - human-readable timeline for UI
  display_trace?: DisplayStep[];
  // Images attached to user messages (GCS signed URLs)
  images?: ChatImage[];
}

/**
 * Full conversation with messages.
 */
export interface ConversationDetail extends ConversationSummary {
  messages: HistoryMessage[];
}

// ============================================================================
// API Client
// ============================================================================

export class APIClient {
  private config: ResolvedConfig;
  private abortControllers: Map<string, AbortController> = new Map();
  private mcpClient: MCPClient;

  // External user ID for cross-device conversation history
  private _externalUserId: string | null = null;

  constructor(config: ResolvedConfig) {
    this.config = config;
    this.mcpClient = new MCPClient(config);
  }

  /**
   * Get the underlying MCP client.
   * Used by Pillar for direct MCP operations like sendActionResult.
   */
  get mcp(): MCPClient {
    return this.mcpClient;
  }

  private get baseUrl(): string {
    return `${this.config.apiBaseUrl}/api/v1/help-center`;
  }

  /**
   * Set the external user ID for authenticated users.
   * This ID will be included in all subsequent requests.
   */
  setExternalUserId(userId: string): void {
    this._externalUserId = userId;
    this.mcpClient.setExternalUserId(userId);
  }

  /**
   * Clear the external user ID (for logout).
   */
  clearExternalUserId(): void {
    this._externalUserId = null;
    this.mcpClient.setExternalUserId("");
  }

  /**
   * Regenerate the visitor ID.
   * Called on logout to ensure the next user gets a fresh visitor record.
   */
  regenerateVisitorId(): void {
    if (typeof window === "undefined") return;

    const KEY = "pillar_visitor_id";
    try {
      const newId = crypto.randomUUID();
      localStorage.setItem(KEY, newId);
    } catch {
      // localStorage might be unavailable
    }
  }

  // ============================================================================
  // Analytics Helpers
  // ============================================================================

  /**
   * Get or create a persistent visitor ID.
   * Stored in localStorage to persist across sessions.
   */
  private getVisitorId(): string {
    if (typeof window === "undefined") return "";

    const KEY = "pillar_visitor_id";
    try {
      let id = localStorage.getItem(KEY);
      if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem(KEY, id);
      }
      return id;
    } catch {
      // localStorage might be unavailable (e.g., private browsing)
      return "";
    }
  }

  /**
   * Get or create a session ID.
   * Stored in sessionStorage to persist only for the current browser session.
   */
  private getSessionId(): string {
    if (typeof window === "undefined") return "";

    const KEY = "pillar_session_id";
    try {
      let id = sessionStorage.getItem(KEY);
      if (!id) {
        id = crypto.randomUUID();
        sessionStorage.setItem(KEY, id);
      }
      return id;
    } catch {
      // sessionStorage might be unavailable
      return "";
    }
  }

  /**
   * Get the current page URL for analytics tracking.
   */
  private getPageUrl(): string {
    if (typeof window === "undefined") return "";
    return window.location.href;
  }

  private get headers(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-customer-id": this.config.productKey,
      "x-visitor-id": this.getVisitorId(),
      "x-session-id": this.getSessionId(),
      "x-page-url": this.getPageUrl(),
    };

    if (this.config.agentSlug) {
      headers["x-agent-slug"] = this.config.agentSlug;
    }

    if (this._externalUserId) {
      headers["x-external-user-id"] = this._externalUserId;
    }

    if (this.config.platform) {
      headers["X-Pillar-Platform"] = this.config.platform;
    }
    if (this.config.version) {
      headers["X-Pillar-Action-Version"] = this.config.version;
    }

    return headers;
  }

  private async fetch<T>(
    endpoint: string,
    options: RequestInit = {},
    requestId?: string
  ): Promise<T> {
    // Cancel previous request with same ID if exists
    if (requestId) {
      this.abortControllers.get(requestId)?.abort();
      const controller = new AbortController();
      this.abortControllers.set(requestId, controller);
      options.signal = controller.signal;
    }

    const url = `${this.baseUrl}${endpoint}`;

    try {
      const response = await resilientFetch(url, {
        ...options,
        headers: {
          ...this.headers,
          ...options.headers,
        },
        maxRetries: 3,
        onRetry: (attempt, delay) => {
          debug.log(`[Pillar API] Retrying ${endpoint} (attempt ${attempt + 1}) after ${delay}ms...`);
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.detail ||
            errorData.message ||
            `API error: ${response.status}`
        );
      }

      return response.json();
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        throw error; // Re-throw abort errors
      }
      debug.error(`[Pillar API] Error fetching ${endpoint}:`, error);
      throw error;
    } finally {
      if (requestId) {
        this.abortControllers.delete(requestId);
      }
    }
  }

  // ============================================================================
  // Embed Config (Server-Side SDK Settings)
  // ============================================================================

  /**
   * Fetch embed configuration from server.
   * Called during SDK init to get admin-configured settings.
   *
   * @returns Server config or null if fetch fails (SDK continues with defaults)
   */
  async fetchEmbedConfig(): Promise<ServerEmbedConfig | null> {
    try {
      const embedUrl = this.config.agentSlug
        ? `${this.config.apiBaseUrl}/api/public/agents/${this.config.agentSlug}/embed-config/`
        : `${this.config.apiBaseUrl}/api/public/products/${this.config.productKey}/embed-config/`;
      const response = await resilientFetch(
        embedUrl,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
          maxRetries: 3,
          onRetry: (attempt, delay) => {
            debug.log(`[Pillar] Retrying embed config fetch (attempt ${attempt + 1}) after ${delay}ms...`);
          },
        }
      );

      if (!response.ok) {
        debug.warn("[Pillar] Failed to fetch embed config:", response.status);
        return null;
      }

      return await response.json();
    } catch (error) {
      debug.warn("[Pillar] Failed to fetch embed config:", error);
      return null;
    }
  }

  // ============================================================================
  // Suggested Questions
  // ============================================================================

  /**
   * Get AI-generated suggested questions for the home view.
   * Returns action-oriented questions based on the help center's content.
   */
  async getSuggestedQuestions(): Promise<SuggestedQuestion[]> {
    try {
      const result = await this.mcpClient.callTool("suggest_questions", {});

      // Extract questions from structuredContent
      const questions = (
        result as { structuredContent?: { questions?: SuggestedQuestion[] } }
      ).structuredContent?.questions;

      if (Array.isArray(questions)) {
        return questions;
      }

      return [];
    } catch (error) {
      debug.warn("[Pillar] Failed to get suggested questions:", error);
      return [];
    }
  }

  // ============================================================================
  // AI Chat
  // ============================================================================

  /**
   * Upload an image for use in chat.
   *
   * @param file - The image file to upload
   * @returns Promise with signed URL and expiration
   */
  async uploadImage(file: File): Promise<ImageUploadResponse> {
    return this.mcpClient.uploadImage(file);
  }

  async chat(opts: {
    message: string;
    history?: ChatMessage[];
    onChunk?: (chunk: string) => void;
    articleSlug?: string;
    existingConversationId?: string | null;
    onActions?: (actions: TaskButtonData[]) => void;
    userContext?: UserContextItem[];
    images?: ChatImage[];
    isHidden?: boolean;
    onProgress?: (progress: ProgressEvent) => void;
    onConversationStarted?: (
      conversationId: string,
      assistantMessageId?: string
    ) => void;
    onActionRequest?: (request: ActionRequest) => Promise<void>;
    signal?: AbortSignal;
    onRequestId?: (requestId: number) => void;
    resume?: boolean;
  }): Promise<ChatResponse> {
    // Use MCP client for chat via the 'ask' tool
    let fullMessage = "";
    let sources: ArticleSummary[] = [];
    let actions: TaskButtonData[] = [];

    // Import store functions for registered actions and token usage tracking
    const { getRegisteredActions, setRegisteredActions, updateTokenUsage } =
      await import("../store/chat");

    try {
      const result = await this.mcpClient.ask(
        opts.message,
        {
          onToken: (token) => {
            fullMessage += token;
            opts.onChunk?.(token);
          },
          onSources: (s) => {
            sources = s;
          },
          onActions: (a: ActionData[]) => {
            actions = a.map(actionToTaskButton);
            opts.onActions?.(actions);
          },
          onProgress: (p) => {
            opts.onProgress?.(p as ProgressEvent);
          },
          onConversationStarted: (convId, assistantMsgId) => {
            opts.onConversationStarted?.(convId, assistantMsgId);
          },
          onActionRequest: async (request) => {
            if (opts.onActionRequest) {
              await opts.onActionRequest(request);
            }
          },
          onRegisteredActions: (registeredActions) => {
            // Store registered actions for next message (dynamic action tools)
            setRegisteredActions(registeredActions);
            debug.log(
              "[Pillar API] Stored",
              registeredActions.length,
              "registered actions for dynamic tool calling"
            );
          },
          onRequestId: (id) => {
            opts.onRequestId?.(id);
          },
          onTokenUsage: (usage) => {
            updateTokenUsage({
              promptTokens: usage.prompt_tokens,
              completionTokens: usage.completion_tokens,
              totalPromptTokens: usage.total_prompt_tokens,
              totalCompletionTokens: usage.total_completion_tokens,
              totalUsed: usage.total_used,
              contextWindow: usage.context_window,
              occupancyPct: usage.occupancy_pct,
              modelName: usage.model_name,
              iteration: usage.iteration,
            });
          },
          onError: (error) => {
            debug.error("[Pillar API] MCP chat error:", error);
          },
        },
        {
          articleSlug: opts.articleSlug,
          userContext: opts.userContext,
          images: opts.images,
          isHidden: opts.isHidden,
          history: opts.history,
          // Pass registered actions from previous turns for dynamic action tools
          registeredActions: getRegisteredActions(),
          // Always pass conversation ID (generated client-side for new conversations)
          conversationId: opts.existingConversationId || undefined,
          signal: opts.signal,
          resume: opts.resume,
        }
      );

      // If no streaming content was received, extract from result
      if (!fullMessage && result.content[0]?.type === "text") {
        fullMessage = result.content[0].text || "";
      }

      // Extract conversation/message IDs from result _meta if available
      const meta = result._meta || {};

      return {
        message: fullMessage,
        sources,
        actions,
        conversationId: meta.conversation_id,
        messageId: meta.query_log_id,
      };
    } catch (error) {
      debug.error("[Pillar API] Chat error:", error);
      throw error;
    }
  }

  // ============================================================================
  // Feedback
  // ============================================================================

  /**
   * Submit feedback on an AI assistant message.
   * Fire-and-forget - errors are logged but don't throw.
   *
   * @param messageId - The UUID of the assistant message
   * @param feedback - 'up' for helpful, 'down' for not helpful
   * @param comment - Optional comment explaining the feedback
   */
  async submitFeedback(
    messageId: string,
    feedback: "up" | "down",
    comment?: string
  ): Promise<void> {
    try {
      await this.fetch("/ai/feedback/", {
        method: "POST",
        body: JSON.stringify({
          message_id: messageId,
          feedback,
          ...(comment && { comment }),
        }),
      });
    } catch (error) {
      // Fire-and-forget - don't throw on feedback errors
      debug.warn("[Pillar] Feedback submission failed:", error);
    }
  }

  // ============================================================================
  // Task Execution Confirmation
  // ============================================================================

  /**
   * Confirm task execution result.
   * Called by the SDK after a customer's task handler completes.
   * Fire-and-forget - errors are logged but don't throw.
   *
   * @param taskId - The database UUID of the task
   * @param status - 'success' or 'failure'
   * @param details - Optional execution details
   */
  async confirmTaskExecution(
    taskId: string,
    status: "success" | "failure",
    details?: {
      error?: string;
      duration_ms?: number;
      session_id?: string;
      conversation_id?: string;
      [key: string]: unknown;
    }
  ): Promise<void> {
    try {
      const payload = {
        status,
        error: details?.error,
        duration_ms: details?.duration_ms,
        session_id: details?.session_id,
        conversation_id: details?.conversation_id,
        metadata: details,
      };

      await this.fetch(`/tasks/${taskId}/confirm/`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    } catch (error) {
      // Fire-and-forget - don't throw on confirmation errors
      debug.warn("[Pillar] Failed to confirm task execution:", error);
    }
  }

  /**
   * Track WebMCP tool execution.
   * Called when a browser agent invokes a WebMCP-registered tool.
   * Fire-and-forget - errors are logged but don't throw.
   *
   * @param toolName - The name of the tool that was executed
   * @param status - 'success' or 'failure'
   * @param details - Optional execution details
   */
  async trackWebMCPExecution(
    toolName: string,
    status: "success" | "failure",
    details?: {
      duration_ms?: number;
      error?: string;
      input?: Record<string, unknown>;
    }
  ): Promise<void> {
    try {
      const url = `${this.config.apiBaseUrl}/mcp/track-webmcp-execution/`;

      await resilientFetch(url, {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify({
          tool_name: toolName,
          status,
          duration_ms: details?.duration_ms,
          error: details?.error,
          input: details?.input,
          session_id: this.getSessionId(),
          visitor_id: this.getVisitorId(),
        }),
        maxRetries: 1,
      });
    } catch (error) {
      // Fire-and-forget - don't throw on tracking errors
      debug.warn("[Pillar] Failed to track WebMCP execution:", error);
    }
  }

  // ============================================================================
  // Contextual Suggestions
  // ============================================================================

  /**
   * Get contextual help suggestions based on product context.
   * Returns relevant articles, videos, and actions.
   */
  async getSuggestions(
    ctx: Context,
    userProfile: UserProfile
  ): Promise<Suggestion[]> {
    try {
      const response = await this.fetch<{ suggestions: Suggestion[] }>(
        "/suggestions/",
        {
          method: "POST",
          body: JSON.stringify({
            context: ctx,
            user_profile: userProfile,
          }),
        }
      );
      return response.suggestions || [];
    } catch (error) {
      debug.warn("[Pillar] Failed to get suggestions:", error);
      return [];
    }
  }

  // ============================================================================
  // User Identification
  // ============================================================================

  /**
   * Identify the current user after login.
   * Links the anonymous visitor to the authenticated user ID, enabling
   * cross-device conversation history.
   *
   * @param userId - Client's authenticated user ID
   * @param profile - Optional user profile data
   */
  async identify(
    userId: string,
    profile?: {
      name?: string;
      email?: string;
      metadata?: Record<string, unknown>;
    }
  ): Promise<void> {
    const url = `${this.config.apiBaseUrl}/mcp/identify/`;

    const response = await resilientFetch(url, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({
        userId,
        name: profile?.name,
        email: profile?.email,
        metadata: profile?.metadata,
      }),
      maxRetries: 3,
      onRetry: (attempt, delay) => {
        debug.log(`[Pillar] Retrying identify (attempt ${attempt + 1}) after ${delay}ms...`);
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Identify failed: ${response.status}`);
    }
  }

  // ============================================================================
  // Conversation History
  // ============================================================================

  /**
   * List past conversations for the current visitor.
   *
   * @param limit - Max number of conversations to return (default: 20, max: 50)
   * @returns List of conversation summaries
   */
  async listConversations(limit: number = 20): Promise<ConversationSummary[]> {
    const url = `${this.config.apiBaseUrl}/mcp/conversations/?limit=${Math.min(limit, 50)}`;

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: this.headers,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `Failed to list conversations: ${response.status}`
        );
      }

      const data = await response.json();
      return data.conversations || [];
    } catch (error) {
      debug.warn("[Pillar] Failed to list conversations:", error);
      return [];
    }
  }

  /**
   * Get a single conversation with all messages.
   *
   * @param conversationId - UUID of the conversation
   * @returns Conversation with messages
   */
  async getConversation(
    conversationId: string
  ): Promise<ConversationDetail | null> {
    const url = `${this.config.apiBaseUrl}/mcp/conversations/${conversationId}/`;

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: this.headers,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `Failed to get conversation: ${response.status}`
        );
      }

      return await response.json();
    } catch (error) {
      debug.warn("[Pillar] Failed to get conversation:", error);
      return null;
    }
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  cancelAllRequests(): void {
    this.abortControllers.forEach((controller) => controller.abort());
    this.abortControllers.clear();
  }
}
