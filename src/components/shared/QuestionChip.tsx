/**
 * QuestionChip Component
 * Clickable chip for suggested questions
 */

import { h } from 'preact';

export interface QuestionChipProps {
  text: string;
  onClick: () => void;
}

export function QuestionChip({ text, onClick }: QuestionChipProps) {
  return (
    <button
      type="button"
      class="_pillar-question-chip pillar-question-chip"
      onClick={onClick}
    >
      <span class="_pillar-question-chip-text pillar-question-chip-text">
        {text}
      </span>
      <span class="_pillar-question-chip-arrow pillar-question-chip-arrow">
        →
      </span>
    </button>
  );
}

/**
 * Skeleton placeholder for loading state
 */
export function QuestionChipSkeleton() {
  return (
    <div class="_pillar-question-chip-skeleton pillar-question-chip-skeleton">
      <div class="_pillar-question-chip-skeleton-bar pillar-question-chip-skeleton-bar" />
    </div>
  );
}
