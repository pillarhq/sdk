/**
 * Chat Store
 * Signal-based state for chat messages and interaction
 */

import { computed, signal } from "@preact/signals";
import type { ArticleSummary, ChatMessage } from "../api/client";
import type { ChatImage } from "../api/mcp-client";
import type { TaskButtonData } from "../components/Panel/TaskButton";
import type { UserContextItem } from "../types/user-context";
import { generateContextId } from "../types/user-context";

// Re-export ChatImage for convenience
export type { ChatImage } from "../api/mcp-client";

// Action completion status for tracking auto-run action results
export interface ActionStatus {
  status: "pending" | "success" | "failed";
  completedAt?: number;
  errorMessage?: string;
}

// Extended chat message with server-assigned ID for feedback
export interface StoredChatMessage extends ChatMessage {
  id?: string; // Server-assigned message ID (for assistant messages)
  feedback?: "up" | "down" | null; // User feedback on this message
  actions?: TaskButtonData[]; // Actions associated with this message
  sources?: ArticleSummary[]; // Sources associated with this message
  actionStatus?: Record<string, ActionStatus>; // Track action completion status per action
  userContext?: UserContextItem[]; // User context items sent with this message
  images?: ChatImage[]; // Images attached to user messages
  progressEvents?: ProgressEvent[]; // Thinking steps stored per-message for history
}

// Chat messages history
export const messages = signal<StoredChatMessage[]>([]);

// Current conversation ID (client-generated, persists across messages in a conversation)
export const conversationId = signal<string | null>(null);

// Registered actions for dynamic action tools (persisted across conversation turns)
// These are actions discovered via search that can be called directly by the LLM
export const registeredActions = signal<Record<string, unknown>[]>([]);

// Incremented when conversation history should be invalidated (e.g., new conversation created)
export const historyInvalidationCounter = signal<number>(0);

// Whether chat is currently loading a response
export const isLoading = signal(false);

// Whether chat is loading a conversation from history
export const isLoadingHistory = signal(false);

// Session resumption - tracks if there's an interrupted session to resume
export interface InterruptedSession {
  conversationId: string;
  userMessage: string;
  partialResponse: string;
  summary: string;
  elapsedMs: number;
}

export const interruptedSession = signal<InterruptedSession | null>(null);

// Current progress status during loading (e.g., "Searching...", "Generating answer...")
export interface ProgressStatus {
  kind: string | null; // Event type identifier (server-defined)
  message?: string;
}

export const progressStatus = signal<ProgressStatus>({ kind: null });

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
 * @deprecated Use `message.progressEvents` instead. Will be removed in v2.0.
 *
 * This global signal is kept for backwards compatibility with progressStatus.
 */
export const progressEvents = signal<ProgressEvent[]>([]);

/**
 * Add a progress event to the last assistant message.
 * Events are stored directly on the message as they arrive.
 *
 * If the event has an id (or legacy progress_id) that matches an existing event,
 * the existing event is updated:
 * - Text is appended (delta mode for streaming)
 * - Status transitions are handled (active → done/error)
 * - Other fields are merged
 *
 * This prevents multiple rows from appearing for the same event.
 */
