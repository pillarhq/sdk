/**
 * Empty State Component
 * Displays an empty state message
 */

import { h } from 'preact';

interface EmptyProps {
  title?: string;
  description: string;
}

export function Empty({ title, description }: EmptyProps) {
  return (
    <div class="_pillar-empty pillar-empty">
      {title && <p class="_pillar-empty-title pillar-empty-title">{title}</p>}
      <p class="_pillar-empty-description pillar-empty-description">{description}</p>
    </div>
  );
}

