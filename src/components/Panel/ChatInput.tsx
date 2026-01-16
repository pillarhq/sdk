/**
 * Chat Input Component
 * Input for starting a chat - navigates to chat view on send
 */

import { useCallback, useEffect, useRef } from 'preact/hooks';
import {
  clearPrefillText,
  focusInputTrigger,
  prefillText,
  setPendingMessage,
  setPendingUserContext,
  userContext
} from '../../store/chat';
import { navigateToChat } from '../../store/router';
import { MessageInputArea } from '../shared';

// Arrow up icon for send button (similar to Cursor's design)
const SEND_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>`;

// Max height for 6 lines: (14px font * 1.5 line-height * 6) + padding (12px top + 8px bottom) = 126 + 20 = 146px
const MAX_INPUT_HEIGHT = 146;

export function ChatInput() {
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  const resizeTextarea = useCallback(() => {
    const textarea = inputRef.current;
    if (!textarea) return;
    
    // Reset to single line to measure
    textarea.style.height = '41px'; // Single line height (21px line + 12px top + 8px bottom padding)
    
    // Get the scroll height (content height)
    const scrollHeight = textarea.scrollHeight;
    
    // Set new height, capped at max
    if (scrollHeight > MAX_INPUT_HEIGHT) {
      textarea.style.height = `${MAX_INPUT_HEIGHT}px`;
      textarea.style.overflowY = 'auto';
    } else {
      textarea.style.height = `${scrollHeight}px`;
      textarea.style.overflowY = 'hidden';
    }
  }, []);

  // Handle prefill text from text selection
  useEffect(() => {
    const text = prefillText.value;
    if (text && inputRef.current) {
      inputRef.current.value = text;
      resizeTextarea();
      inputRef.current.focus();
      // Position cursor at the end of the text
      const length = text.length;
      inputRef.current.setSelectionRange(length, length);
      clearPrefillText();
    }
  }, [prefillText.value, resizeTextarea]);

  // Handle focus trigger (e.g., when panel opens with focusInput option)
  useEffect(() => {
    const trigger = focusInputTrigger.value;
    if (trigger > 0 && inputRef.current) {
      // Small delay to ensure panel animation has started
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [focusInputTrigger.value]);

  const handleSubmit = useCallback((message: string) => {
    // Store message and user context for the chat view to process
    setPendingMessage(message);
    setPendingUserContext(userContext.value);
    // Navigate to chat view
    navigateToChat();
  }, []);

  return (
    <div class="_pillar-chat-input-container pillar-chat-input-container">
      <div class="_pillar-chat-input-area pillar-chat-input-area">
        <MessageInputArea
          onSubmit={handleSubmit}
          placeholder="Ask a question... (paste or drop images)"
          inputRef={inputRef}
          showBorder={false}
        />
      </div>
    </div>
  );
}
