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
}

// Chat messages history
export const messages = signal<StoredChatMessage[]>([]);

// Current conversation ID (server-assigned, persists across messages in a conversation)
export const conversationId = signal<string | null>(null);

// Whether chat is currently loading a response
export const isLoading = signal(false);

// Current progress status during loading (e.g., "Searching...", "Generating answer...")
export interface ProgressStatus {
  kind: 'search' | 'search_complete' | 'generating' | 'thinking' | null;
  message?: string;
}

export const progressStatus = signal<ProgressStatus>({ kind: null });

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
  messages.value = [...messages.value, { role: 'assistant', content, id: messageId }];
};

export const updateLastAssistantMessage = (
  content: string,
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
        content,
        id: messageId ?? existingMsg.id,
        actions: actions ?? existingMsg.actions,
        sources: sources ?? existingMsg.sources,
        actionStatus: existingMsg.actionStatus, // Preserve action status
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
  progressStatus.value = { kind: null };
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
  progressStatus.value = { kind: null };
  isExpanded.value = false;
  currentSources.value = [];
  currentActions.value = [];
  prefillText.value = '';
  pendingMessage.value = null;
  userContext.value = [];
  pendingUserContext.value = [];
  clearPendingImages();
};

