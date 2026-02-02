/**
 * API Client for Pillar SDK
 * Handles all communication with the Pillar backend
 */

import type { TaskButtonData } from '../components/Panel/TaskButton';
import type { ResolvedConfig } from '../core/config';
import type { Context, Suggestion, UserProfile } from '../core/context';
import type { ExecutionPlan } from '../core/plan';
import type { Workflow } from '../core/workflow';
import type { UserContextItem } from '../types/user-context';
import type { ActionData, ChatImage, ImageUploadResponse, QueryRequest } from './mcp-client';
import { MCPClient, actionToTaskButton } from './mcp-client';
import { AGUIClientAdapter } from './ag-ui-adapter';

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
  role: 'user' | 'assistant';
  content: string;
}

export interface SuggestedQuestion {
  id: string;
  text: string;
}

export interface ChatResponse {
  message: string;
  sources?: ArticleSummary[];
  workflow?: Workflow;
  conversationId?: string;
  messageId?: string;
  actions?: TaskButtonData[];
}

export interface ProgressEvent {
  progress_id?: string;      // Unique ID for updating/replacing events (enables streaming)
  markdown: string;          // Markdown content to render
  is_streaming?: boolean;    // True if this is a streaming chunk
  is_step_start?: boolean;   // True if this starts a new reasoning step
  is_step_complete?: boolean; // True if this completes a reasoning step
  iteration?: number;        // Iteration number for multi-step reasoning
}

/**
 * Server-side embed config response.
 * These are admin-configured settings that the SDK merges with local config.
 */
export interface ServerEmbedConfig {
  panel?: {
    enabled?: boolean;
    position?: 'left' | 'right';
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
 * Full conversation with messages.
 */
export interface ConversationDetail extends ConversationSummary {
  messages: Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: string | null;
  }>;
}

// ============================================================================
// API Client
// ============================================================================

export class APIClient {
  private config: ResolvedConfig;
  private abortControllers: Map<string, AbortController> = new Map();
  private mcpClient: MCPClient;
  private aguiClient: AGUIClientAdapter;

  // External user ID for cross-device conversation history
  private _externalUserId: string | null = null;

  // Visitor and session IDs (initialized eagerly on construction)
  private _visitorId: string = '';
  private _sessionId: string = '';

  constructor(config: ResolvedConfig) {
    this.config = config;
    // MCPClient is still used for plan management and other non-streaming operations
    this.mcpClient = new MCPClient(config);
    // AG-UI client is used for all chat streaming
    this.aguiClient = new AGUIClientAdapter(config);
    
    // Initialize visitor and session IDs immediately
    this._visitorId = this.initVisitorId();
    this._sessionId = this.initSessionId();
    // External user ID is set via identify() - no localStorage persistence
    this._externalUserId = null;
  }

  /**
   * Get the underlying MCP client.
   * Used by Pillar for plan management operations.
   */
  get mcp(): MCPClient {
    return this.mcpClient;
  }

  /**
   * Get the AG-UI client adapter for chat operations.
   */
  get agui(): AGUIClientAdapter {
    return this.aguiClient;
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
    // Also update the MCP client
    this.mcpClient.setExternalUserId(userId);
  }

  /**
   * Clear the external user ID (for logout).
   */
  clearExternalUserId(): void {
    this._externalUserId = null;
    // Also clear from the MCP client
    this.mcpClient.clearExternalUserId();
  }

  // ============================================================================
  // Analytics Helpers
  // ============================================================================

