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

// ============================================================================
// Styles for markdown components
// ============================================================================

export const MARKDOWN_COMPONENT_STYLES = `
/* Collapsible Section */
._pillar-collapsible {
  margin: 2px 0;
}

._pillar-collapsible-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 0;
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  color: var(--pillar-text-secondary, #6b7280);
  font-family: inherit;
  width: 100%;
  text-align: left;
  transition: background-color 0.15s ease;
}

._pillar-collapsible-header:hover {
  background: var(--pillar-bg-hover, rgba(0, 0, 0, 0.05));
}

._pillar-collapsible-icon {
  font-size: 10px;
  color: var(--pillar-text-muted, #9ca3af);
}

._pillar-collapsible-title {
  flex: 1;
}

._pillar-collapsible-content-wrapper {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.2s ease;
}

._pillar-collapsible-content-wrapper--expanded {
  grid-template-rows: 1fr;
}

._pillar-collapsible-content {
  overflow: hidden;
  padding-left: 18px;
  font-size: 13px;
  color: var(--pillar-text-secondary, #6b7280);
  line-height: 1.4;
}

._pillar-collapsible-content-wrapper--expanded ._pillar-collapsible-content {
  padding-top: 2px;
  padding-bottom: 4px;
}

/* Source List */
._pillar-source-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 4px 0;
}

._pillar-source-item {
  display: block;
  padding: 4px 8px;
  font-size: 12px;
  color: var(--pillar-primary, #2563eb);
  text-decoration: none;
  border-radius: 4px;
  transition: background-color 0.15s ease;
}

._pillar-source-item:hover {
  background: var(--pillar-bg-hover, rgba(0, 0, 0, 0.05));
  text-decoration: underline;
}

/* Task List */
._pillar-task-list {
  list-style: none;
  padding: 0;
  margin: 8px 0;
}

._pillar-task-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  font-size: 13px;
}

._pillar-task-item--completed ._pillar-task-text {
  text-decoration: line-through;
  color: var(--pillar-text-placeholder, #9ca3af);
}

._pillar-task-checkbox {
  width: 16px;
  height: 16px;
  cursor: pointer;
}

/* Code Block */
._pillar-code-block {
  margin: 8px 0;
  border-radius: 8px;
  overflow: hidden;
  background: var(--pillar-bg-code, #1e1e1e);
}

._pillar-code-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: var(--pillar-bg-code-header, #2d2d2d);
  border-bottom: 1px solid var(--pillar-border-code, #404040);
}

._pillar-code-language {
  font-size: 11px;
  font-weight: 500;
  color: var(--pillar-text-code-header, #a0a0a0);
  text-transform: uppercase;
}

._pillar-code-copy {
  padding: 4px 8px;
  font-size: 11px;
  font-family: inherit;
  background: transparent;
  border: 1px solid var(--pillar-border-code, #404040);
  border-radius: 4px;
  color: var(--pillar-text-code-header, #a0a0a0);
  cursor: pointer;
  transition: all 0.15s ease;
}

._pillar-code-copy:hover {
  background: var(--pillar-bg-code-hover, #404040);
  color: #fff;
}

._pillar-code-pre {
  margin: 0;
  padding: 12px;
  overflow-x: auto;
  font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, monospace;
  font-size: 13px;
  line-height: 1.5;
}

._pillar-code-content {
  color: var(--pillar-text-code, #e0e0e0);
}

/* Action Buttons */
._pillar-action-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 8px 0;
}

._pillar-action-button {
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 500;
  font-family: inherit;
  background: var(--pillar-primary, #2563eb);
  color: #fff;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
}

._pillar-action-button:hover {
  background: var(--pillar-primary-hover, #1d4ed8);
}

/* Progress Indicator */
._pillar-progress-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 0;
  font-size: 13px;
  color: var(--pillar-text-secondary, #6b7280);
}

._pillar-progress-indicator--active ._pillar-loading-spinner {
  display: inline-block;
}

/* Streaming Thinking Content */
._pillar-progress-row--streaming {
  margin: 2px 0;
}

._pillar-thinking-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 0;
  font-size: 13px;
  font-weight: 500;
  color: var(--pillar-text-secondary, #6b7280);
}

._pillar-thinking-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
}

._pillar-spinner {
  width: 12px;
  height: 12px;
  border: 2px solid var(--pillar-border, #e5e7eb);
  border-top-color: var(--pillar-primary, #2563eb);
  border-radius: 50%;
  animation: pillar-spin 0.8s linear infinite;
}

@keyframes pillar-spin {
  to { transform: rotate(360deg); }
}

._pillar-thinking-label {
  flex: 1;
}

._pillar-thinking-content {
  padding: 6px 10px;
  font-size: 13px;
  line-height: 1.4;
  color: var(--pillar-text-secondary, #6b7280);
  background: var(--pillar-bg-tertiary, #f9fafb);
  border-radius: 4px;
  margin-top: 2px;
  max-height: 150px;
  overflow-y: auto;
}
`;
