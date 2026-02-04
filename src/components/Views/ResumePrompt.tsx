/**
 * ResumePrompt Component
 * 
 * Displays an inline prompt to resume an interrupted conversation.
 * Shows after a user reconnects and there's a resumable session.
 * 
 * - For quick reconnects (<15s): Shows a brief "Resuming..." indicator
 * - For longer disconnects: Shows summary + Resume/Discard buttons
 */

import { h } from 'preact';
import type { InterruptedSession } from '../../store/chat';

export interface ResumePromptProps {
  /** The interrupted session details */
  session: InterruptedSession;
  /** Called when user clicks Resume */
  onResume: () => void;
  /** Called when user clicks Discard */
  onDiscard: () => void;
  /** Whether resumption is in progress */
  isResuming?: boolean;
}

// 15 second threshold for seamless resume
const SEAMLESS_THRESHOLD_MS = 15000;

export function ResumePrompt({
  session,
  onResume,
  onDiscard,
  isResuming = false,
}: ResumePromptProps) {
  const isSeamless = session.elapsedMs < SEAMLESS_THRESHOLD_MS;

  // For quick reconnects, just show resuming indicator
  if (isSeamless || isResuming) {
    return (
      <div class="_pillar-resume-prompt _pillar-resume-prompt--seamless pillar-resume-prompt">
        <div class="_pillar-resume-prompt-spinner pillar-resume-prompt-spinner" />
        <span class="_pillar-resume-prompt-text pillar-resume-prompt-text">
          Resuming conversation...
        </span>
      </div>
    );
  }

  // For longer disconnects, show full resume prompt
  return (
    <div class="_pillar-resume-prompt pillar-resume-prompt">
      <div class="_pillar-resume-prompt-content pillar-resume-prompt-content">
        <div class="_pillar-resume-prompt-icon pillar-resume-prompt-icon">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </div>
        <div class="_pillar-resume-prompt-body pillar-resume-prompt-body">
          <div class="_pillar-resume-prompt-title pillar-resume-prompt-title">
            Session Interrupted
          </div>
          <div class="_pillar-resume-prompt-message pillar-resume-prompt-message">
            {session.userMessage && (
              <span class="_pillar-resume-prompt-user-msg pillar-resume-prompt-user-msg">
                "{truncate(session.userMessage, 50)}"
              </span>
            )}
            {session.summary && (
              <span class="_pillar-resume-prompt-summary pillar-resume-prompt-summary">
                {session.summary}
              </span>
            )}
          </div>
        </div>
      </div>
      <div class="_pillar-resume-prompt-actions pillar-resume-prompt-actions">
        <button
          type="button"
          class="_pillar-resume-prompt-btn _pillar-resume-prompt-btn--primary pillar-resume-prompt-btn"
          onClick={onResume}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="currentColor"
            stroke="none"
          >
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
          Resume
        </button>
        <button
          type="button"
          class="_pillar-resume-prompt-btn _pillar-resume-prompt-btn--ghost pillar-resume-prompt-btn"
          onClick={onDiscard}
        >
          Discard
        </button>
      </div>
    </div>
  );
}

/**
 * Truncate text with ellipsis
 */
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}