  /**
   * Initialize the persistent visitor ID on SDK init.
   * Stored in localStorage to persist across sessions.
   */
  private initVisitorId(): string {
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
   * Initialize the session ID on SDK init.
   * Stored in sessionStorage to persist only for the current browser session.
   */
  private initSessionId(): string {
    if (typeof window === 'undefined') return '';
    
    const KEY = 'pillar_session_id';
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

  private get headers(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-customer-id': this.config.productKey, // Product key for middleware resolution
      'x-visitor-id': this._visitorId,
      'x-session-id': this._sessionId,
      'x-page-url': this.getPageUrl(),
    };

    // Add external user ID header for authenticated users (enables cross-device history)
    if (this._externalUserId) {
      headers['x-external-user-id'] = this._externalUserId;
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
      const response = await fetch(url, {
        ...options,
        headers: {
          ...this.headers,
          ...options.headers,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || errorData.message || `API error: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        throw error; // Re-throw abort errors
      }
      console.error(`[Pillar API] Error fetching ${endpoint}:`, error);
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
      const response = await fetch(
        `${this.config.apiBaseUrl}/api/public/products/${this.config.productKey}/embed-config/`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      
      if (!response.ok) {
        console.warn('[Pillar] Failed to fetch embed config:', response.status);
        return null;
      }
      
      return await response.json();
    } catch (error) {
      console.warn('[Pillar] Failed to fetch embed config:', error);
      return null;
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
    profile?: { name?: string; email?: string; metadata?: Record<string, unknown> }
  ): Promise<void> {
    const url = `${this.config.apiBaseUrl}/mcp/identify/`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        userId,
        name: profile?.name,
        email: profile?.email,
        metadata: profile?.metadata,
      }),
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
        method: 'GET',
        headers: this.headers,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to list conversations: ${response.status}`);
      }

      const data = await response.json();
      return data.conversations || [];
    } catch (error) {
      console.warn('[Pillar] Failed to list conversations:', error);
      return [];
    }
  }

  /**
   * Get a single conversation with all messages.
   * 
   * @param conversationId - The conversation ID to fetch
   * @returns Full conversation with messages
   */
  async getConversation(conversationId: string): Promise<ConversationDetail | null> {
    const url = `${this.config.apiBaseUrl}/mcp/conversations/${conversationId}/`;
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: this.headers,
      });

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to get conversation: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.warn('[Pillar] Failed to get conversation:', error);
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
      const result = await this.mcpClient.callTool('suggest_questions', {});
      
      // Extract questions from structuredContent
      const questions = (result as { structuredContent?: { questions?: SuggestedQuestion[] } })
        .structuredContent?.questions;
      
      if (Array.isArray(questions)) {
        return questions;
      }
      
      return [];
    } catch (error) {
      console.warn('[Pillar] Failed to get suggested questions:', error);
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

  async chat(
    message: string,
    history: ChatMessage[] = [],
    onChunk?: (chunk: string) => void,
    articleSlug?: string,
    existingConversationId?: string | null,
    onActions?: (actions: TaskButtonData[]) => void,
    onPlan?: (plan: ExecutionPlan) => void,
    userContext?: UserContextItem[],
    images?: ChatImage[],
    onProgress?: (progress: ProgressEvent) => void,
    onConversationStarted?: (conversationId: string, messageId?: string) => void,
    onQueryRequest?: (request: QueryRequest) => Promise<void>
  ): Promise<ChatResponse> {
    // Use AG-UI client for chat streaming
    try {
      const result = await this.aguiClient.chat(message, {
        onToken: onChunk,
        onSources: () => {}, // Sources come via onStateDelta in adapter
        onActions: onActions,
        onPlan: onPlan,
        onProgress: onProgress,
        onConversationStarted: onConversationStarted,
        onError: (error) => {
          console.error('[Pillar API] AG-UI chat error:', error);
        },
        onComplete: () => {},
      }, {
        history,
        userContext,
      });
      
      return result;
    } catch (error) {
      console.error('[Pillar API] Chat error:', error);
      throw error;
    }
  }

  /**
   * Legacy chat method using the old /ai/chat/ endpoint.
   * @deprecated Use chat() which uses the MCP protocol.
   */
  async chatLegacy(
    message: string,
    history: ChatMessage[] = [],
    onChunk?: (chunk: string) => void,
    articleSlug?: string,
    existingConversationId?: string | null
  ): Promise<ChatResponse> {
    const url = `${this.baseUrl}/ai/chat/`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        message,
        history,
        ...(articleSlug && { article_slug: articleSlug }),
        ...(existingConversationId && { conversation_id: existingConversationId }),
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || errorData.message || `Chat error: ${response.status}`);
    }

