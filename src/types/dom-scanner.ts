/**
 * DOM Scanner Types
 * Types for scanning DOM and creating compact text representation for LLM context
 */

// ============================================================================
// Interaction Types
// ============================================================================

/** Types of interactions possible with an element */
export type InteractionType =
  | "click"
  | "input"
  | "select"
  | "toggle"
  | "submit"
  | "focus"
  | "hover"
  | string; // Allow custom interaction types via data-pillar-interactable

// ============================================================================
// Scan Options
// ============================================================================

/** Options for controlling DOM scanning behavior */
export interface ScanOptions {
  /** Maximum depth to traverse (default: 20) */
  maxDepth?: number;
  /** Include text content nodes (default: true) */
  includeText?: boolean;
  /** Include only visible elements (default: true) */
  visibleOnly?: boolean;
  /** Root element to scan from (default: document.body) */
  root?: Element;
  /** Selector for elements to exclude from scanning */
  excludeSelector?: string;
  /** Minimum text length to include (default: 1) */
  minTextLength?: number;
  /** Maximum text length before truncation (default: 500) */
  maxTextLength?: number;
  /** Maximum total output length in characters (default: 50000) */
  maxTotalLength?: number;
  /** Maximum label length for interactable elements (default: 100) */
  maxLabelLength?: number;
  /** Include element positions/coordinates (default: false) */
  includePositions?: boolean;
}

/** Default scan options */
export const DEFAULT_SCAN_OPTIONS: Required<
  Omit<ScanOptions, "root" | "excludeSelector">
> = {
  maxDepth: 20,
  includeText: true,
  visibleOnly: true,
  minTextLength: 1,
  maxTextLength: 500,
  maxTotalLength: 50_000,
  maxLabelLength: 100,
  includePositions: false,
};

// ============================================================================
// Scan Result
// ============================================================================

/** Result of DOM scan with compact text representation for LLM context */
export interface CompactScanResult {
  /** Compact text representation for LLM context */
  content: string;
  /** Number of interactable elements found */
  interactableCount: number;
  /** Timestamp when scan was performed */
  timestamp: number;
  /** URL of the page that was scanned */
  url: string;
  /** Title of the page */
  title: string;
}

/** Result of a delta scan showing only changes since the last scan */
export interface DeltaScanResult {
  /** Formatted delta string for LLM context, or null if no changes */
  content: string | null;
  /** Ref IDs of elements no longer on the page */
  removedRefs: string[];
  /** Number of new interactable elements found */
  newInteractableCount: number;
  /** Total interactable elements currently on the page */
  totalInteractableCount: number;
  /** Whether any changes were detected */
  hasChanges: boolean;
  /** Timestamp when scan was performed */
  timestamp: number;
  /** URL of the page that was scanned */
  url: string;
  /** Title of the page */
  title: string;
}

// ============================================================================
// Constants
// ============================================================================

/** HTML tags that are inherently interactable */
export const INTERACTABLE_TAGS = new Set([
  "a",
  "button",
  "input",
  "select",
  "textarea",
  "details",
  "summary",
  "dialog",
  "menu",
  "menuitem",
]);

/** ARIA roles that indicate interactability */
export const INTERACTABLE_ROLES = new Set([
  "button",
  "link",
  "checkbox",
  "radio",
  "switch",
  "tab",
  "tabpanel",
  "menuitem",
  "menuitemcheckbox",
  "menuitemradio",
  "option",
  "slider",
  "spinbutton",
  "textbox",
  "combobox",
  "listbox",
  "searchbox",
  "tree",
  "treeitem",
  "grid",
  "gridcell",
  "row",
  "rowheader",
  "columnheader",
]);

/** Tags to completely skip during scanning */
export const SKIP_TAGS = new Set([
  "script",
  "style",
  "noscript",
  "template",
  "svg",
  "path",
  "iframe",
  "object",
  "embed",
  "head",
  "meta",
  "link",
  "base",
]);
