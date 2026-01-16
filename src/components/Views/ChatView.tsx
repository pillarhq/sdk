/**
 * Chat View Component
 * Standalone full-screen chat view (used when starting chat from home/categories)
 */

import { useCallback, useEffect, useRef } from 'preact/hooks';
import type { ArticleSummary } from '../../api/client';
import Pillar from '../../core/Pillar';
import type { ExecutionPlan } from '../../core/plan';
import {
  addAssistantMessage,
  addUserMessage,
  clearPendingMessage,
  clearPendingUserContext,
  clearProgressStatus,
  conversationId,
  isLoading,
  messages,
  pendingMessage,
  pendingUserContext,
  progressStatus,
  setActionComplete,
  setActionPending,
  setConversationId,
  setLoading,
  setMessageFeedback,
  setProgressStatus,
  updateActionMessageContent,
  updateLastAssistantMessage,
  type ChatImage,
} from '../../store/chat';
import { hasActivePlan } from '../../store/plan';
import { goHome } from '../../store/router';
import type { UserContextItem } from '../../types/user-context';
import { renderMarkdown } from '../../utils/markdown';
import type { ProgressEvent } from '../../api/client';
import { createConfirmActionCard } from '../Cards/ConfirmActionCard';
import { useAPI } from '../context';
import { ContextTagList } from '../Panel/ContextTag';
import { createTaskButtonGroup, type TaskButtonData } from '../Panel/TaskButton';
import { UnifiedChatInput } from '../Panel/UnifiedChatInput';
import { PlanView } from '../Plan/PlanView';

const NEW_CHAT_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;

const THUMBS_UP_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>`;

const THUMBS_DOWN_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/></svg>`;

// Action status icons
const CHECK_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
const X_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
const SPINNER_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" opacity="0.3"/><path d="M12 2v4"/></svg>`;

/**
 * Generate completion text from action name and success status
 */
function getCompletionText(actionName: string, success: boolean): string {
  const name = actionName.replace(/_/g, ' ').toLowerCase();
  
  if (!success) {
    return `Failed to ${name}`;
  }
  
  // Transform "open_settings" -> "Opened settings"
  if (name.startsWith('open ')) {
    return `Opened ${name.slice(5)}`;
  }
  if (name.startsWith('go to ')) {
    return `Navigated to ${name.slice(6)}`;
  }
  if (name.startsWith('navigate to ')) {
    return `Navigated to ${name.slice(12)}`;
  }
  // Fallback
  return 'Done!';
}

