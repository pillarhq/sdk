/**
 * Home View Component
 * Default panel view with suggested questions and chat input
 * 
 * Uses the suggestions store for page-aware suggestions that are sorted
 * client-side based on the current page context (URL, title).
 */

import { useSignal, useComputed } from '@preact/signals';
import type { SuggestedQuestion } from '../../api/client';
import { setPendingMessage } from '../../store/chat';
import {
  suggestions,
  suggestionsLoading,
} from '../../store/suggestions';
import { navigateToChat } from '../../store/router';
import { UnifiedChatInput } from '../Panel/UnifiedChatInput';
import { QuestionChip, QuestionChipSkeleton } from '../shared';

export function HomeView() {
  // Subscribe to suggestions store signals
  // These are automatically sorted for the current page by Pillar core
  const currentSuggestions = useComputed(() => suggestions.value);
  const isLoading = useComputed(() => suggestionsLoading.value);

  const handleQuestionClick = (question: SuggestedQuestion) => {
    // Set the question as a pending message and navigate to chat
    setPendingMessage(question.text);
    navigateToChat();
  };

  return (
    <div class="_pillar-home-view pillar-home-view">
      {/* Suggested Questions */}
      <div class="_pillar-home-view-questions pillar-home-view-questions">
        {isLoading.value ? (
          // Loading skeleton
          <>
            <QuestionChipSkeleton />
            <QuestionChipSkeleton />
            <QuestionChipSkeleton />
          </>
        ) : currentSuggestions.value && currentSuggestions.value.length > 0 ? (
          // Show questions sorted for current page
          currentSuggestions.value.map((question) => (
            <QuestionChip
              key={question.id}
              text={question.text}
              onClick={() => handleQuestionClick(question)}
            />
          ))
        ) : null}
      </div>

      {/* Input Area - pushed to bottom with margin-top: auto */}
      <div style={{ marginTop: 'auto' }}>
        <UnifiedChatInput placeholder="Ask anything..." />
      </div>
    </div>
  );
}
