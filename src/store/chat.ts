/**
 * Chat Store
 * Signal-based state for chat messages and interaction
 */

import { computed, signal } from "@preact/signals";
import type { ArticleSummary, ChatMessage, ConversationSummary, HistoryMessage, DisplayStep } from "../api/client";
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

/**
 * A segment in an assistant message's timeline.
 * Segments maintain chronological order so text and tool blocks interleave correctly.
 *
 * - "text": Model-generated content tokens (narration or final response)
 * - "progress": A group of progress events (thinking, search, tool calls)
 */
export type MessageSegment =
  | { type: "text"; content: string }
  | { type: "progress"; events: ProgressEvent[] };

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
  segments?: MessageSegment[]; // Ordered timeline of text blocks and progress blocks
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

// Optimistically-added conversations (appear in history before server confirms)
export const optimisticConversations = signal<ConversationSummary[]>([]);

/** localStorage key for persisting the current conversation ID */
const CONVERSATION_ID_STORAGE_KEY = "pillar:conversation_id";

function persistConversationIdToStorage(id: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (id === null) {
      localStorage.removeItem(CONVERSATION_ID_STORAGE_KEY);
    } else {
      localStorage.setItem(CONVERSATION_ID_STORAGE_KEY, id);
    }
  } catch {
    // Silently fail - localStorage may be unavailable
  }
}

/**
 * Read the persisted conversation ID from localStorage (e.g. for restore on refresh).
 */
export function getStoredConversationId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(CONVERSATION_ID_STORAGE_KEY);
  } catch {
    return null;
  }
}

// Whether chat is currently loading a response
export const isLoading = signal(false);

// Active JSON-RPC request ID for the current streaming request (for cancellation support)
export const activeRequestId = signal<number | null>(null);

export const setActiveRequestId = (id: number | null) => {
  activeRequestId.value = id;
};

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

// Token usage tracking for context gauge (Cursor-style)
export interface TokenUsageState {
  /** Input tokens for the latest iteration */
  promptTokens: number;
  /** Output tokens for the latest iteration */
  completionTokens: number;
  /** Cumulative prompt tokens across all iterations */
  totalPromptTokens: number;
  /** Cumulative completion tokens across all iterations */
  totalCompletionTokens: number;
  /** Current total tokens in context */
  totalUsed: number;
  /** Maximum context window for the model */
  contextWindow: number;
  /** Current context occupancy percentage (0-100) */
  occupancyPct: number;
  /** Name of the model in use */
  modelName: string;
  /** Current iteration number (0-indexed) */
  iteration: number;
}

/** Current token usage for the active streaming response */
export const tokenUsage = signal<TokenUsageState | null>(null);

export const updateTokenUsage = (usage: TokenUsageState) => {
  tokenUsage.value = usage;
};

