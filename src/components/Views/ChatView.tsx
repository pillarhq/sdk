/**
 * Chat View Component
 * Standalone full-screen chat view (used when starting chat from home/categories)
 */

import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { getPillarInstance } from "../../core/instance";
import {
  activeRequestId,
  addAssistantMessage,
  addOptimisticConversation,
  addProgressEvent,
  addUserMessage,
  chatError,
  clearChatError,
  clearInterruptedSession,
  setInterruptedSession,
  clearPendingImagesForNavigation,
  clearPendingMessage,
  clearPendingUserContext,
  clearProgressStatus,
  conversationId,
  finalizeActiveProgressEvents,
  interruptedSession,
  isLoading,
  isLoadingHistory,
  messages,
  pendingImagesForNavigation,
  pendingMessage,
  pendingUserContext,
  removeLastEmptyAssistantMessage,
  setActionComplete,
  setActionPending,
  setActiveRequestId,
  setChatError,
  setConversationId,
  setLoading,
  setMessageFeedback,
  submitPendingTrigger,
  updateActionMessageContent,
  updateLastAssistantMessage,
  appendTokenToSegments,
  userContext,
  type ChatImage,
  type ProgressEvent as StoreProgressEvent,
} from "../../store/chat";
import {
  resetCancellation,
  startPiloting,
  stopPiloting,
  wasCancelled,
  type PilotOperation,
} from "../../store/pagePilot";
import { clearActiveSession } from "../../store/session-persistence";
import { suggestions, suggestionsLoading } from "../../store/suggestions";
import type {
  DOMSnapshotContext,
  UserContextItem,
} from "../../types/user-context";
import { generateContextId } from "../../types/user-context";
import { debug } from "../../utils/debug";
import { getTracer, type Span, SpanStatusCode } from "../../utils/tracing";
import type { ScanOptions } from "../../types/dom-scanner";
import { scanPageDelta, scanPageDirect } from "../../utils/dom-scanner";
import { PreactMarkdown } from "../../utils/preact-markdown";
import { useAPI } from "../context";
import { ContextTagList } from "../Panel/ContextTag";
import { type TaskButtonData } from "../Panel/TaskButton";
import { UnifiedChatInput } from "../Panel/UnifiedChatInput";
import { ErrorRow, ProgressStack } from "../Progress";
import { QuestionChip, QuestionChipSkeleton } from "../shared";
import { ResumePrompt } from "./ResumePrompt";

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
  const name = actionName.replace(/_/g, " ").toLowerCase();

  if (!success) {
    return `Failed to ${name}`;
  }

  // Transform "open_settings" -> "Opened settings"
  if (name.startsWith("open ")) {
    return `Opened ${name.slice(5)}`;
  }
  if (name.startsWith("go to ")) {
    return `Navigated to ${name.slice(6)}`;
  }
  if (name.startsWith("navigate to ")) {
    return `Navigated to ${name.slice(12)}`;
  }
  // Fallback
  return "Done!";
}

/**
 * Build scan options that always exclude Pillar's own UI (#pillar-root)
 * and merges in any user-configured excludeSelector.
 */
function getScanOptions(): ScanOptions {
  const pillar = getPillarInstance();
  const userExclude = pillar?.config?.domScanning?.excludeSelector;
  return {
    excludeSelector: userExclude
      ? `#pillar-root, ${userExclude}`
      : "#pillar-root",
  };
}