export const addProgressEventToLastMessage = (event: ProgressEvent) => {
  const msgs = messages.value;
  if (msgs.length > 0 && msgs[msgs.length - 1].role === "assistant") {
    const lastMsg = msgs[msgs.length - 1];
    const existingEvents = lastMsg.progressEvents || [];

    let updatedEvents: ProgressEvent[];

    // Use id field with fallback to legacy progress_id
    const eventId = event.id || event.progress_id;

    // Check if we should update an existing event by id
    if (eventId) {
      const existingIndex = existingEvents.findIndex(
        (e) => (e.id || e.progress_id) === eventId
      );

      if (existingIndex >= 0) {
        // Update existing event
        const existing = existingEvents[existingIndex];
        const updatedEvent: ProgressEvent = {
          ...existing,
          ...event,
          // Preserve the id (use new if provided, otherwise keep existing)
          id: event.id || existing.id,
          progress_id: event.progress_id || existing.progress_id,
          // Append text for streaming events (delta mode)
          // Text is appended when both existing and new have text
          text:
            existing.text && event.text
              ? existing.text + event.text
              : (event.text ?? existing.text),
          // Merge children arrays if both exist
          children: event.children || existing.children,
          // Merge metadata
          metadata: { ...existing.metadata, ...event.metadata },
        };
        updatedEvents = [
          ...existingEvents.slice(0, existingIndex),
          updatedEvent,
          ...existingEvents.slice(existingIndex + 1),
        ];
      } else {
        // New event with id
        updatedEvents = [...existingEvents, event];
      }
    } else {
      // No id - just append
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

/**
 * @deprecated Sources are now stored per-message on `StoredChatMessage.sources`. Will be removed in v2.0.
 *
 * Kept for backwards compatibility with resetChat().
 */
export const currentSources = signal<ArticleSummary[]>([]);

/**
 * @deprecated Actions are now stored per-message on `StoredChatMessage.actions`. Will be removed in v2.0.
 *
 * Kept for backwards compatibility with resetChat().
 */
export const currentActions = signal<TaskButtonData[]>([]);

// Pre-filled text for chat input (from text selection)
export const prefillText = signal<string>("");

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

export type ImageUploadStatus = "uploading" | "ready" | "error";

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
  pendingImages.value.some((img) => img.status === "uploading")
);

// Get ready images for sending
export const getReadyImages = (): ChatImage[] => {
  return pendingImages.value
    .filter((img) => img.status === "ready" && img.url)
    .map((img) => ({
      url: img.url!,
      detail: "low" as const,
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

// Computed: has messages
export const hasMessages = computed(() => messages.value.length > 0);

// Actions
export const addUserMessage = (
  content: string,
  userContext?: UserContextItem[],
  images?: ChatImage[]
) => {
  messages.value = [
    ...messages.value,
    {
      role: "user",
      content,
      userContext:
        userContext && userContext.length > 0 ? userContext : undefined,
      images: images && images.length > 0 ? images : undefined,
    },
  ];
};

export const addAssistantMessage = (content: string, messageId?: string) => {
  messages.value = [
    ...messages.value,
    {
      role: "assistant",
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
  if (msgs.length > 0 && msgs[msgs.length - 1].role === "assistant") {
    const existingMsg = msgs[msgs.length - 1];
    messages.value = [
      ...msgs.slice(0, -1),
      {
        role: "assistant",
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
      [actionName]: { status: "pending" },
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
          status: success ? "success" : "failed",
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
export const updateActionMessageContent = (
  actionName: string,
  content: string
) => {
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

/**
 * @deprecated Use `setConversationId` instead. Will be removed in v2.0.
 */
export const setThreadId = setConversationId;

export const clearConversationId = () => {
  conversationId.value = null;
};

/**
 * Set registered actions from backend response.
 * These are actions discovered via search that can be called directly by the LLM.
 */
export const setRegisteredActions = (actions: Record<string, unknown>[]) => {
  registeredActions.value = actions;
};

/**
 * Get registered actions for sending with the next message.
 */
export const getRegisteredActions = (): Record<string, unknown>[] => {
  return registeredActions.value;
};

/**
 * Clear registered actions (e.g., when starting a new conversation).
 */
export const clearRegisteredActions = () => {
  registeredActions.value = [];
};

export const setMessageFeedback = (
  messageId: string,
  feedback: "up" | "down"
) => {
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
  progressStatus.value = { kind: null };
};

export const addProgressEvent = (event: ProgressEvent) => {
  // Update global (deprecated, for progressStatus backwards compat)
  // Use same deduplication logic as per-message storage
  // Use id field with fallback to legacy progress_id (matching addProgressEventToLastMessage)
  const eventId = event.id || event.progress_id;
  if (eventId) {
    const existingIndex = progressEvents.value.findIndex(
      (e) => (e.id || e.progress_id) === eventId
    );
    if (existingIndex >= 0) {
      const existing = progressEvents.value[existingIndex];
      const updatedEvent: ProgressEvent = {
        ...existing,
        ...event,
        // Preserve the id (use new if provided, otherwise keep existing)
        id: event.id || existing.id,
        progress_id: event.progress_id || existing.progress_id,
        text:
          event.kind === "thinking" && existing.text && event.text
            ? existing.text + event.text
            : (event.text ?? existing.text),
      };
      progressEvents.value = [
        ...progressEvents.value.slice(0, existingIndex),
        updatedEvent,
        ...progressEvents.value.slice(existingIndex + 1),
      ];
    } else {
      progressEvents.value = [...progressEvents.value, event];
    }
  } else {
    progressEvents.value = [...progressEvents.value, event];
  }
  // Also update per-message storage (new approach)
  addProgressEventToLastMessage(event);
};

export const clearProgressEvents = () => {
  progressEvents.value = [];
};

// Session resumption functions
export const setInterruptedSession = (session: InterruptedSession | null) => {
  interruptedSession.value = session;
};

export const clearInterruptedSession = () => {
  interruptedSession.value = null;
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
  prefillText.value = "";
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
// Use a generic type parameter to preserve the specific type of context being added
export const addUserContext = <T extends Omit<UserContextItem, "id">>(
  item: T
) => {
  const newItem = { ...item, id: generateContextId() } as T & { id: string };
  userContext.value = [...userContext.value, newItem as UserContextItem];
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
  registeredActions.value = []; // Clear registered actions for new conversation
  isLoading.value = false;
  progressStatus.value = { kind: null };
  progressEvents.value = [];
  isExpanded.value = false;
  currentSources.value = [];
  currentActions.value = [];
  prefillText.value = "";
  pendingMessage.value = null;
  submitPendingTrigger.value = 0;
  userContext.value = [];
  pendingUserContext.value = [];
  clearPendingImages();
};

/**
 * Start loading a conversation from history.
 * Shows loading state immediately for better UX.
 */
export const startLoadingHistory = () => {
  // Reset to a clean state
  resetChat();
  // Set loading state
  isLoadingHistory.value = true;
};

/**
 * Load a conversation from history.
 * Populates the chat with messages from a previous conversation.
 */
export const loadConversation = (
  id: string,
  historyMessages: Array<{
    role: "user" | "assistant";
    content: string;
    id?: string;
  }>
) => {
  // Set the conversation ID
  conversationId.value = id;

  // Load messages (map to StoredChatMessage format)
  messages.value = historyMessages.map((msg) => ({
    role: msg.role,
    content: msg.content,
    id: msg.id,
  }));

  // Expand chat to show messages
  isExpanded.value = true;

  // Clear loading state
  isLoadingHistory.value = false;

  // Increment history invalidation counter
  historyInvalidationCounter.value += 1;
};

/**
 * Stop loading history (on error or cancellation).
 */
export const stopLoadingHistory = () => {
  isLoadingHistory.value = false;
};
