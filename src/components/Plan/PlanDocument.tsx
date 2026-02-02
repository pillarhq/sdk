/**
 * PlanDocument Component
 *
 * Displays a collapsible section showing the LLM-generated plan document.
 * The document explains the plan's approach, reasoning, dependencies,
 * and success criteria.
 *
 * Collapsed by default - users can click to expand and read the full context.
 */

import { h } from 'preact';
import { useState } from 'preact/hooks';
import { PreactMarkdown } from '../../utils/preact-markdown';

// ============================================================================
// Types
// ============================================================================

export interface PlanDocumentProps {
  /** The plan document content (markdown) */
  document: string;
  /** Whether to start expanded (default: false) */
  defaultExpanded?: boolean;
}

// ============================================================================
// PlanDocument Component
// ============================================================================

export function PlanDocument({
  document,
  defaultExpanded = false,
}: PlanDocumentProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const handleToggle = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <div class="pillar-plan-document">
      <div
        class="pillar-plan-document__header"
        onClick={handleToggle}
        data-expanded={isExpanded}
      >
        <span
          class="pillar-plan-document__icon"
          style={{
            transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
          }}
        >
          ▶
        </span>
        <span class="pillar-plan-document__title">Approach</span>
      </div>

      <div
        class={`pillar-plan-document__content ${isExpanded ? 'pillar-plan-document__content--expanded' : ''}`}
      >
        <div class="pillar-plan-document__body">
          <PreactMarkdown content={document} />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Styles
// ============================================================================

export const PLAN_DOCUMENT_STYLES = `
/* Plan Document Section */
.pillar-plan-document {
  border-radius: 8px;
  background: var(--pillar-bg-tertiary, #f3f4f6);
  overflow: hidden;
}

/* Header row (always visible) */
.pillar-plan-document__header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  cursor: pointer;
  user-select: none;
  transition: background 0.15s ease;
}

.pillar-plan-document__header:hover {
  background: var(--pillar-bg-tertiary-hover, rgba(0, 0, 0, 0.05));
}

/* Rotating expand icon */
.pillar-plan-document__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  color: var(--pillar-text-tertiary, #9ca3af);
  transition: transform 0.2s ease;
}

/* Title ("Approach") */
.pillar-plan-document__title {
  font-size: 12px;
  font-weight: 600;
  color: var(--pillar-text-secondary, #6b7280);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Collapsible content wrapper */
.pillar-plan-document__content {
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.25s ease-out;
}

.pillar-plan-document__content--expanded {
  max-height: 500px;
}

/* Markdown content area */
.pillar-plan-document__body {
  padding: 0 12px 12px 12px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--pillar-text-primary, #374151);
}

/* Markdown element styles */
.pillar-plan-document__body p {
  margin: 0 0 8px 0;
}

.pillar-plan-document__body p:last-child {
  margin-bottom: 0;
}

.pillar-plan-document__body ul,
.pillar-plan-document__body ol {
  margin: 0 0 8px 0;
  padding-left: 20px;
}

.pillar-plan-document__body ul:last-child,
.pillar-plan-document__body ol:last-child {
  margin-bottom: 0;
}

.pillar-plan-document__body li {
  margin: 0 0 4px 0;
}

.pillar-plan-document__body li:last-child {
  margin-bottom: 0;
}

.pillar-plan-document__body strong {
  font-weight: 600;
}

.pillar-plan-document__body code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
  padding: 1px 4px;
  background: var(--pillar-bg-secondary, #e5e7eb);
  border-radius: 3px;
}
`;
