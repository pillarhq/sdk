/**
 * AG-UI Progress Component
 *
 * Displays real-time progress based on AG-UI state signals.
 * Renders step indicators, thinking content, and tool call status.
 *
 * This component replaces the old markdown-based ProgressRow for live
 * streaming. ProgressRow is still used for rendering stored history.
 */

import { h, VNode } from 'preact';
import {
  currentStep,
  streamingMessages,
  activeToolCalls,
} from '../../store/chat';
import type { StreamingMessage, ToolCallState } from '../../api/ag-ui-handler';

// ============================================================================
// Main Component
// ============================================================================

/**
 * Render AG-UI progress state.
 * Shows current step, streaming thinking messages, and active tool calls.
 */
export function AGUIProgress(): VNode | null {
  const step = currentStep.value;
  const messages = streamingMessages.value;
  const tools = activeToolCalls.value;

  // Nothing to show if no active step, messages, or tools
  if (!step && messages.size === 0 && tools.size === 0) {
    return null;
  }

  // Get thinking messages (reasoning step)
  const thinkingMessages = Array.from(messages.values()).filter(
    (m) => !m.complete && m.stepName === 'reasoning'
  );

  // Get active tool calls (not yet complete)
  const activeTools = Array.from(tools.values()).filter((t) => !t.complete);

  return (
    <div class="_pillar-agui-progress pillar-agui-progress">
      {/* Show current step indicator if not already showing thinking */}
      {step && thinkingMessages.length === 0 && activeTools.length === 0 && (
        <StepIndicator stepName={step} />
      )}

      {/* Show streaming thinking messages */}
      {thinkingMessages.map((msg) => (
        <ThinkingMessage key={msg.id} message={msg} />
      ))}

      {/* Show active tool calls */}
      {activeTools.map((tool) => (
        <ToolCallIndicator key={tool.id} toolCall={tool} />
      ))}
    </div>
  );
}

// ============================================================================
// Sub-Components
// ============================================================================

interface StepIndicatorProps {
  stepName: string;
}

/**
 * Display a step indicator with spinner.
 */
function StepIndicator({ stepName }: StepIndicatorProps): VNode {
  const label = STEP_LABELS[stepName] || formatStepName(stepName);

  return (
    <div class="_pillar-step-indicator pillar-step-indicator">
      <span class="_pillar-spinner pillar-spinner" />
      <span class="_pillar-step-label pillar-step-label">{label}</span>
    </div>
  );
}

interface ThinkingMessageProps {
  message: StreamingMessage;
}

/**
 * Display a streaming thinking message with live content.
 */
function ThinkingMessage({ message }: ThinkingMessageProps): VNode {
  return (
    <div class="_pillar-thinking-stream pillar-thinking-stream">
      <div class="_pillar-thinking-header pillar-thinking-header">
        <span class="_pillar-thinking-icon pillar-thinking-icon">
          <span class="_pillar-spinner pillar-spinner" />
        </span>
        <span class="_pillar-thinking-label pillar-thinking-label">
          Thinking...
        </span>
      </div>
      {message.content && (
        <div class="_pillar-thinking-content pillar-thinking-content">
          {message.content}
        </div>
      )}
    </div>
  );
}

interface ToolCallIndicatorProps {
  toolCall: ToolCallState;
}

/**
 * Display an active tool call indicator.
 */
function ToolCallIndicator({ toolCall }: ToolCallIndicatorProps): VNode {
  const label = TOOL_LABELS[toolCall.name] || formatToolName(toolCall.name);

  return (
    <div class="_pillar-tool-call pillar-tool-call">
      <span class="_pillar-spinner pillar-spinner" />
      <span class="_pillar-tool-label pillar-tool-label">{label}</span>
    </div>
  );
}

// ============================================================================
// Label Mappings
// ============================================================================

/** Human-readable labels for step names */
const STEP_LABELS: Record<string, string> = {
  reasoning: 'Thinking...',
  thinking: 'Thinking...',
  tool_execution: 'Running action...',
  response_generation: 'Writing response...',
  search: 'Searching...',
  search_knowledge: 'Searching knowledge base...',
  search_help_center: 'Searching help center...',
};

/** Human-readable labels for tool names */
const TOOL_LABELS: Record<string, string> = {
  search_knowledge: 'Searching knowledge base...',
  search_help_center: 'Searching help center...',
  list_datasets: 'Fetching datasets...',
  get_user_data: 'Getting user data...',
  create_plan: 'Creating plan...',
};

/**
 * Format a step name to be human-readable.
 */
function formatStepName(stepName: string): string {
  return (
    stepName
      // Replace underscores with spaces
      .replace(/_/g, ' ')
      // Capitalize first letter
      .replace(/^\w/, (c) => c.toUpperCase()) + '...'
  );
}

/**
 * Format a tool name to be human-readable.
 */
function formatToolName(toolName: string): string {
  return (
    toolName
      // Replace underscores with spaces
      .replace(/_/g, ' ')
      // Capitalize first letter
      .replace(/^\w/, (c) => c.toUpperCase()) + '...'
  );
}
