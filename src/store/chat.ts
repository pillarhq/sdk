/**
 * Chat Store
 * Signal-based state for chat messages and interaction
 */

import { computed, signal } from '@preact/signals';
import type { ArticleSummary, ChatMessage } from '../api/client';
import type { ChatImage } from '../api/mcp-client';
import type { TaskButtonData } from '../components/Panel/TaskButton';
import type { UserContextItem } from '../types/user-context';
import { generateContextId } from '../types/user-context';
import { clearPlan } from './plan';

// Re-export ChatImage for convenience
export type { ChatImage } from '../api/mcp-client';

// Action completion status for tracking auto-run action results
export interface ActionStatus {
  status: 'pending' | 'success' | 'failed';
  completedAt?: number;
  errorMessage?: string;
}

// Extended chat message with server-assigned ID for feedback
export interface StoredChatMessage extends ChatMessage {
  id?: string; // Server-assigned message ID (for assistant messages)
  feedback?: 'up' | 'down' | null; // User feedback on this message
  actions?: TaskButtonData[]; // Actions associated with this message
  sources?: ArticleSummary[]; // Sources associated with this message
  actionStatus?: Record<string, ActionStatus>; // Track action completion status per action
  userContext?: UserContextItem[]; // User context items sent with this message
  images?: ChatImage[]; // Images attached to user messages
  progressEvents?: ProgressEvent[]; // Thinking steps stored per-message for history
}

// Chat messages history
export const messages = signal<StoredChatMessage[]>([]);

// Current conversation ID (server-assigned, persists across messages in a conversation)
export const conversationId = signal<string | null>(null);

// Whether chat is currently loading a response
export const isLoading = signal(false);

// Current progress status during loading (simple message display)
export interface ProgressStatus {
  message?: string;
}

export const progressStatus = signal<ProgressStatus>({});

// Progress event for accumulating all progress events during a response
// Uses markdown-first design where the server sends pre-formatted markdown content
export interface ProgressEvent {
  progress_id?: string;      // Unique ID for updating/replacing events (enables streaming)
  markdown: string;          // Markdown content to render (collapsible sections, progress indicators, etc.)
  is_streaming?: boolean;    // True if this is a streaming chunk (accumulate with previous)
  is_step_start?: boolean;   // True if this starts a new reasoning step
  is_step_complete?: boolean; // True if this completes a reasoning step
  iteration?: number;        // Iteration number for multi-step reasoning
}

/**
 * @deprecated Use message.progressEvents instead.
 * This global signal is kept for backwards compatibility with progressStatus.
 */
export const progressEvents = signal<ProgressEvent[]>([]);

/**
 * Add a progress event to the last assistant message.
 * Events are stored directly on the message as they arrive.
 * 
 * If an event with the same progress_id already exists, it is updated
 * rather than appended. This enables streaming updates to a single step.
 * 
 * For streaming events (is_streaming=true), markdown is accumulated.
 * For non-streaming events, markdown replaces the existing content.
 */
export const addProgressEventToLastMessage = (event: ProgressEvent) => {
  const msgs = messages.value;
  if (msgs.length > 0 && msgs[msgs.length - 1].role === 'assistant') {
    const lastMsg = msgs[msgs.length - 1];
    const existingEvents = lastMsg.progressEvents || [];

    let updatedEvents: ProgressEvent[];

    // Check if this event should update an existing one (by progress_id)
    if (event.progress_id) {
      const existingIndex = existingEvents.findIndex(
        (e) => e.progress_id === event.progress_id
      );

      if (existingIndex !== -1) {
        // Update existing event
        updatedEvents = [...existingEvents];
        const existing = existingEvents[existingIndex];
        
        let newMarkdown: string;
        
        if (event.is_streaming) {
          // Accumulate markdown for streaming events
          newMarkdown = (existing.markdown || '') + (event.markdown || '');
        } else if (event.is_step_complete) {
          // Step complete: wrap accumulated thinking in a "Thinking" collapsible
          // Note: Don't add step summary here - the backend already sent a separate 
          // progress event with the query result summary
          if (existing.markdown) {
            // Wrap thinking content with "Thinking" title
            newMarkdown = `\`\`\`collapsible:Thinking\n${existing.markdown}\n\`\`\``;
          } else {
            // No thinking content - just mark complete (content was in separate progress event)
            newMarkdown = '';
          }
        } else {
          // Non-streaming, non-step-complete: replace
          newMarkdown = event.markdown;
        }
        
        updatedEvents[existingIndex] = {
          ...existing,
          ...event,
          markdown: newMarkdown,
        };
      } else {
        // New progress_id - append as new event
        updatedEvents = [...existingEvents, event];
      }
    } else {
      // No progress_id - always append
      updatedEvents = [...existingEvents, event];
    }

    messages.value = [
      ...msgs.slice(0, -1),
      {
        ...lastMsg,
        progressEvents: updatedEvents,
      },
    ];
  }
};

