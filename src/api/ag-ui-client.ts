/**
 * AG-UI Protocol Client for Pillar SDK
 *
 * Implements the AG-UI specification for streaming agent interactions.
 * Uses the @ag-ui/client HttpAgent for transport.
 *
 * Copyright (C) 2025 Pillar Team
 */

import { HttpAgent } from '@ag-ui/client';
import type {
  Context,
  Message,
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
  StateSnapshotEvent,
  Tool,
} from '@ag-ui/core';

import type { ResolvedConfig } from '../core/config';

// ============================================================================
// Types
// ============================================================================

export interface AGUIStreamCallbacks {
  /** Called when run starts */
  onRunStarted?: (runId: string) => void;
  /** Called when run completes successfully */
  onRunFinished?: () => void;
  /** Called on error */
  onError?: (error: Error) => void;
  /** Called when a step starts */
  onStepStarted?: (stepName: string) => void;
  /** Called when a step finishes */
  onStepFinished?: (stepName: string) => void;
  /** Called for text message streaming */
  onTextContent?: (messageId: string, delta: string) => void;
  /** Called when text message completes */
  onTextComplete?: (messageId: string, fullContent: string) => void;
  /** Called when tool call starts (for UI display) */
  onToolCallStart?: (toolCallId: string, toolName: string) => void;
  /** Called with tool call arguments */
  onToolCallArgs?: (toolCallId: string, argsJson: string) => void;
  /** Called when tool call completes */
  onToolCallEnd?: (toolCallId: string) => void;
  /** Called when tool result is available */
  onToolCallResult?: (toolCallId: string, result: string) => void;
  /** Called for state delta events (sources, actions, plan) */
  onStateDelta?: (delta: unknown[]) => void;
  /** Called for state snapshots */
  onStateSnapshot?: (state: unknown) => void;
}

export interface ClientTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  /** Handler function - called when agent requests this tool */
  handler?: (args: Record<string, unknown>) => Promise<unknown>;
}

// ============================================================================
// AG-UI Client
// ============================================================================

export class AGUIClient {
  private config: ResolvedConfig;
  private agent: HttpAgent;
  private currentRunId: string | null = null;
  private currentThreadId: string;
  private messageAccumulators: Map<string, string> = new Map();
  private toolArgAccumulators: Map<string, string> = new Map();
  private toolCallNames: Map<string, string> = new Map();
  private registeredTools: Map<string, ClientTool> = new Map();

  constructor(config: ResolvedConfig) {
    this.config = config;
    this.currentThreadId = this.getOrCreateThreadId();

    this.agent = new HttpAgent({
      url: `${this.config.apiBaseUrl}/mcp/agent/`,
      threadId: this.currentThreadId,
      headers: {
        'x-customer-id': this.config.productKey,
        'Accept-Language': this.getBrowserLanguage(),
        ...(this.config.platform && { 'X-Pillar-Platform': this.config.platform }),
        ...(this.config.version && { 'X-Pillar-Action-Version': this.config.version }),
      },
    });
  }

  /**
   * Get or create a persistent thread ID for this session.
   */
  private getOrCreateThreadId(): string {
    if (typeof window === 'undefined') return crypto.randomUUID();

    const KEY = 'pillar_thread_id';
    try {
      let id = sessionStorage.getItem(KEY);
      if (!id) {
        id = crypto.randomUUID();
        sessionStorage.setItem(KEY, id);
      }
      return id;
    } catch {
      return crypto.randomUUID();
    }
  }

  private getBrowserLanguage(): string {
    if (typeof navigator === 'undefined') return 'en';
    return navigator.language || 'en';
  }

  /**
   * Register a client-side tool that can be called by the agent.
   */
  registerTool(tool: ClientTool): void {
    this.registeredTools.set(tool.name, tool);
  }

  /**
   * Unregister a client-side tool.
   */
  unregisterTool(toolName: string): void {
    this.registeredTools.delete(toolName);
  }

