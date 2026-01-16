/**
 * API Client for Pillar SDK
 * Handles all communication with the Pillar backend
 */

import type { TaskButtonData } from '../components/Panel/TaskButton';
import type { ResolvedConfig } from '../core/config';
import type { ProductContext, Suggestion, UserProfile } from '../core/context';
import type { ExecutionPlan } from '../core/plan';
import type { Workflow } from '../core/workflow';
import type { UserContextItem } from '../types/user-context';
import type { ActionData, ChatImage, ImageUploadResponse } from './mcp-client';
import { MCPClient, actionToTaskButton } from './mcp-client';

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
  kind: 'search' | 'search_complete' | 'generating' | 'thinking';
  message?: string;
  progress_id?: string;
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
  features?: {
    aiChatEnabled?: boolean;
    searchEnabled?: boolean;
    tooltipsEnabled?: boolean;
  };
  sidebarTabs?: Array<{
    id: string;
    label: string;
    enabled: boolean;
    order: number;
  }>;
  theme?: {
    colors?: {
      primary?: string;
    };
  };
}

// ============================================================================
// API Client
// ============================================================================

export class APIClient {
  private config: ResolvedConfig;
  private abortControllers: Map<string, AbortController> = new Map();
  private mcpClient: MCPClient;

  constructor(config: ResolvedConfig) {
    this.config = config;
    this.mcpClient = new MCPClient(config);
  }

  private get baseUrl(): string {
    return `${this.config.apiBaseUrl}/api/v1/help-center`;
  }

  // ============================================================================
  // Analytics Helpers
  // ============================================================================

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
   * Get or create a session ID.
   * Stored in sessionStorage to persist only for the current browser session.
   */
  private getSessionId(): string {
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
      'X-Pillar-Key': this.config.publicKey,
      'x-customer-id': this.config.helpCenter, // Help center subdomain for middleware resolution
      'x-visitor-id': this.getVisitorId(),
      'x-session-id': this.getSessionId(),
      'x-page-url': this.getPageUrl(),
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
        `${this.config.apiBaseUrl}/api/public/products/${this.config.helpCenter}/embed-config/`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-Pillar-Key': this.config.publicKey,
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
    onProgress?: (progress: ProgressEvent) => void
  ): Promise<ChatResponse> {
    // Use MCP client for chat via the 'ask' tool
    let fullMessage = '';
    let sources: ArticleSummary[] = [];
    let actions: TaskButtonData[] = [];

    try {
      const result = await this.mcpClient.ask(
        message,
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
          onPlan: (plan) => {
            onPlan?.(plan);
          },
          onProgress: (p) => {
            onProgress?.(p as ProgressEvent);
          },
          onError: (error) => {
            console.error('[Pillar API] MCP chat error:', error);
          },
        },
        { articleSlug, userContext, images }
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
        context: this.config.context,
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
    productContext: ProductContext,
    userProfile: UserProfile
  ): Promise<Suggestion[]> {
    try {
      const response = await this.fetch<{ suggestions: Suggestion[] }>(
        '/suggestions/',
        {
          method: 'POST',
          body: JSON.stringify({
            context: productContext,
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
    productContext: ProductContext,
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
            product: productContext,
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