// Whether chat area is expanded (shows messages)
export const isExpanded = signal(false);

// Current sources from the last response (deprecated - now stored per message)
// Kept for backwards compatibility with resetChat()
export const currentSources = signal<ArticleSummary[]>([]);

// Current actions from the last response (deprecated - now stored per message)
// Kept for backwards compatibility with resetChat()
export const currentActions = signal<TaskButtonData[]>([]);

// Pre-filled text for chat input (from text selection)
export const prefillText = signal<string>('');

// Pending message to be sent after navigation to chat view
export const pendingMessage = signal<string | null>(null);

// Signal to trigger processing of pending message (incremented to trigger effect)
// This decouples message sending from ChatView's mount lifecycle
export const submitPendingTrigger = signal<number>(0);

// Signal to trigger input focus (incremented to trigger effect)
export const focusInputTrigger = signal<number>(0);

// User context items (highlighted text, files, etc.) to include with next message
export const userContext = signal<UserContextItem[]>([]);

// Pending user context to be sent after navigation to chat view
export const pendingUserContext = signal<UserContextItem[]>([]);

// ============================================================================
// Image Upload State
// ============================================================================

export type ImageUploadStatus = 'uploading' | 'ready' | 'error';

export interface PendingImage {
  id: string;
  file: File;
  preview: string;
  status: ImageUploadStatus;
  url?: string;
  error?: string;
}

// Pending images for the current message
export const pendingImages = signal<PendingImage[]>([]);

// Whether any images are currently uploading
export const isUploadingImages = computed(() =>
  pendingImages.value.some((img) => img.status === 'uploading')
);

// Get ready images for sending
export const getReadyImages = (): ChatImage[] => {
  return pendingImages.value
    .filter((img) => img.status === 'ready' && img.url)
    .map((img) => ({
      url: img.url!,
      detail: 'low' as const,
    }));
};

// Add a pending image
export const addPendingImage = (image: PendingImage) => {
  if (pendingImages.value.length >= 4) return; // Max 4 images
  pendingImages.value = [...pendingImages.value, image];
};

// Update image upload status
export const updateImageStatus = (
  id: string,
  status: ImageUploadStatus,
  url?: string,
  error?: string
) => {
  pendingImages.value = pendingImages.value.map((img) =>
    img.id === id ? { ...img, status, url, error } : img
  );
};

// Remove a pending image
export const removePendingImage = (id: string) => {
  const img = pendingImages.value.find((i) => i.id === id);
  if (img) {
    URL.revokeObjectURL(img.preview);
  }
  pendingImages.value = pendingImages.value.filter((i) => i.id !== id);
};

// Clear all pending images
export const clearPendingImages = () => {
  pendingImages.value.forEach((img) => URL.revokeObjectURL(img.preview));
  pendingImages.value = [];
};

// ============================================================================
// AG-UI State Signals
// ============================================================================

import type {
  AGUIState,
  StreamingMessage,
  ToolCallState,
  StateDeltaData,
} from '../api/ag-ui-handler';
import type { ExecutionPlan } from '../core/plan';

// Re-export types for convenience
export type { AGUIState, StreamingMessage, ToolCallState, StateDeltaData };

/** Current AG-UI run state */
export const aguiState = signal<AGUIState | null>(null);

/** Current step name (e.g., "reasoning", "tool_execution") */
export const currentStep = computed(() => aguiState.value?.currentStep ?? null);

/** Whether a run is in progress (not complete) */
export const isRunning = computed(
  () => aguiState.value !== null && !aguiState.value.isComplete
);

/** Streaming messages from current run */
export const streamingMessages = computed(
  () => aguiState.value?.messages ?? new Map<string, StreamingMessage>()
);

/** Active tool calls */
export const activeToolCalls = computed(
  () => aguiState.value?.toolCalls ?? new Map<string, ToolCallState>()
);

/** All state deltas received */
export const stateDeltas = computed(
  () => aguiState.value?.stateDeltas ?? []
);

/** Extract sources from STATE_DELTA events */
export const aguiSources = computed((): ArticleSummary[] => {
  const deltas = aguiState.value?.stateDeltas ?? [];
  const sourceDelta = deltas.find((d) => d.type === 'sources');
  if (sourceDelta && sourceDelta.data && typeof sourceDelta.data === 'object') {
    const data = sourceDelta.data as Record<string, unknown>;
    return (data.sources as ArticleSummary[]) ?? [];
  }
  return [];
});

/** Extract actions from STATE_DELTA events */
export const aguiActions = computed((): TaskButtonData[] => {
  const deltas = aguiState.value?.stateDeltas ?? [];
  const actionDelta = deltas.find((d) => d.type === 'actions');
  if (actionDelta && actionDelta.data && typeof actionDelta.data === 'object') {
    const data = actionDelta.data as Record<string, unknown>;
    return (data.actions as TaskButtonData[]) ?? [];
  }
  return [];
});