export function ChatView() {
  const api = useAPI();
  const messagesRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const streamGenRef = useRef(0);
  const [isResuming, setIsResuming] = useState(false);

  // Shared action request handler — used by both handleInputSubmit and handleResume
  const handleActionRequest = useCallback(
    async (request: import("../../api/mcp-client").ActionRequest) => {
      const requestStartTime = performance.now();
      const startTimestamp = new Date().toISOString();
      debug.log(
        "[Pillar] Received action_request:",
        request.action_name,
        request.parameters,
        `at ${startTimestamp}`
      );
      const pillar = getPillarInstance();
      if (pillar) {
        try {
          // Check for built-in SDK actions first
          if (request.action_name === "interact_with_page") {
            const params = request.parameters as {
              operation: "click" | "type" | "select" | "focus" | "toggle";
              ref: string;
              value?: string;
            };

            // Start piloting mode - shows banner
            startPiloting(
              params.operation as PilotOperation,
              request.tool_call_id
            );

            try {
              // Check if cancelled before executing
              if (wasCancelled()) {
                await api.mcp.sendActionResult(
                  request.action_name,
                  { success: false, error: "User cancelled action" },
                  request.tool_call_id
                );
                debug.log(
                  "[Pillar] Page interaction cancelled by user before execution"
                );
                return;
              }

              const interactionResult =
                await pillar.handlePageInteraction(params);

              // Check if cancelled after executing
              if (wasCancelled()) {
                await api.mcp.sendActionResult(
                  request.action_name,
                  { success: false, error: "User cancelled action" },
                  request.tool_call_id
                );
                debug.log(
                  "[Pillar] Page interaction cancelled by user after execution"
                );
                return;
              }

              // If action succeeded and DOM scanning is enabled, delta scan after a brief delay
              let updatedDomSnapshot: string | null = null;
              if (
                interactionResult.success &&
                pillar?.isDOMScanningEnabled
              ) {
                // Wait for DOM to settle (animations, async updates)
                await new Promise((resolve) => setTimeout(resolve, 150));
                const deltaResult = scanPageDelta(getScanOptions());
                updatedDomSnapshot = deltaResult.content;
                debug.log(
                  "[Pillar] DOM delta scanned after page interaction:",
                  deltaResult.hasChanges
                    ? `${deltaResult.newInteractableCount} new, ${deltaResult.removedRefs.length} removed`
                    : "no changes"
                );
              }

              await api.mcp.sendActionResult(
                request.action_name,
                {
                  ...interactionResult,
                  dom_snapshot: updatedDomSnapshot,
                },
                request.tool_call_id
              );

              const elapsed = Math.round(
                performance.now() - requestStartTime
              );
              debug.log(
                `[Pillar] Page interaction "${params.operation}" completed in ${elapsed}ms:`,
                interactionResult
              );
            } finally {
              // Stop piloting mode - hides banner
              stopPiloting();
              resetCancellation();
            }
            return;
          }

          // Get handler for the action
          const handler = pillar.getHandler(request.action_name);
          let result: unknown = undefined;

          if (handler) {
            // Execute the registered handler with parameters
            result = await Promise.resolve(handler(request.parameters));
          } else {
            // Fall back to executeTask for built-in action types
            await pillar.executeTask({
              id: `action-${request.action_name}`,
              name: request.action_name,
              data: request.parameters,
            });
          }

          // Check if the handler result indicates failure
          // (e.g. { success: false, error: "..." })
          const resultObj =
            result && typeof result === "object" && !Array.isArray(result)
              ? (result as Record<string, unknown>)
              : null;
          const actionSuccess = resultObj?.success !== false;

          // Send result back to agent with correct success status
          await api.mcp.sendActionResult(
            request.action_name,
            actionSuccess
              ? { success: true, result }
              : { success: false, error: resultObj?.error || resultObj?.message || "Action failed" },
            request.tool_call_id
          );

          const elapsed = Math.round(
            performance.now() - requestStartTime
          );
          if (actionSuccess) {
            debug.log(
              `[Pillar] Action "${request.action_name}" completed in ${elapsed}ms`
            );
          } else {
            debug.error(
              `[Pillar] Action "${request.action_name}" failed after ${elapsed}ms:`,
              resultObj?.error || resultObj?.message
            );
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);

          // Send failure result back to agent
          await api.mcp.sendActionResult(
            request.action_name,
            { success: false, error: errorMessage },
            request.tool_call_id
          );

          const elapsed = Math.round(
            performance.now() - requestStartTime
          );
          debug.error(
            `[Pillar] Action "${request.action_name}" failed after ${elapsed}ms:`,
            error
          );
        }
      } else {
        debug.error(
          "[Pillar] SDK not initialized, cannot execute action"
        );
        await api.mcp.sendActionResult(
          request.action_name,
          { success: false, error: "SDK not initialized" },
          request.tool_call_id
        );
      }
    },
    [api]
  );

  // Handle discarding an interrupted session
  const handleDiscard = useCallback(() => {
    const pillar = getPillarInstance();
    const siteId = pillar?.config?.productKey ?? "";

    clearInterruptedSession();
    clearActiveSession(siteId);
  }, []);

  // Scroll to bottom when messages change or resume prompt appears
  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [messages.value, interruptedSession.value]);

  // Listen for task completion events to update action status
  useEffect(() => {
    const pillar = getPillarInstance();
    if (!pillar) return;

    const unsubscribe = pillar.on("task:complete", ({ name, success }: { name: string; success: boolean }) => {
      // Update action status
      setActionComplete(name, success);

      // Update message content with completion text
      const completionText = getCompletionText(name, success);
      updateActionMessageContent(name, completionText);
    });

    return unsubscribe;
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
  const handleActionsReceived = useCallback(
    (actions: TaskButtonData[]): TaskButtonData[] => {
      const pillar = getPillarInstance();

      debug.log(
        "[Pillar] handleActionsReceived called with",
        actions.length,
        "actions"
      );
      debug.log(
        "[Pillar] Actions detail:",
        actions.map((a) => ({ name: a.name, autoRun: a.autoRun }))
      );

      // Separate auto-run actions from manual actions
      const autoRunActions = actions.filter((a) => a.autoRun === true);
      const manualActions = actions.filter((a) => !a.autoRun);

      debug.log(
        "[Pillar] Auto-run actions:",
        autoRunActions.length,
        ", Manual actions:",
        manualActions.length
      );

      // Execute auto-run actions immediately
      if (pillar && autoRunActions.length > 0) {
        debug.log("[Pillar] Executing auto-run actions...");
        autoRunActions.forEach((action) => {
          const data = action.data || {};
          const path = data.path as string | undefined;
          const externalUrl = data.url as string | undefined;

          // Mark action as pending before execution
          const messageIndex = messages.value.length - 1;
          if (messageIndex >= 0) {
            setActionPending(messageIndex, action.name);
          }

          debug.log("[Pillar] Executing action:", action.name);
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
        debug.warn("[Pillar] No Pillar instance available for auto-run");
        // Return all as buttons since we can't execute
        return actions;
      } else {
        // No auto-run actions - return all as clickable buttons
        return manualActions;
      }
    },
    []
  );

  /** Shared streaming chat helper — wires all callbacks identically for
   *  both normal sends and resume. */
  const streamChat = useCallback(
    async (opts: {
      message: string;
      conversationId: string;
      userContext?: UserContextItem[];
      images?: ChatImage[];
      history?: import("../../api/client").ChatMessage[];
      resume?: boolean;
    }) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }

      const generation = ++streamGenRef.current;
      const controller = new AbortController();
      abortControllerRef.current = controller;

      let receivedActions: TaskButtonData[] = [];
      const isStale = () => streamGenRef.current !== generation;

      const response = await api.chat({
        message: opts.message,
        history: opts.history,
        existingConversationId: opts.conversationId,
        userContext: opts.userContext,
        images: opts.images,
        resume: opts.resume,
        signal: controller.signal,
        onChunk: (chunk) => {
          if (isStale()) return;
          appendTokenToSegments(chunk);
        },
        onActions: (actions) => {
          if (isStale()) return;
          receivedActions = handleActionsReceived(actions);
        },
        onProgress: (progress: StoreProgressEvent) => {
          if (isStale()) return;
          addProgressEvent(progress);
        },
        onConversationStarted: () => {
          const pillar = getPillarInstance();
          const siteId = pillar?.config?.productKey ?? "";
          const convId = conversationId.value;
          if (siteId && convId) {
            import("../../store/session-persistence").then(
              ({ saveActiveSession }) => {
                saveActiveSession(convId, siteId);
              }
            );
          }
        },
        onActionRequest: handleActionRequest,
        onRequestId: (id) => setActiveRequestId(id),
      });

      return { response, receivedActions, generation };
    },
    [api, handleActionsReceived, handleActionRequest]
  );

  const sendMessage = useCallback(
    async (
      message: string,
      userContext?: UserContextItem[],
      images?: ChatImage[]
    ) => {
      clearInterruptedSession();
      clearChatError();

      // OTel: span wrapping the full send-message lifecycle
      const _tracer = getTracer();
      const _msgSpan: Span = _tracer.startSpan('chat.send_message', {
        attributes: { 'chat.message_length': message.length },
      });

      // Add user message with context and images
      addUserMessage(message, userContext, images);

      // Show loading state
      setLoading(true);

      // Add placeholder assistant message
      addAssistantMessage("");

      let generation = -1;
      try {
        const history = messages.value.slice(0, -1); // Exclude the empty assistant message

        // Generate conversation_id client-side if new conversation
        const isNewConversation = !conversationId.value;
        if (isNewConversation) {
          setConversationId(crypto.randomUUID());
        }

        const { response, receivedActions, generation: gen } = await streamChat({
          message,
          conversationId: conversationId.value!,
          userContext,
          images,
          history,
        });
        generation = gen;

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

        // Optimistically add to history so dropdown shows it immediately
        if (isNewConversation && conversationId.value) {
          addOptimisticConversation(conversationId.value, message);
        }

        // Clear session hint ONLY on successful completion (not on abort/error)
        {
          const pillar = getPillarInstance();
          const siteId = pillar?.config?.productKey ?? "";
          if (siteId) {
            clearActiveSession(siteId);
          }
        }
        _msgSpan.end();
      } catch (error) {
        if ((error as Error).name === "AbortError") {
          removeLastEmptyAssistantMessage();
          debug.log("[Pillar] Chat cancelled by user");
          _msgSpan.setAttribute('chat.cancelled', true);
          _msgSpan.end();
          return;
        }
        generation = streamGenRef.current;
        debug.error("[Pillar] Chat error:", error);
        _msgSpan.setStatus({ code: SpanStatusCode.ERROR, message: (error as Error).message });
        _msgSpan.end();
        removeLastEmptyAssistantMessage();
        setChatError({
          message: "Something went wrong. Please try again.",
          retryMessage: message,
          retryContext: userContext,
          retryImages: images,
        });
      } finally {
        if (streamGenRef.current === generation) {
          setLoading(false);
          clearProgressStatus();
          setActiveRequestId(null);
          abortControllerRef.current = null;
        }
      }
    },
    [api, streamChat, handleActionsReceived]
  );

  // Handle resuming an interrupted session
  const handleResume = useCallback(async () => {
    const session = interruptedSession.value;
    if (!session) return;

    const pillar = getPillarInstance();
    const siteId = pillar?.config?.productKey ?? "";
    const isDOMScanningEnabled = pillar?.isDOMScanningEnabled ?? false;

    // Gather user context (same logic as handleInputSubmit)
    let resumeContext: UserContextItem[] = [...userContext.value];

    if (isDOMScanningEnabled) {
      const scanResult = scanPageDirect(getScanOptions());
      const domContext: DOMSnapshotContext = {
        id: generateContextId(),
        type: "dom_snapshot",
        url: scanResult.url,
        title: scanResult.title,
        content: scanResult.content,
        interactableCount: scanResult.interactableCount,
        timestamp: scanResult.timestamp,
      };
      resumeContext = [...resumeContext, domContext];
    }

    setIsResuming(true);
    setLoading(true);

    // Add placeholder assistant message for the resumed response
    addAssistantMessage("");

    let generation = -1;
    try {
      const { response, receivedActions, generation: gen } = await streamChat({
        message: "",
        conversationId: session.conversationId,
        userContext: resumeContext.length > 0 ? resumeContext : undefined,
        resume: true,
      });
      generation = gen;

      // Handle actions from response
      let finalActions = receivedActions;
      if (response.actions && response.actions.length > 0) {
        finalActions = handleActionsReceived(response.actions);
      }

      updateLastAssistantMessage(
        response.message,
        response.messageId,
        finalActions,
        response.sources
      );

      // Clear interrupted session state
      clearInterruptedSession();
      clearActiveSession(siteId);
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        removeLastEmptyAssistantMessage();
        return;
      }
      generation = streamGenRef.current;
      debug.error("[Pillar] Resume error:", error);
      removeLastEmptyAssistantMessage();
      setChatError({
        message: "Failed to resume. Please try again.",
        retryMessage: session.userMessage,
      });
      // Clear so user isn't stuck in a resume loop
      clearInterruptedSession();
      clearActiveSession(siteId);
    } finally {
      setIsResuming(false);
      if (streamGenRef.current === generation) {
        setLoading(false);
        clearProgressStatus();
        setActiveRequestId(null);
        abortControllerRef.current = null;
      }
    }
  }, [streamChat, handleActionsReceived]);

  // Auto-resume for quick reconnects (under 15 seconds)
  useEffect(() => {
    const session = interruptedSession.value;
    if (session && session.elapsedMs < 15000 && !isLoading.value) {
      handleResume();
    }
  }, [interruptedSession.value, handleResume]);

  // Abort the active stream when ChatView unmounts (e.g. user clicks "+" for new chat).
  // Without this, the orphaned fetch connection keeps writing to shared signals.
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, []);

  // Handle stop button - cancel in-progress streaming
  const handleStop = useCallback(() => {
    // 1. Abort the fetch connection (client-side)
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;

    // 2. Tell backend to stop the LLM stream (server-side)
    const reqId = activeRequestId.value;
    if (reqId !== null) {
      api.mcp.cancelStream(reqId);
      setActiveRequestId(null);
    }

    // 3. Keep partial response, clear loading state
    setLoading(false);
    clearProgressStatus();

    // 4. Remove empty assistant placeholder if no tokens arrived yet
    removeLastEmptyAssistantMessage();

    // 5. Finalize active progress events so thinking timers stop
    finalizeActiveProgressEvents();

    // 6. Check if there's a partial response — if so, enable resume
    const msgs = messages.value;
    const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null;
    const hasPartialResponse =
      lastMsg?.role === "assistant" && Boolean(lastMsg?.content?.trim());

    const pillar = getPillarInstance();
    const siteId = pillar?.config?.productKey ?? "";

    if (hasPartialResponse && conversationId.value) {
      // Agent was mid-answer — set up interruptedSession so the resume
      // prompt appears and the user can pick up where the agent left off.
      const lastUserMsg = [...msgs].reverse().find((m) => m.role === "user");

      setInterruptedSession({
        conversationId: conversationId.value,
        userMessage: lastUserMsg?.content ?? "",
        partialResponse: lastMsg.content ?? "",
        displayTrace: [],
        elapsedMs: 99999, // Prevent auto-resume — user explicitly stopped
      });

      // Keep localStorage session hint so page refresh also enables resume
    } else {
      // No partial response (early stop) — clear session hint
      if (siteId) {
        clearActiveSession(siteId);
      }
    }
  }, [api]);

  // Handle retry after error - resends the last failed message
  const handleRetry = useCallback(() => {
    const error = chatError.value;
    if (!error) return;
    clearChatError();
    // Remove the user message that was already added (sendMessage will re-add it)
    const msgs = messages.value;
    if (msgs.length > 0 && msgs[msgs.length - 1].role === "user") {
      messages.value = msgs.slice(0, -1);
    }
    sendMessage(error.retryMessage, error.retryContext, error.retryImages);
  }, [sendMessage]);

  // Handle feedback submission
  const handleFeedback = useCallback(
    async (messageId: string, feedback: "up" | "down") => {
      // Update local state immediately for responsive UI
      setMessageFeedback(messageId, feedback);

      // Submit feedback to server (fire-and-forget)
      await api.submitFeedback(messageId, feedback);
    },
    [api]
  );

  // Handle submit from UnifiedChatInput
  const handleInputSubmit = useCallback(
    (message: string, context: UserContextItem[], images: ChatImage[]) => {
      if (isLoading.value) return;

      const pillar = getPillarInstance();
      const isDOMScanningEnabled = pillar?.isDOMScanningEnabled ?? false;

      // If DOM scanning is enabled, scan the page and add to context
      if (isDOMScanningEnabled) {
        // Use optimized single-pass scanner (no AST intermediate)
        const scanResult = scanPageDirect(getScanOptions());

        // Add DOM context to message
        const domContext: DOMSnapshotContext = {
          id: generateContextId(),
          type: "dom_snapshot",
          url: scanResult.url,
          title: scanResult.title,
          content: scanResult.content,
          interactableCount: scanResult.interactableCount,
          timestamp: scanResult.timestamp,
        };

        const contextWithDOM = [...context, domContext];
        sendMessage(
          message,
          contextWithDOM.length > 0 ? contextWithDOM : undefined,
          images.length > 0 ? images : undefined
        );
        return;
      }

      // DOM scanning disabled - send normally
      sendMessage(
        message,
        context.length > 0 ? context : undefined,
        images.length > 0 ? images : undefined
      );
    },
    [sendMessage]
  );

  // Process pending message when triggered
  // The trigger signal is incremented by Panel.open() when a search query is passed
  // This works whether ChatView is already mounted or just mounting
  // Routes through handleInputSubmit to ensure DOM scanning is applied
  useEffect(() => {
    const pending = pendingMessage.value;
    const pendingContext = pendingUserContext.value;
    const pendingImages = pendingImagesForNavigation.value;
    if (pending) {
      clearPendingMessage();
      clearPendingUserContext();
      clearPendingImagesForNavigation();
      // Route through handleInputSubmit so DOM scanning logic is applied
      handleInputSubmit(pending, pendingContext, pendingImages);
    }
  }, [submitPendingTrigger.value, handleInputSubmit]);

  // Sources are displayed but not clickable (article views have been removed)
  // TODO: Consider linking sources to external URLs if available

  // Action button rendering removed - suggested actions are not yet functional

  return (
    <div class="_pillar-chat-view pillar-chat-view">
      {/* Messages area - takes full height */}
      <div
        class="_pillar-chat-view-messages pillar-chat-view-messages"
        ref={messagesRef}
      >
        {/* Loading skeleton for history */}
        {isLoadingHistory.value && (
          <div class="_pillar-chat-history-loading pillar-chat-history-loading">
            <div class="_pillar-chat-history-loading-message _pillar-chat-history-loading-message--user pillar-chat-history-loading-message--user">
              <div
                class="_pillar-chat-history-loading-bar pillar-chat-history-loading-bar"
                style="width: 70%"
              />
            </div>
            <div class="_pillar-chat-history-loading-message _pillar-chat-history-loading-message--assistant pillar-chat-history-loading-message--assistant">
              <div
                class="_pillar-chat-history-loading-bar pillar-chat-history-loading-bar"
                style="width: 90%"
              />
              <div
                class="_pillar-chat-history-loading-bar pillar-chat-history-loading-bar"
                style="width: 85%"
              />
              <div
                class="_pillar-chat-history-loading-bar pillar-chat-history-loading-bar"
                style="width: 60%"
              />
            </div>
            <div class="_pillar-chat-history-loading-message _pillar-chat-history-loading-message--user pillar-chat-history-loading-message--user">
              <div
                class="_pillar-chat-history-loading-bar pillar-chat-history-loading-bar"
                style="width: 55%"
              />
            </div>
            <div class="_pillar-chat-history-loading-message _pillar-chat-history-loading-message--assistant pillar-chat-history-loading-message--assistant">
              <div
                class="_pillar-chat-history-loading-bar pillar-chat-history-loading-bar"
                style="width: 95%"
              />
              <div
                class="_pillar-chat-history-loading-bar pillar-chat-history-loading-bar"
                style="width: 80%"
              />
            </div>
          </div>
        )}

        {messages.value.length === 0 &&
          !interruptedSession.value &&
          !isLoadingHistory.value && (
            <div class="_pillar-chat-view-welcome pillar-chat-view-welcome">
              {suggestionsLoading.value ? (
                <div class="_pillar-home-view-questions pillar-home-view-questions">
                  <QuestionChipSkeleton />
                  <QuestionChipSkeleton />
                  <QuestionChipSkeleton />
                </div>
              ) : suggestions.value && suggestions.value.length > 0 ? (
                <div class="_pillar-home-view-questions pillar-home-view-questions">
                  {suggestions.value.map((question) => (
                    <QuestionChip
                      key={question.id}
                      text={question.text}
                      onClick={() => handleInputSubmit(question.text, [], [])}
                    />
                  ))}
                </div>
              ) : (
                <>
                  <div class="_pillar-chat-view-welcome-icon pillar-chat-view-welcome-icon">
                    💬
                  </div>
                  <div class="_pillar-chat-view-welcome-title pillar-chat-view-welcome-title">
                    Ask a question
                  </div>
                  <div class="_pillar-chat-view-welcome-text pillar-chat-view-welcome-text">
                    Ask me anything about how to use this product.
                  </div>
                </>
              )}
            </div>
          )}

        {messages.value.map((msg, index) => (
          <div
            key={index}
            class={`_pillar-chat-view-message pillar-chat-view-message _pillar-chat-view-message--${msg.role} pillar-chat-view-message--${msg.role}`}
          >
            {msg.role === "user" ? (
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
                  {/* Segment-based interleaved rendering (text and progress blocks in chronological order) */}
                  {msg.segments && msg.segments.length > 0 ? (
                    msg.segments.map((segment, segIdx) => {
                      if (segment.type === "progress") {
                        const hasFollowingText = msg.segments!.slice(segIdx + 1).some(s => s.type === "text");
                        return (
                          <ProgressStack
                            key={`seg-${segIdx}`}
                            events={segment.events}
                            responseStarted={hasFollowingText || Boolean(msg.content)}
                          />
                        );
                      }
                      return (
                        <div key={`seg-${segIdx}`} class="_pillar-message-assistant pillar-message-assistant">
                          <PreactMarkdown content={segment.content} />
                        </div>
                      );
                    })
                  ) : (
                    /* No segments yet — shimmer text while waiting for first SSE event */
                    isLoading.value &&
                      index === messages.value.length - 1 && (
                        <span class="_pillar-thinking-shimmer pillar-thinking-shimmer">
                          Thinking...
                        </span>
                      )
                  )}
                  {/* Loading spinner — only needed for segments path when nothing has arrived yet.
                     When segments is undefined, the fallback branch above handles the spinner. */}
                  {/* Action status indicator */}
                  {msg.actionStatus &&
                    Object.keys(msg.actionStatus).length > 0 && (
                      <span class="_pillar-action-status pillar-action-status">
                        {Object.entries(msg.actionStatus).map(
                          ([actionName, status]) => (
                            <span
                              key={actionName}
                              class={`_pillar-action-status-indicator pillar-action-status-indicator _pillar-action-status-indicator--${status.status} pillar-action-status-indicator--${status.status}`}
                              title={
                                status.status === "failed"
                                  ? status.errorMessage
                                  : actionName
                              }
                              dangerouslySetInnerHTML={{
                                __html:
                                  status.status === "success"
                                    ? CHECK_ICON
                                    : status.status === "failed"
                                      ? X_ICON
                                      : SPINNER_ICON,
                              }}
                            />
                          )
                        )}
                      </span>
                    )}
                </div>
                {/* Feedback icons - only show for completed assistant messages with an ID */}
                {msg.role === "assistant" && msg.id && msg.content && (
                  <div class="_pillar-feedback-icons pillar-feedback-icons">
                    <button
                      class={`_pillar-feedback-btn pillar-feedback-btn ${msg.feedback === "up" ? "_pillar-feedback-btn--active pillar-feedback-btn--active" : ""}`}
                      onClick={() => handleFeedback(msg.id!, "up")}
                      aria-label="Helpful"
                      title="Helpful"
                      type="button"
                      dangerouslySetInnerHTML={{ __html: THUMBS_UP_ICON }}
                    />
                    <button
                      class={`_pillar-feedback-btn pillar-feedback-btn ${msg.feedback === "down" ? "_pillar-feedback-btn--active pillar-feedback-btn--active" : ""}`}
                      onClick={() => handleFeedback(msg.id!, "down")}
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
                    <div class="_pillar-chat-sources-title pillar-chat-sources-title">
                      Sources
                    </div>
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

                {/* Action buttons removed - suggested actions are not yet functional */}
              </div>
            )}
          </div>
        ))}

        {/* Error row - shown when MCP request fails */}
        {chatError.value && (
          <ErrorRow error={chatError.value} onRetry={handleRetry} />
        )}

        {/* Resume prompt for interrupted sessions (rendered at bottom so it's
            visible after explicit stop or reconnect without scrolling up) */}
        {interruptedSession.value &&
          interruptedSession.value.elapsedMs >= 15000 && (
            <ResumePrompt
              session={interruptedSession.value}
              onResume={handleResume}
              onDiscard={handleDiscard}
              isResuming={isResuming}
            />
          )}

        {/* Seamless resume indicator */}
        {isResuming &&
          interruptedSession.value &&
          interruptedSession.value.elapsedMs < 15000 && (
            <ResumePrompt
              session={interruptedSession.value}
              onResume={handleResume}
              onDiscard={handleDiscard}
              isResuming={true}
            />
          )}
      </div>

      {/* Input area */}
      <div class="_pillar-chat-view-input-area pillar-chat-view-input-area">
        <UnifiedChatInput
          placeholder="Ask a question..."
          disabled={isLoadingHistory.value}
          isStreaming={isLoading.value}
          onStop={handleStop}
          onSubmit={handleInputSubmit}
        />
      </div>
    </div>
  );
}