export function ChatView() {
  const api = useAPI();
  const messagesRef = useRef<HTMLDivElement>(null);
  const hasProcessedPending = useRef(false);

  // Process pending message on mount
  useEffect(() => {
    if (hasProcessedPending.current) return;

    const pending = pendingMessage.value;
    const pendingContext = pendingUserContext.value;
    if (pending) {
      hasProcessedPending.current = true;
      clearPendingMessage();
      clearPendingUserContext();
      sendMessage(pending, pendingContext.length > 0 ? pendingContext : undefined);
    }
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [messages.value]);

  // Listen for task completion events to update action status
  useEffect(() => {
    const pillar = Pillar.getInstance();
    if (!pillar) return;
    
    const unsubscribe = pillar.on('task:complete', ({ name, success }) => {
      // Update action status
      setActionComplete(name, success);
      
      // Update message content with completion text
      const completionText = getCompletionText(name, success);
      updateActionMessageContent(name, completionText);
    });
    
    return unsubscribe;
  }, []);

  /**
   * Handle plan received from AI streaming response.
   * Passes the plan to PlanExecutor for orchestration.
   */
  const handlePlanReceived = useCallback((plan: ExecutionPlan) => {
    console.log('[Pillar] Plan received:', plan.id, plan.goal);
    const pillar = Pillar.getInstance();
    if (pillar) {
      pillar.handlePlanReceived(plan);
    }
  }, []);

  /**
   * Handle actions received from the AI.
   * Auto-executes actions with autoRun=true, returns buttons for the rest.
   * 
   * UX Design:
   * - If there's an auto-run action, execute it and DON'T show alternative buttons
   *   (user asked for something specific, we're handling it)
   * - If no auto-run actions, return all as clickable buttons
   * 
   * @returns The actions to be stored with the message (manual actions only, or all if no Pillar instance)
   */
  const handleActionsReceived = useCallback((actions: TaskButtonData[]): TaskButtonData[] => {
    const pillar = Pillar.getInstance();
    
    console.log('[Pillar] handleActionsReceived called with', actions.length, 'actions');
    console.log('[Pillar] Actions detail:', actions.map(a => ({ name: a.name, autoRun: a.autoRun })));
    
    // Separate auto-run actions from manual actions
    const autoRunActions = actions.filter(a => a.autoRun === true);
    const manualActions = actions.filter(a => !a.autoRun);
    
    console.log('[Pillar] Auto-run actions:', autoRunActions.length, ', Manual actions:', manualActions.length);
    
    // Execute auto-run actions immediately
    if (pillar && autoRunActions.length > 0) {
      console.log('[Pillar] Executing auto-run actions...');
      autoRunActions.forEach(action => {
        const data = action.data || {};
        const path = (data.path as string | undefined);
        const externalUrl = (data.url as string | undefined);
        
        // Mark action as pending before execution
        const messageIndex = messages.value.length - 1;
        if (messageIndex >= 0) {
          setActionPending(messageIndex, action.name);
        }
        
        console.log('[Pillar] Executing action:', action.name);
        pillar.executeTask({
          id: action.id,
          name: action.name,
          taskType: action.taskType,
          data: data,
          path: path,
          externalUrl: externalUrl,
        });
      });
      
      // When auto-running, don't show alternative buttons - we're already handling the request
      // This prevents confusing UX where buttons appear briefly before navigation
      return [];
    } else if (!pillar) {
      console.warn('[Pillar] No Pillar instance available for auto-run');
      // Return all as buttons since we can't execute
      return actions;
    } else {
      // No auto-run actions - return all as clickable buttons
      return manualActions;
    }
  }, []);

  const sendMessage = useCallback(async (message: string, userContext?: UserContextItem[], images?: ChatImage[]) => {
    // Add user message with context and images
    addUserMessage(message, userContext, images);

    // Show loading state
    setLoading(true);

    // Add placeholder assistant message
    addAssistantMessage('');

    try {
      let fullResponse = '';
      let receivedActions: TaskButtonData[] = [];
      const history = messages.value.slice(0, -1); // Exclude the empty assistant message

      // No article context in standalone chat view
      const response = await api.chat(
        message,
        history,
        // Streaming callback
        (chunk) => {
          fullResponse += chunk;
          updateLastAssistantMessage(fullResponse);
        },
        undefined, // No article slug
        conversationId.value, // Pass existing conversation ID if available
        // Actions callback - handle auto-run actions
        (actions) => {
          receivedActions = handleActionsReceived(actions);
        },
        // Plan callback - handle multi-step plans
        handlePlanReceived,
        // User context (highlighted text, etc.)
        userContext,
        // Images
        images,
        // Progress callback - show what AI is doing
        (progress: ProgressEvent) => {
          setProgressStatus({
            kind: progress.kind,
            message: progress.message,
          });
        }
      );

      // Collect final actions (from streaming callback or response)
      let finalActions = receivedActions;
      if (response.actions && response.actions.length > 0) {
        finalActions = handleActionsReceived(response.actions);
      }

      // Update with final response, message ID, actions, and sources
      updateLastAssistantMessage(
        response.message,
        response.messageId,
        finalActions,
        response.sources
      );
      
      // Store conversation ID for subsequent messages
      if (response.conversationId) {
        setConversationId(response.conversationId);
      }
    } catch (error) {
      console.error('[Pillar] Chat error:', error);
      updateLastAssistantMessage('Sorry, I encountered an error. Please try again.');
    } finally {
      setLoading(false);
      clearProgressStatus();
    }
  }, [api, handleActionsReceived]);

  // Handle feedback submission
  const handleFeedback = useCallback(async (messageId: string, feedback: 'up' | 'down') => {
    // Update local state immediately for responsive UI
    setMessageFeedback(messageId, feedback);
    
    // Submit feedback to server (fire-and-forget)
    await api.submitFeedback(messageId, feedback);
  }, [api]);

  // Handle submit from UnifiedChatInput
  const handleInputSubmit = useCallback((message: string, context: UserContextItem[], images: ChatImage[]) => {
    if (isLoading.value) return;
    
    // Context and images are passed directly from UnifiedChatInput (already cleared there)
    sendMessage(
      message,
      context.length > 0 ? context : undefined,
      images.length > 0 ? images : undefined
    );
  }, [sendMessage]);

  // Sources are displayed but not clickable (article views have been removed)
  // TODO: Consider linking sources to external URLs if available

  // Create refs map for action containers per message
  const actionContainerRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // Effect to render action buttons and confirm cards when messages change
  useEffect(() => {
    const pillar = Pillar.getInstance();
    
    messages.value.forEach((msg, index) => {
      if (msg.role === 'assistant' && msg.actions && msg.actions.length > 0) {
        const container = actionContainerRefs.current.get(index);
        if (container && container.children.length === 0) {
          // Separate inline_ui cards from regular buttons
          const confirmActions = msg.actions.filter(a => a.taskType === 'inline_ui');
          const buttonActions = msg.actions.filter(a => a.taskType !== 'inline_ui');
          
          // Render confirm action cards first
          confirmActions.forEach((action) => {
            const card = createConfirmActionCard(
              action,
              // onConfirm callback
              (data) => {
                if (pillar) {
                  // Emit task execution event
                  pillar.executeTask({
                    id: action.id,
                    name: action.name,
                    taskType: action.taskType,
                    data: data || action.data || {},
                  });
                }
              },
              // onCancel callback
              () => {
                console.log('[Pillar] Confirm action cancelled:', action.name);
              }
            );
            container.appendChild(card);
          });
          
          // Then render regular buttons
          if (buttonActions.length > 0) {
            const buttonGroup = createTaskButtonGroup(buttonActions);
            container.appendChild(buttonGroup);
          }
        }
      }
    });
  }, [messages.value]);

  return (
    <div class="_pillar-chat-view pillar-chat-view">
      {/* Messages area - takes full height */}
      <div class="_pillar-chat-view-messages pillar-chat-view-messages" ref={messagesRef}>
        {messages.value.length === 0 && (
          <div class="_pillar-chat-view-welcome pillar-chat-view-welcome">
            <div class="_pillar-chat-view-welcome-icon pillar-chat-view-welcome-icon">💬</div>
            <div class="_pillar-chat-view-welcome-title pillar-chat-view-welcome-title">Ask a question</div>
            <div class="_pillar-chat-view-welcome-text pillar-chat-view-welcome-text">
              Ask me anything about how to use this product.
            </div>
          </div>
        )}

        {messages.value.map((msg, index) => (
          <div
            key={index}
            class={`_pillar-chat-view-message pillar-chat-view-message _pillar-chat-view-message--${msg.role} pillar-chat-view-message--${msg.role}`}
          >
            {msg.role === 'user' ? (
              <div class="_pillar-message-user pillar-message-user">
                {msg.userContext && msg.userContext.length > 0 && (
                  <ContextTagList contexts={msg.userContext} readOnly />
                )}
                {/* Display attached images */}
                {msg.images && msg.images.length > 0 && (
                  <div class="_pillar-message-user-images pillar-message-user-images">
                    {msg.images.map((img, imgIndex) => (
                      <img
                        key={imgIndex}
                        src={img.url}
                        alt={`Attachment ${imgIndex + 1}`}
                        class="_pillar-message-user-image pillar-message-user-image"
                      />
                    ))}
                  </div>
                )}
                {msg.content}
              </div>
            ) : (
              <div class="_pillar-message-assistant-wrapper pillar-message-assistant-wrapper">
                <div class="_pillar-message-assistant-content pillar-message-assistant-content">
                  {msg.content ? (
                    <div
                      class="_pillar-message-assistant pillar-message-assistant"
                      dangerouslySetInnerHTML={{
                        __html: renderMarkdown(msg.content),
                      }}
                    />
                  ) : (
                    <div class="_pillar-progress-indicator pillar-progress-indicator">
                      <div class="_pillar-loading-spinner pillar-loading-spinner" />
                      <span class="_pillar-progress-message pillar-progress-message">
                        {progressStatus.value.message || 'Thinking...'}
                      </span>
                    </div>
                  )}
                  {/* Action status indicator */}
                  {msg.actionStatus && Object.keys(msg.actionStatus).length > 0 && (
                    <span class="_pillar-action-status pillar-action-status">
                      {Object.entries(msg.actionStatus).map(([actionName, status]) => (
                        <span
                          key={actionName}
                          class={`_pillar-action-status-indicator pillar-action-status-indicator _pillar-action-status-indicator--${status.status} pillar-action-status-indicator--${status.status}`}
                          title={status.status === 'failed' ? status.errorMessage : actionName}
                          dangerouslySetInnerHTML={{
                            __html: status.status === 'success' ? CHECK_ICON :
                                   status.status === 'failed' ? X_ICON :
                                   SPINNER_ICON
                          }}
                        />
                      ))}
                    </span>
                  )}
                </div>
                {/* Feedback icons - only show for completed assistant messages with an ID */}
                {msg.id && msg.content && (
                  <div class="_pillar-feedback-icons pillar-feedback-icons">
                    <button
                      class={`_pillar-feedback-btn pillar-feedback-btn ${msg.feedback === 'up' ? '_pillar-feedback-btn--active pillar-feedback-btn--active' : ''}`}
                      onClick={() => handleFeedback(msg.id!, 'up')}
                      aria-label="Helpful"
                      title="Helpful"
                      type="button"
                      dangerouslySetInnerHTML={{ __html: THUMBS_UP_ICON }}
                    />
                    <button
                      class={`_pillar-feedback-btn pillar-feedback-btn ${msg.feedback === 'down' ? '_pillar-feedback-btn--active pillar-feedback-btn--active' : ''}`}
                      onClick={() => handleFeedback(msg.id!, 'down')}
                      aria-label="Not helpful"
                      title="Not helpful"
                      type="button"
                      dangerouslySetInnerHTML={{ __html: THUMBS_DOWN_ICON }}
                    />
                  </div>
                )}

                {/* Sources for this message */}
                {msg.sources && msg.sources.length > 0 && (
                  <div class="_pillar-chat-sources pillar-chat-sources">
                    <div class="_pillar-chat-sources-title pillar-chat-sources-title">Sources</div>
                    {msg.sources.map((source) => (
                      <div
                        key={source.slug}
                        class="_pillar-chat-source pillar-chat-source"
                      >
                        {source.title}
                      </div>
                    ))}
                  </div>
                )}

                {/* Action buttons for this message */}
                {msg.actions && msg.actions.length > 0 && (
                  <div class="_pillar-chat-actions pillar-chat-actions">
                    <div class="_pillar-chat-actions-title pillar-chat-actions-title">Suggested actions</div>
                    <div
                      ref={(el) => {
                        if (el) actionContainerRefs.current.set(index, el);
                      }}
                      class="_pillar-chat-actions-buttons pillar-chat-actions-buttons"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {/* Active execution plan - rendered as a to-do list */}
        {hasActivePlan.value && <PlanView />}
      </div>

      {/* Input area */}
      <div class="_pillar-chat-view-input-area pillar-chat-view-input-area">
        <UnifiedChatInput
          placeholder="Ask a question... (paste or drop images)"
          disabled={isLoading.value}
          onSubmit={handleInputSubmit}
        />
        {/* New chat button - only show when there are messages */}
        {messages.value.length > 0 && (
          <div class="_pillar-chat-view-input-footer pillar-chat-view-input-footer">
            <button
              class="_pillar-chat-view-new-chat-btn pillar-chat-view-new-chat-btn"
              onClick={goHome}
              type="button"
            >
              <span class="_pillar-chat-view-new-chat-icon" dangerouslySetInnerHTML={{ __html: NEW_CHAT_ICON }} />
              New chat
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

