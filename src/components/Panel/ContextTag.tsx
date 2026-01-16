/**
 * Context Tag Component
 * Displays a removable context item (highlighted text, etc.) as a chip/tag
 */

import type { UserContextItem } from '../../types/user-context';
import { isHighlightedTextContext, getContextDisplayLabel } from '../../types/user-context';

// Close icon SVG
const CLOSE_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

// Quote icon for highlighted text
const QUOTE_ICON = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4.583 17.321C3.553 16.227 3 15 3 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311 1.804.167 3.226 1.648 3.226 3.489a3.5 3.5 0 01-3.5 3.5c-1.073 0-2.099-.49-2.748-1.179zm10 0C13.553 16.227 13 15 13 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311 1.804.167 3.226 1.648 3.226 3.489a3.5 3.5 0 01-3.5 3.5c-1.073 0-2.099-.49-2.748-1.179z"/></svg>`;

interface ContextTagProps {
  context: UserContextItem;
  onRemove?: (id: string) => void;
  readOnly?: boolean;
}

/**
 * Get the icon for a context type
 */
function getContextIcon(context: UserContextItem): string {
  if (isHighlightedTextContext(context)) {
    return QUOTE_ICON;
  }
  // Default icon for unknown types
  return QUOTE_ICON;
}

/**
 * Get tooltip text for a context item
 */
function getContextTooltip(context: UserContextItem): string {
  if (isHighlightedTextContext(context)) {
    const source = context.url_origin ? `\nFrom: ${context.url_origin}` : '';
    return `"${context.text_content}"${source}`;
  }
  return '';
}

export function ContextTag({ context, onRemove, readOnly = false }: ContextTagProps) {
  const label = getContextDisplayLabel(context);
  const icon = getContextIcon(context);
  const tooltip = getContextTooltip(context);

  const handleRemove = (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    onRemove?.(context.id);
  };

  return (
    <div
      class="_pillar-context-tag pillar-context-tag"
      title={tooltip}
    >
      <span
        class="_pillar-context-tag-icon pillar-context-tag-icon"
        dangerouslySetInnerHTML={{ __html: icon }}
      />
      <span class="_pillar-context-tag-label pillar-context-tag-label">
        {label}
      </span>
      {!readOnly && onRemove && (
        <button
          class="_pillar-context-tag-remove pillar-context-tag-remove"
          onClick={handleRemove}
          aria-label="Remove context"
          type="button"
          dangerouslySetInnerHTML={{ __html: CLOSE_ICON }}
        />
      )}
    </div>
  );
}

interface ContextTagListProps {
  contexts: UserContextItem[];
  onRemove?: (id: string) => void;
  readOnly?: boolean;
}

export function ContextTagList({ contexts, onRemove, readOnly = false }: ContextTagListProps) {
  if (contexts.length === 0) {
    return null;
  }

  return (
    <div class="_pillar-context-tag-list pillar-context-tag-list">
      {contexts.map((ctx) => (
        <ContextTag key={ctx.id} context={ctx} onRemove={onRemove} readOnly={readOnly} />
      ))}
    </div>
  );
}