/** Extract plan from STATE_DELTA events */
export const aguiPlan = computed((): ExecutionPlan | null => {
  const deltas = aguiState.value?.stateDeltas ?? [];
  const planDelta = deltas.find((d) => d.type === 'plan');
  if (planDelta && planDelta.data && typeof planDelta.data === 'object') {
    const data = planDelta.data as Record<string, unknown>;
    return (data.plan as ExecutionPlan) ?? null;
  }
  return null;
});

// ============================================================================
// AG-UI State Actions
// ============================================================================

/**
 * Update AG-UI state from handler.
 * Called by the AG-UI event handler on every state change.
 */
export const updateAGUIState = (newState: AGUIState) => {
  aguiState.value = newState;
};

/**
 * Clear AG-UI state when starting new conversation.
 */
export const clearAGUIState = () => {
  aguiState.value = null;
};

/**
 * Finalize current run and convert to stored messages.
 * Called when RUN_FINISHED is received.
 */
export const finalizeRun = () => {
  const state = aguiState.value;
  if (!state) return;

  // Find the final assistant message (non-thinking/non-reasoning)
  const assistantMessages = Array.from(state.messages.values()).filter(
    (m) => m.role === 'assistant' && m.stepName !== 'reasoning'
  );

  const finalMessage = assistantMessages[assistantMessages.length - 1];

  if (finalMessage) {
    // Extract thinking messages for collapsible display
    const thinkingMessages = Array.from(state.messages.values()).filter(
      (m) => m.stepName === 'reasoning'
    );

    // Convert thinking to progress events (for history storage)
    const thinkingEvents: ProgressEvent[] = thinkingMessages.map((m) => ({
      progress_id: m.id,
      markdown: m.content
        ? `\`\`\`collapsible:Thinking\n${m.content}\n\`\`\``
        : '',
      is_step_complete: true,
    }));

    // Get sources and actions from state deltas
    const sources = aguiSources.value;
    const actions = aguiActions.value;

    // Update last assistant message with final content
    const msgs = messages.value;
    if (msgs.length > 0 && msgs[msgs.length - 1].role === 'assistant') {
      messages.value = [
        ...msgs.slice(0, -1),
        {
          ...msgs[msgs.length - 1],
          content: finalMessage.content,
          progressEvents: thinkingEvents.filter((e) => e.markdown),
          sources: sources.length > 0 ? sources : msgs[msgs.length - 1].sources,
          actions: actions.length > 0 ? actions : msgs[msgs.length - 1].actions,
        },
      ];
    }
  }

  // Clear AG-UI state
  clearAGUIState();
};

// ============================================================================

// Computed: has messages
export const hasMessages = computed(() => messages.value.length > 0);

// Actions
export const addUserMessage = (
  content: string,
  userContext?: UserContextItem[],
  images?: ChatImage[]
) => {
  messages.value = [...messages.value, { 
    role: 'user', 
    content,
    userContext: userContext && userContext.length > 0 ? userContext : undefined,
    images: images && images.length > 0 ? images : undefined
  }];
};

export const addAssistantMessage = (content: string, messageId?: string) => {
  messages.value = [
    ...messages.value,
    {
      role: 'assistant',
      content,
      id: messageId,
      progressEvents: [], // Initialize empty array for progress events
    },
  ];
};

export const updateLastAssistantMessage = (
  content: string | undefined,
  messageId?: string,
  actions?: TaskButtonData[],
  sources?: ArticleSummary[]
) => {
  const msgs = messages.value;
  if (msgs.length > 0 && msgs[msgs.length - 1].role === 'assistant') {
    const existingMsg = msgs[msgs.length - 1];
    messages.value = [
      ...msgs.slice(0, -1),
      {
        role: 'assistant',
        // If content is undefined, preserve existing content (for plan scenarios)
        content: content !== undefined ? content : existingMsg.content,
        id: messageId ?? existingMsg.id,
        actions: actions ?? existingMsg.actions,
        sources: sources ?? existingMsg.sources,
        actionStatus: existingMsg.actionStatus, // Preserve action status
        progressEvents: existingMsg.progressEvents, // Preserve progress events
      },
    ];
  }
};

// Set action status to pending when auto-run action starts
export const setActionPending = (messageIndex: number, actionName: string) => {
  const msgs = messages.value;
  if (messageIndex >= 0 && messageIndex < msgs.length) {
    const msg = msgs[messageIndex];
    const newStatus: Record<string, ActionStatus> = {
      ...(msg.actionStatus || {}),
      [actionName]: { status: 'pending' },
    };
    messages.value = [
      ...msgs.slice(0, messageIndex),
      { ...msg, actionStatus: newStatus },
      ...msgs.slice(messageIndex + 1),
    ];
  }
};