  /**
   * Send a message and stream the agent's response.
   */
  async chat(
    message: string,
    callbacks: AGUIStreamCallbacks,
    options?: {
      history?: Array<{ role: 'user' | 'assistant'; content: string }>;
      userContext?: Array<{ type: string; [key: string]: unknown }>;
      signal?: AbortSignal;
    }
  ): Promise<void> {
    // Build messages array
    const messages: Message[] = [
      ...(options?.history || []).map((msg, i) => ({
        id: `hist_${i}`,
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
      {
        id: crypto.randomUUID(),
        role: 'user' as const,
        content: message,
      },
    ];

    // Build context array from user context
    const context: Context[] = (options?.userContext || []).map((item) => ({
      description: item.type,
      value: JSON.stringify(item),
    }));

    // Build tools array from registered tools
    const tools: Tool[] = Array.from(this.registeredTools.values()).map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    }));

    // Reset accumulators
    this.messageAccumulators.clear();
    this.toolArgAccumulators.clear();
    this.toolCallNames.clear();

    // Generate run ID
    const runId = crypto.randomUUID();
    this.currentRunId = runId;

    // Run the agent using the subscriber pattern
    return new Promise((resolve, reject) => {
      this.agent.runAgent(
        {
          runId,
          tools,
          context,
          forwardedProps: { messages },
        },
        {
          onRunInitialized: () => {
            // Agent is starting
          },
          onRunFailed: ({ error }) => {
            callbacks.onError?.(error);
            reject(error);
          },
          onRunFinalized: () => {
            resolve();
          },
          onRunStartedEvent: ({ event }) => {
            callbacks.onRunStarted?.(event.runId);
          },
          onRunFinishedEvent: () => {
            callbacks.onRunFinished?.();
          },
          onRunErrorEvent: ({ event }) => {
            callbacks.onError?.(new Error(event.message));
          },
          onStepStartedEvent: ({ event }) => {
            callbacks.onStepStarted?.(event.stepName);
          },
          onStepFinishedEvent: ({ event }) => {
            callbacks.onStepFinished?.(event.stepName);
          },
          onTextMessageStartEvent: ({ event }) => {
            this.messageAccumulators.set(event.messageId, '');
          },
          onTextMessageContentEvent: ({ event, textMessageBuffer }) => {
            this.messageAccumulators.set(event.messageId, textMessageBuffer);
            callbacks.onTextContent?.(event.messageId, event.delta);
          },
          onTextMessageEndEvent: ({ event, textMessageBuffer }) => {
            callbacks.onTextComplete?.(event.messageId, textMessageBuffer);
          },
          onToolCallStartEvent: ({ event }) => {
            this.toolArgAccumulators.set(event.toolCallId, '');
            this.toolCallNames.set(event.toolCallId, event.toolCallName);
            callbacks.onToolCallStart?.(event.toolCallId, event.toolCallName);
          },
          onToolCallArgsEvent: ({ event, toolCallBuffer }) => {
            this.toolArgAccumulators.set(event.toolCallId, toolCallBuffer);
            callbacks.onToolCallArgs?.(event.toolCallId, event.delta);
          },
          onToolCallEndEvent: async ({ event, toolCallName, toolCallArgs }) => {
            callbacks.onToolCallEnd?.(event.toolCallId);
            // Check if this is a client-side tool
            await this.maybeExecuteClientTool(event.toolCallId, toolCallName, toolCallArgs);
          },
          onToolCallResultEvent: ({ event }) => {
            callbacks.onToolCallResult?.(event.toolCallId, event.content);
          },
          onStateDeltaEvent: ({ event }) => {
            callbacks.onStateDelta?.(event.delta);
          },
          onStateSnapshotEvent: ({ event }) => {
            callbacks.onStateSnapshot?.(event.snapshot);
          },
        }
      ).catch(reject);
    });
  }

  /**
   * Execute a client-side tool if registered.
   */
  private async maybeExecuteClientTool(
    toolCallId: string,
    toolName: string,
    toolCallArgs: Record<string, unknown>
  ): Promise<void> {
    const tool = this.registeredTools.get(toolName);
    if (!tool?.handler) return;

    try {
      // Execute the handler with parsed args
      const result = await tool.handler(toolCallArgs);

      // Send result back to server
      await this.sendToolResult(toolCallId, result);
    } catch (error) {
      // Send error back to server
      await this.sendToolResult(toolCallId, null, String(error));
    }
  }

  /**
   * Send tool execution result back to the server.
   */
  async sendToolResult(
    toolCallId: string,
    result: unknown,
    error?: string
  ): Promise<void> {
    const url = `${this.config.apiBaseUrl}/mcp/agent/tool-result/`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-customer-id': this.config.productKey,
        },
        body: JSON.stringify({
          thread_id: this.currentThreadId,
          run_id: this.currentRunId,
          tool_call_id: toolCallId,
          result,
          error,
        }),
      });

      if (!response.ok) {
        console.error('[AGUIClient] Failed to send tool result:', response.status);
      }
    } catch (err) {
      console.error('[AGUIClient] Error sending tool result:', err);
    }
  }

  /**
   * Start a new conversation thread.
   */
  newThread(): string {
    this.currentThreadId = crypto.randomUUID();
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem('pillar_thread_id', this.currentThreadId);
      } catch {
        /* ignore */
      }
    }
    return this.currentThreadId;
  }

  /**
   * Get current thread ID.
   */
  get threadId(): string {
    return this.currentThreadId;
  }

  /**
   * Get current run ID.
   */
  get runId(): string | null {
    return this.currentRunId;
  }
}