    // Handle streaming response
    if (onChunk && response.headers.get('content-type')?.includes('text/event-stream')) {
      return this.handleStreamingChat(response, onChunk);
    }

    // Handle non-streaming response
    const data = await response.json();
    return {
      message: data.answer || data.message,
      sources: data.sources,
      workflow: data.workflow || data.structuredContent?.workflow,
      conversationId: data.conversation_id,
      messageId: data.message_id,
    };
  }

  private async handleStreamingChat(
    response: Response,
    onChunk: (chunk: string) => void
  ): Promise<ChatResponse> {
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let fullMessage = '';
    let sources: ArticleSummary[] = [];
    let workflow: Workflow | undefined;
    let conversationId: string | undefined;
    let messageId: string | undefined;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                fullMessage += parsed.content;
                onChunk(parsed.content);
              }
              if (parsed.sources) {
                sources = parsed.sources;
              }
              // Check for workflow in structured content or direct field
              if (parsed.workflow) {
                workflow = parsed.workflow;
              }
              if (parsed.structuredContent?.workflow) {
                workflow = parsed.structuredContent.workflow;
              }
              // Capture conversation and message IDs from stream
              if (parsed.conversation_id) {
                conversationId = parsed.conversation_id;
              }
              if (parsed.message_id) {
                messageId = parsed.message_id;
              }
            } catch {
              // Not JSON, might be raw text
              fullMessage += data;
              onChunk(data);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return { message: fullMessage, sources, workflow, conversationId, messageId };
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
    feedback: 'up' | 'down',
    comment?: string
  ): Promise<void> {
    try {
      await this.fetch('/ai/feedback/', {
        method: 'POST',
        body: JSON.stringify({
          message_id: messageId,
          feedback,
          ...(comment && { comment }),
        }),
      });
    } catch (error) {
      // Fire-and-forget - don't throw on feedback errors
      console.warn('[Pillar] Feedback submission failed:', error);
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
    status: 'success' | 'failure',
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
        method: 'POST',
        body: JSON.stringify(payload),
      });
    } catch (error) {
      // Fire-and-forget - don't throw on confirmation errors
      console.warn('[Pillar] Failed to confirm task execution:', error);
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
        '/suggestions/',
        {
          method: 'POST',
          body: JSON.stringify({
            context: ctx,
            user_profile: userProfile,
          }),
        }
      );
      return response.suggestions || [];
    } catch (error) {
      console.warn('[Pillar] Failed to get suggestions:', error);
      return [];
    }
  }

  /**
   * Chat with enhanced context.
   * Includes product context and user profile for better responses.
   * 
   * Note: Context is passed to the MCP ask tool as additional arguments.
   */
  async chatWithContext(
    message: string,
    history: ChatMessage[] = [],
    ctx: Context,
    userProfile: UserProfile,
    onChunk?: (chunk: string) => void,
    existingConversationId?: string | null,
    onActions?: (actions: TaskButtonData[]) => void
  ): Promise<ChatResponse> {
    // Use MCP client for chat via the 'ask' tool with context
    let fullMessage = '';
    let sources: ArticleSummary[] = [];
    let actions: TaskButtonData[] = [];

    try {
      const result = await this.mcpClient.callToolStream(
        'ask',
        {
          query: message,
          context: {
            product: ctx,
            user_profile: userProfile,
          },
          ...(existingConversationId && { conversation_id: existingConversationId }),
        },
        {
          onToken: (token) => {
            fullMessage += token;
            onChunk?.(token);
          },
          onSources: (s) => {
            sources = s;
          },
          onActions: (a: ActionData[]) => {
            actions = a.map(actionToTaskButton);
            onActions?.(actions);
          },
          onError: (error) => {
            console.error('[Pillar API] MCP chat with context error:', error);
          },
        }
      );

      // If no streaming content was received, extract from result
      if (!fullMessage && result.content[0]?.type === 'text') {
        fullMessage = result.content[0].text || '';
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
      console.error('[Pillar API] Chat with context error:', error);
      throw error;
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

