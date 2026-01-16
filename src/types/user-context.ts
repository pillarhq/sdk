/**
 * User Context Types
 * Discriminated union for different types of context items
 * that can be attached to chat messages.
 */

// ============================================================================
// Base Type
// ============================================================================

/** Base interface for all user context items */
interface BaseUserContext {
  /** Unique identifier for this context item (for removal) */
  id: string;
  /** Discriminator field */
  type: string;
}

// ============================================================================
// Context Item Types
// ============================================================================

/** Highlighted text context from text selection feature */
export interface HighlightedTextContext extends BaseUserContext {
  type: 'highlighted_text';
  /** The URL where the text was selected */
  url_origin: string;
  /** The selected text content */
  text_content: string;
}

// Add future context types here:
// export interface FileContext extends BaseUserContext { ... }
// export interface UrlContext extends BaseUserContext { ... }

// ============================================================================
// Union Type
// ============================================================================

/** Union of all possible user context item types */
export type UserContextItem = HighlightedTextContext;
// Extend as: UserContextItem = HighlightedTextContext | FileContext | UrlContext;

// ============================================================================
// Helpers
// ============================================================================

/** Generate a unique ID for a context item */
export function generateContextId(): string {
  return `ctx_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/** Type guard for highlighted text context */
export function isHighlightedTextContext(
  item: UserContextItem
): item is HighlightedTextContext {
  return item.type === 'highlighted_text';
}

/** Get display label for a context item */
export function getContextDisplayLabel(item: UserContextItem): string {
  switch (item.type) {
    case 'highlighted_text':
      return item.text_content.length > 40
        ? item.text_content.substring(0, 40) + '...'
        : item.text_content;
    default:
      return 'Context';
  }
}
