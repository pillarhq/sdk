/**
 * User Context Types
 * Discriminated union for different types of context items
 * that can be attached to chat messages.
 */

// Note: No longer importing DOMNode/ScanStats - using compact text format instead

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

/** Product context for context-aware chat */
export interface ProductContext extends BaseUserContext {
  type: 'product_context';
  [key: string]: unknown;
}

/** User profile context */
export interface UserProfileContext extends BaseUserContext {
  type: 'user_profile';
  [key: string]: unknown;
}

/** Generic context for arbitrary data */
export interface GenericContext extends BaseUserContext {
  type: string;
  [key: string]: unknown;
}

/** DOM snapshot context from page scanning */
export interface DOMSnapshotContext extends BaseUserContext {
  type: 'dom_snapshot';
  /** URL of the scanned page */
  url: string;
  /** Page title */
  title: string;
  /** Compact text representation of the page for LLM context */
  content: string;
  /** Number of interactable elements found */
  interactableCount: number;
  /** Timestamp when scan was performed */
  timestamp: number;
}

// ============================================================================
// Union Type
// ============================================================================

/** Union of all possible user context item types */
export type UserContextItem =
  | HighlightedTextContext
  | ProductContext
  | UserProfileContext
  | DOMSnapshotContext
  | GenericContext;

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

/** Type guard for DOM snapshot context */
export function isDOMSnapshotContext(
  item: UserContextItem
): item is DOMSnapshotContext {
  return item.type === 'dom_snapshot';
}

/** Get display label for a context item */
export function getContextDisplayLabel(item: UserContextItem): string {
  if (isHighlightedTextContext(item)) {
    return item.text_content.length > 40
      ? item.text_content.substring(0, 40) + '...'
      : item.text_content;
  }
  if (isDOMSnapshotContext(item)) {
    return `Page scan: ${item.interactableCount} elements`;
  }
  return 'Context';
}