export const clearTokenUsage = () => {
  tokenUsage.value = null;
};

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
        
        // Calculate duration when a thinking event transitions from active to done/error
        const isThinking = existing.kind === "thinking" || existing.kind === "step_start";
        const wasActive = existing.status === "active";
        const isNowDone = event.status === "done" || event.status === "error";
        const startTime = (existing.metadata as Record<string, unknown>)?._startTime as number | undefined;
        
        const durationMeta = isThinking && wasActive && isNowDone && startTime
          ? { _durationSeconds: Math.round((Date.now() - startTime) / 1000) }
          : {};
        
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
          // Merge metadata (with timing)
          metadata: { ...existing.metadata, ...event.metadata, ...durationMeta },
        };
        updatedEvents = [
          ...existingEvents.slice(0, existingIndex),
          updatedEvent,
          ...existingEvents.slice(existingIndex + 1),
        ];
      } else {
        // New event with id — finalize any active thinking events first,
        // then add the new event. This stops the timer on "Thinking..." rows
        // when a new row (e.g., tool_call) appears below them.
        const now = Date.now();
        const finalizedEvents = existingEvents.map((e) => {
          const isActiveThinking =
            (e.kind === "thinking" || e.kind === "step_start") &&
            e.status === "active";
          if (!isActiveThinking) return e;
          const st = (e.metadata as Record<string, unknown>)?._startTime as
            | number
            | undefined;
          const dur = st
            ? { _durationSeconds: Math.round((now - st) / 1000) }
            : {};
          return {
            ...e,
            status: "done" as const,
            metadata: { ...e.metadata, ...dur },
          };
        });

        // Add start time for thinking events
        const isNewThinking = (event.kind === "thinking" || event.kind === "step_start") && event.status === "active";
        const newEvent = isNewThinking
          ? { ...event, metadata: { ...event.metadata, _startTime: now } }
          : event;
        updatedEvents = [...finalizedEvents, newEvent];
      }
    } else {
      // No id - finalize active thinking events, then append
      const now = Date.now();
      const finalizedEvents = existingEvents.map((e) => {
        const isActiveThinking =
          (e.kind === "thinking" || e.kind === "step_start") &&
          e.status === "active";
        if (!isActiveThinking) return e;
        const st = (e.metadata as Record<string, unknown>)?._startTime as
          | number
          | undefined;
        const dur = st
          ? { _durationSeconds: Math.round((now - st) / 1000) }
          : {};
        return {
          ...e,
          status: "done" as const,
          metadata: { ...e.metadata, ...dur },
        };
      });

      const isNewThinking = (event.kind === "thinking" || event.kind === "step_start") && event.status === "active";
      const newEvent = isNewThinking
        ? { ...event, metadata: { ...event.metadata, _startTime: now } }
        : event;
      updatedEvents = [...finalizedEvents, newEvent];
    }

    // --- Also update segments array for interleaved rendering ---
    const segments = [...(lastMsg.segments || [])];
    const isUpdate = event.id && existingEvents.some((e) => e.id === event.id);

    if (isUpdate) {
      // Find the progress segment containing this event and update it in place
      for (let si = segments.length - 1; si >= 0; si--) {
        const seg = segments[si];
        if (seg.type !== "progress") continue;
        const evtIdx = seg.events.findIndex((e) => e.id === event.id);
        if (evtIdx >= 0) {
          // Find the updated version from updatedEvents (already merged above)
          const merged = updatedEvents.find((e) => e.id === event.id);
          if (merged) {
            const newEvents = [...seg.events];
            newEvents[evtIdx] = merged;
            segments[si] = { type: "progress", events: newEvents };
          }
          break;
        }
      }
    } else {
      // New event — add to last progress segment or create one
      // Find the actual new event from updatedEvents (last entry for no-id, or find by id)
      const newEvt = event.id
        ? updatedEvents.find((e) => e.id === event.id)
        : updatedEvents[updatedEvents.length - 1];
      if (newEvt) {
        const lastSeg = segments[segments.length - 1];
        if (lastSeg && lastSeg.type === "progress") {
          segments[segments.length - 1] = {
            type: "progress",
            events: [...lastSeg.events, newEvt],
          };
        } else {
          segments.push({ type: "progress", events: [newEvt] });
        }
      }
    }

    messages.value = [
      ...msgs.slice(0, -1),
      {
        ...lastMsg,
        progressEvents: updatedEvents,
        segments,
      },
    ];
  }
};

/**
 * Append a content token to the last assistant message's segments array.
 * Creates a new text segment or appends to an existing one, while also
 * updating `content` for backward compat (history persistence, feedback, etc.).
 */
