/**
 * WebMCP Type Declarations
 *
 * Type definitions for the W3C WebMCP API (navigator.modelContext).
 * This API allows web pages to expose tools to AI agents.
 */

interface WebMCPToolDefinition {
  name: string;
  description: string;
  inputSchema?: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
  execute: (params: unknown, agent: WebMCPAgent) => Promise<WebMCPToolResult>;
}

interface WebMCPToolResult {
  content: Array<
    | { type: "text"; text: string }
    | { type: "image"; data: string; mimeType: string }
  >;
  isError?: boolean;
}

interface WebMCPAgent {
  requestUserInteraction: <T>(callback: () => T | Promise<T>) => Promise<T>;
}

interface WebMCPModelContext {
  registerTool(tool: WebMCPToolDefinition): void;
  unregisterTool(name: string): void;
  provideContext(context: { tools: WebMCPToolDefinition[] }): void;
}

declare global {
  interface Navigator {
    modelContext?: WebMCPModelContext;
  }
}

export {};