// Update action status on completion (finds most recent message with this action)
export const setActionComplete = (
  actionName: string,
  success: boolean,
  errorMessage?: string
) => {
  const msgs = messages.value;
  // Find the most recent message that has this action pending
  for (let i = msgs.length - 1; i >= 0; i--) {
    const msg = msgs[i];
    if (msg.actionStatus?.[actionName]) {
      const newStatus: Record<string, ActionStatus> = {
        ...msg.actionStatus,
        [actionName]: {
          status: success ? 'success' : 'failed',
          completedAt: Date.now(),
          errorMessage: errorMessage,
        },
      };
      messages.value = [
        ...msgs.slice(0, i),
        { ...msg, actionStatus: newStatus },
        ...msgs.slice(i + 1),
      ];
      return;
    }
  }
};

// Update message content by index
export const updateMessageContent = (messageIndex: number, content: string) => {
  const msgs = messages.value;
  if (messageIndex >= 0 && messageIndex < msgs.length) {
    const msg = msgs[messageIndex];
    messages.value = [
      ...msgs.slice(0, messageIndex),
      { ...msg, content },
      ...msgs.slice(messageIndex + 1),
    ];
  }
};

// Update content of the most recent message with a pending action
export const updateActionMessageContent = (actionName: string, content: string) => {
  const msgs = messages.value;
  for (let i = msgs.length - 1; i >= 0; i--) {
    const msg = msgs[i];
    if (msg.actionStatus?.[actionName]) {
      messages.value = [
        ...msgs.slice(0, i),
        { ...msg, content },
        ...msgs.slice(i + 1),
      ];
      return;
    }
  }
};

export const setConversationId = (id: string) => {
  conversationId.value = id;
};

export const clearConversationId = () => {
  conversationId.value = null;
};

export const setMessageFeedback = (messageId: string, feedback: 'up' | 'down') => {
  messages.value = messages.value.map((msg) =>
    msg.id === messageId ? { ...msg, feedback } : msg
  );
};

export const setSources = (sources: ArticleSummary[]) => {
  currentSources.value = sources;
};

export const setActions = (actions: TaskButtonData[]) => {
  currentActions.value = actions;
};

export const clearActions = () => {
  currentActions.value = [];
};

export const setLoading = (loading: boolean) => {
  isLoading.value = loading;
};

export const setProgressStatus = (status: ProgressStatus) => {
  progressStatus.value = status;
};

export const clearProgressStatus = () => {
  progressStatus.value = {};
};

export const addProgressEvent = (event: ProgressEvent) => {
  // Update global (deprecated, for progressStatus backwards compat)
  progressEvents.value = [...progressEvents.value, event];
  // Also update per-message storage (new approach)
  addProgressEventToLastMessage(event);
};

export const clearProgressEvents = () => {
  progressEvents.value = [];
};

export const expandChat = () => {
  isExpanded.value = true;
};

export const collapseChat = () => {
  isExpanded.value = false;
};

export const setPrefillText = (text: string) => {
  prefillText.value = text;
};

export const clearPrefillText = () => {
  prefillText.value = '';
};

export const setPendingMessage = (message: string) => {
  pendingMessage.value = message;
};

export const clearPendingMessage = () => {
  pendingMessage.value = null;
};

// Trigger ChatView to process any pending message
// This works whether ChatView is already mounted or will mount soon
export const triggerSubmitPending = () => {
  submitPendingTrigger.value += 1;
};

export const triggerInputFocus = () => {
  focusInputTrigger.value += 1;
};

// User context actions
export const addUserContext = (item: Omit<UserContextItem, 'id'>) => {
  const newItem = { ...item, id: generateContextId() } as UserContextItem;
  userContext.value = [...userContext.value, newItem];
};

export const removeUserContext = (id: string) => {
  userContext.value = userContext.value.filter((item) => item.id !== id);
};

export const clearUserContext = () => {
  userContext.value = [];
};

export const setPendingUserContext = (items: UserContextItem[]) => {
  pendingUserContext.value = items;
};

export const clearPendingUserContext = () => {
  pendingUserContext.value = [];
};

export const resetChat = () => {
  messages.value = [];
  conversationId.value = null;
  isLoading.value = false;
  progressStatus.value = {};
  progressEvents.value = [];
  isExpanded.value = false;
  currentSources.value = [];
  currentActions.value = [];
  prefillText.value = '';
  pendingMessage.value = null;
  submitPendingTrigger.value = 0;
  userContext.value = [];
  pendingUserContext.value = [];
  clearPendingImages();
  // Clear AG-UI state
  clearAGUIState();
  // Clear any active plan when starting a new chat
  clearPlan(true);
};