export const appendTokenToSegments = (token: string) => {
  const msgs = messages.value;
  if (msgs.length === 0 || msgs[msgs.length - 1].role !== "assistant") return;
  const lastMsg = msgs[msgs.length - 1];
  const segments = [...(lastMsg.segments || [])];
  const last = segments[segments.length - 1];

  if (last && last.type === "text") {
    // Append to existing text segment
    segments[segments.length - 1] = { type: "text", content: last.content + token };
  } else {
    // Create new text segment (first segment, or after a progress segment)
    segments.push({ type: "text", content: token });
  }

  messages.value = [
    ...msgs.slice(0, -1),
    { ...lastMsg, segments, content: (lastMsg.content || "") + token },
  ];
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
        segments: existingMsg.segments, // Preserve interleaved segments
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
  persistConversationIdToStorage(id);
};

/**
 * @deprecated Use `setConversationId` instead. Will be removed in v2.0.
 */
export const setThreadId = setConversationId;

export const clearConversationId = () => {
  conversationId.value = null;
  persistConversationIdToStorage(null);
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

/**
 * Mark all active progress events on the last assistant message as "done".
 * Called when the user cancels/stops streaming so thinking timers stop.
 */
export const finalizeActiveProgressEvents = () => {
  const msgs = messages.value;
  if (msgs.length === 0) return;
  const lastMsg = msgs[msgs.length - 1];
  if (lastMsg.role !== "assistant" || !lastMsg.progressEvents) return;

  const hasActive = lastMsg.progressEvents.some(
    (e) => e.status === "active"
  );
  if (!hasActive) return;

  const now = Date.now();
  const updatedEvents = lastMsg.progressEvents.map((e) => {
    if (e.status !== "active") return e;
    const startTime = (e.metadata as Record<string, unknown>)?._startTime as
      | number
      | undefined;
    const durationMeta = startTime
      ? { _durationSeconds: Math.round((now - startTime) / 1000) }
      : {};
    return {
      ...e,
      status: "done" as const,
      metadata: { ...e.metadata, ...durationMeta },
    };
  });

  messages.value = [
    ...msgs.slice(0, -1),
    { ...lastMsg, progressEvents: updatedEvents },
  ];
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

/**
 * Remove the last assistant message if it has no content AND no progress events.
 * Used after Stop / AbortError to clean up the empty placeholder
 * that was added before streaming started.
 *
 * If the model was thinking (progress events exist), the message is kept
 * so the user can still see the thinking text that was streamed.
 */
export const removeLastEmptyAssistantMessage = () => {
  const msgs = messages.value;
  if (msgs.length === 0) return;
  const last = msgs[msgs.length - 1];
  const hasProgressEvents = last.progressEvents && last.progressEvents.length > 0;
  if (last.role === "assistant" && !last.content?.trim() && !hasProgressEvents) {
    messages.value = msgs.slice(0, -1);
  }
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
  persistConversationIdToStorage(null);
  registeredActions.value = []; // Clear registered actions for new conversation
  isLoading.value = false;
  progressStatus.value = { kind: null };
  progressEvents.value = [];
  tokenUsage.value = null;
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
 * Map a single DisplayStep to a ProgressEvent.
 * Returns null for steps that should be skipped (token_summary, decisions, narration).
 */
function mapStepToProgressEvent(step: DisplayStep): ProgressEvent | null {
  // Skip non-renderable step types
  if (
    step.step_type === 'token_summary' ||
    step.step_type === 'tool_decision' ||
    step.step_type === 'parallel_tool_decision' ||
    step.step_type === 'narration'
  ) {
    return null;
  }

  if (step.step_type === 'thinking') {
    return {
      kind: 'thinking',
      status: 'done' as const,
      text: step.content || '',
      label: 'Thought',
      metadata: { iteration: step.iteration, timestamp_ms: step.timestamp_ms },
    };
  }

  if (step.step_type === 'tool_result') {
    return {
      kind: (step.kind as string) || 'tool_call',
      status: (step.success === false ? 'error' : 'done') as 'done' | 'error',
      label: step.label || step.tool || 'Result',
      text: step.text as string | undefined,
      children: step.children as ProgressChild[] | undefined,
      metadata: {
        tool_name: step.tool,
        tool: step.tool,
        arguments: step.arguments as Record<string, unknown> | undefined,
        success: step.success,
        iteration: step.iteration,
        timestamp_ms: step.timestamp_ms,
      },
    };
  }

  if (step.step_type === 'step_start') {
    return {
      kind: 'step_start',
      status: 'done' as const,
      label: step.label || 'Step',
      metadata: { iteration: step.iteration, timestamp_ms: step.timestamp_ms },
    };
  }

  // Default case for other step types (generating, etc.)
  return {
    kind: step.step_type,
    status: 'done' as const,
    label: step.label || step.step_type,
    text: step.content,
    metadata: step,
  };
}

/**
 * Build interleaved segments from display trace for history replay.
 * Walks the trace chronologically: narration steps become text segments,
 * all other renderable steps become progress segments.
 * Falls back gracefully for old conversations without narration entries.
 */
function buildSegmentsFromTrace(
  trace: DisplayStep[] | undefined,
): MessageSegment[] | undefined {
  if (!trace || trace.length === 0) return undefined;

  const segments: MessageSegment[] = [];

  for (const step of trace) {
    if (step.step_type === 'narration') {
      // Narration text → text segment
      const text = step.content || '';
      const last = segments[segments.length - 1];
      if (last && last.type === 'text') {
        last.content += text;
      } else {
        segments.push({ type: 'text', content: text });
      }
    } else {
      // Convert to ProgressEvent and add to progress segment
      const evt = mapStepToProgressEvent(step);
      if (!evt) continue;
      const last = segments[segments.length - 1];
      if (last && last.type === 'progress') {
        last.events.push(evt);
      } else {
        segments.push({ type: 'progress', events: [evt] });
      }
    }
  }

  return segments.length > 0 ? segments : undefined;
}

/**
 * Load a conversation from history.
 * Populates the chat with messages from a previous conversation.
 */
export const loadConversation = (
  id: string,
  historyMessages: HistoryMessage[]
) => {
  // Set the conversation ID
  conversationId.value = id;
  persistConversationIdToStorage(id);

  // Load messages — segments are the single rendering path
  messages.value = historyMessages.map((msg) => ({
    role: msg.role,
    content: msg.content,
    id: msg.id,
    segments: msg.role === 'assistant'
      ? buildSegmentsFromTrace(msg.display_trace)
      : undefined,
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

/**
 * Optimistically add a new conversation to the history list.
 * The conversation appears immediately in the dropdown without
 * waiting for the server to confirm via listConversations.
 */
export const addOptimisticConversation = (id: string, title: string) => {
  const now = new Date().toISOString();
  const entry: ConversationSummary = {
    id,
    title,
    startedAt: now,
    lastMessageAt: now,
    messageCount: 1,
  };
  // Prepend so it shows at the top (most recent)
  optimisticConversations.value = [
    entry,
    ...optimisticConversations.value.filter((c) => c.id !== id),
  ];
  // Also invalidate so the next dropdown open merges fresh server data
  historyInvalidationCounter.value += 1;
};

/**
 * Select and load a conversation by ID (fetch from API, navigate to chat, load messages).
 * Use from history dropdown or anywhere else in the SDK that needs to open a past conversation.
 */
export const selectConversationById = async (conversationId: string): Promise<void> => {
  const { getApiClient } = await import("../core/Pillar");
  const { navigate } = await import("./router");
  const { debug } = await import("../utils/debug");

  const apiClient = getApiClient();
  if (!apiClient) return;

  startLoadingHistory();
  navigate("chat");  try {
    const conversation = await apiClient.getConversation(conversationId);
    if (conversation && conversation.messages.length > 0) {
      loadConversation(conversation.id, conversation.messages);
    } else {
      stopLoadingHistory();
    }
  } catch (error) {
    debug.error("[Pillar] Failed to load conversation:", error);
    stopLoadingHistory();
  }
};
