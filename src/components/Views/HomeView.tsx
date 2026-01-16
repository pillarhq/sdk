/**
 * Home View Component
 * Default panel view with suggested questions and chat input
 */

import { useEffect, useState } from 'preact/hooks';
import type { SuggestedQuestion } from '../../api/client';
import { setPendingMessage } from '../../store/chat';
import { navigateToChat } from '../../store/router';
import { useAPI } from '../context';
import { UnifiedChatInput } from '../Panel/UnifiedChatInput';
import { QuestionChip, QuestionChipSkeleton } from '../shared';

export function HomeView() {
  const api = useAPI();
  const [questions, setQuestions] = useState<SuggestedQuestion[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const loadQuestions = async () => {
      try {
        const data = await api.getSuggestedQuestions();
        if (mounted) {
          setQuestions(data);
          setLoading(false);
        }
      } catch (err) {
        if (mounted) {
          console.error('[Pillar] Failed to load suggested questions:', err);
          // On error, just show empty state - not critical
          setQuestions([]);
          setLoading(false);
        }
      }
    };

    loadQuestions();

    return () => {
      mounted = false;
    };
  }, [api]);

  const handleQuestionClick = (question: SuggestedQuestion) => {
    // Set the question as a pending message and navigate to chat
    setPendingMessage(question.text);
    navigateToChat();
  };

  return (
    <div class="_pillar-home-view pillar-home-view">
      {/* Header */}
      <div class="_pillar-home-view-header pillar-home-view-header">
        <div class="_pillar-home-view-icon">💬</div>
        <h2 class="_pillar-home-view-title pillar-home-view-title">
          How can I help?
        </h2>
      </div>

      {/* Suggested Questions */}
      <div class="_pillar-home-view-questions pillar-home-view-questions">
        {loading ? (
          // Loading skeleton
          <>
            <QuestionChipSkeleton />
            <QuestionChipSkeleton />
            <QuestionChipSkeleton />
          </>
        ) : questions && questions.length > 0 ? (
          // Show questions
          questions.map((question) => (
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
        <UnifiedChatInput placeholder="Ask anything... (paste or drop images)" />
      </div>
    </div>
  );
}
