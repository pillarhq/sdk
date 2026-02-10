/**
 * Markdown Components
 *
 * Preact components that can be substituted for markdown elements.
 * These enable interactive UI within markdown content.
 */

import { h, ComponentChildren, VNode } from 'preact';
import { useState, useRef, useEffect } from 'preact/hooks';
import { debug } from './debug';

// ============================================================================
// CollapsibleSection - Replaces ProgressRow + ReasoningDisclosure
// ============================================================================

export interface CollapsibleSectionProps {
  title: string;
  defaultOpen?: boolean;
  children: ComponentChildren;
}

export function CollapsibleSection({
  title,
  defaultOpen = false,
  children,
}: CollapsibleSectionProps): VNode {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const contentRef = useRef<HTMLDivElement>(null);

  return (
    <div class="_pillar-collapsible pillar-collapsible">
      <button
        type="button"
        class="_pillar-collapsible-header pillar-collapsible-header"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span
          class="_pillar-collapsible-icon pillar-collapsible-icon"
          style={{
            transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
          }}
        >
          ▶
        </span>
        <span class="_pillar-collapsible-title pillar-collapsible-title">
          {title}
        </span>
      </button>
      <div
        class={`_pillar-collapsible-content-wrapper pillar-collapsible-content-wrapper ${
          isOpen
            ? '_pillar-collapsible-content-wrapper--expanded pillar-collapsible-content-wrapper--expanded'
            : ''
        }`}
      >
        <div
          ref={contentRef}
          class="_pillar-collapsible-content pillar-collapsible-content"
        >
          {children}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SourceList - Displays search result sources
// ============================================================================

export interface Source {
  title: string;
  url: string;
  score?: number;
}

export interface SourceListProps {
  sources: Source[];
}

export function SourceList({ sources }: SourceListProps): VNode {
  if (!sources || sources.length === 0) return <span />;

  return (
    <div class="_pillar-source-list pillar-source-list">
      {sources.map((source, i) => (
        <a
          key={i}
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          class="_pillar-source-item pillar-source-item"
        >
          <span class="_pillar-source-title pillar-source-title">
            {source.title}
          </span>
        </a>
      ))}
    </div>
  );
}

// ============================================================================
// TaskList - Interactive task/todo list
// ============================================================================

export interface TaskItem {
  id: string;
  text: string;
  completed: boolean;
}

export interface TaskListProps {
  items: TaskItem[];
  onToggle?: (id: string, completed: boolean) => void;
}

export function TaskList({ items, onToggle }: TaskListProps): VNode {
  return (
    <ul class="_pillar-task-list pillar-task-list">
      {items.map((item) => (
        <li
          key={item.id}
          class={`_pillar-task-item pillar-task-item ${
            item.completed
              ? '_pillar-task-item--completed pillar-task-item--completed'
              : ''
          }`}
        >
          <input
            type="checkbox"
            checked={item.completed}
            onChange={() => onToggle?.(item.id, !item.completed)}
            class="_pillar-task-checkbox pillar-task-checkbox"
          />
          <span class="_pillar-task-text pillar-task-text">{item.text}</span>
        </li>
      ))}
    </ul>
  );
}

// ============================================================================
// CodeBlock - Syntax-highlighted code block
// ============================================================================

export interface CodeBlockProps {
  language?: string;
  children: string;
}

export function CodeBlock({ language, children }: CodeBlockProps): VNode {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(children);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      debug.error('[Pillar] Failed to copy code:', err);
    }
  };

  return (
    <div class="_pillar-code-block pillar-code-block">
      {language && (
        <div class="_pillar-code-header pillar-code-header">
          <span class="_pillar-code-language pillar-code-language">
            {language}
          </span>
          <button
            type="button"
            class="_pillar-code-copy pillar-code-copy"
            onClick={handleCopy}
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      )}
      <pre class={`_pillar-code-pre pillar-code-pre language-${language || 'text'}`}>
        <code class="_pillar-code-content pillar-code-content">{children}</code>
      </pre>
    </div>
  );
}

// ============================================================================
// ActionButtons - Interactive action button group
// ============================================================================

export interface ActionButton {
  name: string;
  label: string;
  data?: Record<string, unknown>;
}

export interface ActionButtonsProps {
  actions: ActionButton[];
  onAction?: (name: string, data?: Record<string, unknown>) => void;
}

export function ActionButtons({ actions, onAction }: ActionButtonsProps): VNode {
  return (
    <div class="_pillar-action-buttons pillar-action-buttons">
      {actions.map((action, i) => (
        <button
          key={i}
          type="button"
          class="_pillar-action-button pillar-action-button"
          onClick={() => onAction?.(action.name, action.data)}
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}

// ============================================================================
// ProgressIndicator - Shows active progress with spinner
// ============================================================================

export interface ProgressIndicatorProps {
  message: string;
  isActive?: boolean;
}

export function ProgressIndicator({
  message,
  isActive = true,
}: ProgressIndicatorProps): VNode {
  return (
    <div
      class={`_pillar-progress-indicator pillar-progress-indicator ${
        isActive ? '_pillar-progress-indicator--active pillar-progress-indicator--active' : ''
      }`}
    >
      {isActive && <div class="_pillar-loading-spinner pillar-loading-spinner" />}
      <span class="_pillar-progress-message pillar-progress-message">
        {message}
      </span>
    </div>
  );
}

// Styles have been moved to markdown.css

