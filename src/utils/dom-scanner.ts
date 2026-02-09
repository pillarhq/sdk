/**
 * DOM Scanner Utilities
 * Scans the DOM and outputs compact text representation for LLM context
 */

import {
  DEFAULT_SCAN_OPTIONS,
  INTERACTABLE_ROLES,
  INTERACTABLE_TAGS,
  SKIP_TAGS,
  type CompactScanResult,
  type DeltaScanResult,
  type InteractionType,
  type ScanOptions,
} from "../types/dom-scanner";

// ============================================================================
// Pillar Ref Management
// ============================================================================

/** Counter for generating unique ref IDs */
let refCounter = 0;

/**
 * Generate a unique ref ID for data-pillar-ref attribute.
 * Uses a simple counter for stable, deterministic refs across rescans.
 */
function generateRefId(): string {
  return `pr-${(refCounter++).toString(36)}`;
}

/**
 * Clear all pillar refs from the DOM.
 * Called before full scans to remove stale refs and reset counter.
 */
export function clearPillarRefs(): void {
  document
    .querySelectorAll("[data-pillar-ref]")
    .forEach((el) => el.removeAttribute("data-pillar-ref"));
  // Reset counter for cleaner IDs
  refCounter = 0;
}

/** State from the last scan, used for delta computation */
let lastScanLines: Set<string> = new Set();
let lastScanRefs: Set<string> = new Set();

// ============================================================================
// Visibility Checking
// ============================================================================

/**
 * Check if an element is visible in the DOM
 */
function isElementVisible(el: Element): boolean {
  // Check if element is in the DOM
  if (!el.isConnected) return false;

  // Get computed styles
  const style = window.getComputedStyle(el);

  // Check display and visibility
  if (style.display === "none") return false;
  if (style.visibility === "hidden") return false;
  if (style.opacity === "0") return false;

  // Check if element has size (width/height > 0)
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return false;

  // Check for hidden attribute
  if (el.hasAttribute("hidden")) return false;

  // Check aria-hidden
  if (el.getAttribute("aria-hidden") === "true") return false;

  return true;
}

// ============================================================================
// Redaction
// ============================================================================

/**
 * Check if an element or any of its ancestors is marked for redaction.
 * Elements with `data-pillar-redact` or password inputs are redacted.
 * Their text content is replaced with [REDACTED] in scan output.
 */
export function isRedacted(el: Element): boolean {
  // Check for password input
  if (
    el instanceof HTMLInputElement &&
    el.type.toLowerCase() === "password"
  ) {
    return true;
  }

  // Check if this element or an ancestor has data-pillar-redact
  return el.closest("[data-pillar-redact]") !== null;
}

// ============================================================================
// Destructive Element Detection
// ============================================================================

/** Keywords that indicate a destructive action */
const DESTRUCTIVE_KEYWORDS =
  /\b(delete|remove|destroy|reset|revoke|archive|cancel subscription|deactivate|disable|erase|purge|terminate|unsubscribe|drop)\b/i;

/**
 * Check if an element represents a destructive action.
 * Used to gate interactions behind user confirmation.
 *
 * Returns true if:
 * - The element has `data-pillar-destructive` attribute (explicit opt-in)
 * - The element's label or text content contains destructive keywords
 * - The element is a reset/submit button on a form with "delete" in its action URL
 */
export function isDestructiveElement(el: Element): boolean {
  // Explicit opt-in via data attribute
  if (el.hasAttribute("data-pillar-destructive")) {
    return true;
  }

  // Check aria-label
  const ariaLabel = el.getAttribute("aria-label");
  if (ariaLabel && DESTRUCTIVE_KEYWORDS.test(ariaLabel)) {
    return true;
  }

  // Check text content (limited to first 200 chars to avoid scanning huge subtrees)
  const textContent = el.textContent?.trim().slice(0, 200);
  if (textContent && DESTRUCTIVE_KEYWORDS.test(textContent)) {
    return true;
  }

  // Check title attribute
  const title = el.getAttribute("title");
  if (title && DESTRUCTIVE_KEYWORDS.test(title)) {
    return true;
  }

  // Check for reset/submit inputs on forms with destructive action URLs
  if (el instanceof HTMLInputElement || el instanceof HTMLButtonElement) {
    const type = el.type?.toLowerCase();
    if (type === "reset" || type === "submit") {
      const form = el.closest("form");
      if (form) {
        const action = form.getAttribute("action") || "";
        if (DESTRUCTIVE_KEYWORDS.test(action)) {
          return true;
        }
      }
    }
  }

  return false;
}

// ============================================================================
// Interactable Detection
// ============================================================================

/**
 * Check if an element is interactable
 */
export function isInteractable(el: Element): boolean {
  const tagName = el.tagName.toLowerCase();

  // Check data-pillar-interactable attribute first (explicit marking)
  if (el.hasAttribute("data-pillar-interactable")) {
    return true;
  }

  // Check if it's an inherently interactable tag
  if (INTERACTABLE_TAGS.has(tagName)) {
    return true;
  }

  // Check ARIA role
  const role = el.getAttribute("role");
  if (role && INTERACTABLE_ROLES.has(role)) {
    return true;
  }

  // Check tabindex (explicitly focusable)
  const tabindex = el.getAttribute("tabindex");
  if (tabindex !== null && tabindex !== "-1") {
    return true;
  }

  // Check for contenteditable
  if (el.getAttribute("contenteditable") === "true") {
    return true;
  }

  // Check for onclick or other event attributes
  if (
    el.hasAttribute("onclick") ||
    el.hasAttribute("onkeydown") ||
    el.hasAttribute("onkeyup")
  ) {
    return true;
  }

  return false;
}

/**
 * Determine the interaction type for an element
 */
export function getInteractionType(el: Element): InteractionType {
  const tagName = el.tagName.toLowerCase();

  // Check explicit data attribute first
  const explicitType = el.getAttribute("data-pillar-interactable");
  if (explicitType && explicitType !== "true") {
    return explicitType as InteractionType;
  }

  // Determine by tag
  switch (tagName) {
    case "input": {
      const inputType = (el as HTMLInputElement).type.toLowerCase();
      switch (inputType) {
        case "checkbox":
        case "radio":
          return "toggle";
        case "submit":
        case "button":
        case "reset":
          return "click";
        case "file":
          return "select";
        default:
          return "input";
      }
    }
    case "textarea":
      return "input";
    case "select":
      return "select";
    case "button":
      return el.getAttribute("type") === "submit" ? "submit" : "click";
    case "a":
      return "click";
    case "details":
    case "summary":
      return "toggle";
    default:
      break;
  }

  // Check ARIA role
  const role = el.getAttribute("role");
  if (role) {
    switch (role) {
      case "button":
      case "link":
      case "menuitem":
      case "tab":
        return "click";
      case "checkbox":
      case "radio":
      case "switch":
        return "toggle";
      case "textbox":
      case "searchbox":
      case "combobox":
        return "input";
      case "listbox":
      case "option":
        return "select";
      case "slider":
      case "spinbutton":
        return "input";
      default:
        return "click";
    }
  }

  // Check contenteditable
  if (el.getAttribute("contenteditable") === "true") {
    return "input";
  }

  // Default to click for anything else
  return "click";
}

// ============================================================================
// Attribute Extraction
// ============================================================================

/**
 * Get the label text for an element
 */
function getElementLabel(el: Element): string | undefined {
  // Check aria-label first
  const ariaLabel = el.getAttribute("aria-label");
  if (ariaLabel) return ariaLabel;

  // Check aria-labelledby
  const labelledBy = el.getAttribute("aria-labelledby");
  if (labelledBy) {
    const labelEl = document.getElementById(labelledBy);
    if (labelEl) return labelEl.textContent?.trim() || undefined;
  }

  // Check for associated label (for form elements)
  if (
    el instanceof HTMLInputElement ||
    el instanceof HTMLSelectElement ||
    el instanceof HTMLTextAreaElement
  ) {
    if (el.id) {
      const label = document.querySelector(`label[for="${el.id}"]`);
      if (label) return label.textContent?.trim() || undefined;
    }

    // Check for wrapping label
    const parentLabel = el.closest("label");
    if (parentLabel) {
      // Get label text excluding the input itself
      const clone = parentLabel.cloneNode(true) as HTMLElement;
      const inputs = clone.querySelectorAll("input, select, textarea");
      inputs.forEach((input) => input.remove());
      const text = clone.textContent?.trim();
      if (text) return text;
    }
  }

  // Check title attribute
  const title = el.getAttribute("title");
  if (title) return title;

  return undefined;
}

// ============================================================================
// Selector Building & Ref Validation
// ============================================================================

/** Strict pattern for pillar ref IDs: pr-{base36counter} */
const PILLAR_REF_PATTERN = /^pr-[a-z0-9]+$/;

/**
 * Validate that a ref string matches the expected pillar ref format.
 * Prevents CSS selector injection from malformed/malicious ref values.
 *
 * @param ref - Ref string to validate
 * @returns true if the ref matches the expected format
 */
export function isValidPillarRef(ref: string): boolean {
  return PILLAR_REF_PATTERN.test(ref);
}

/**
 * Build full selector from short ref ID.
 * Converts "pr-abc" to '[data-pillar-ref="pr-abc"]'
 * Throws if the ref format is invalid to prevent CSS selector injection.
 *
 * @param shortRef - Short ref ID (e.g., "pr-abc")
 * @returns Full CSS selector for querySelector
 * @throws Error if the ref format is invalid
 */
export function buildSelectorFromRef(shortRef: string): string {
  if (!isValidPillarRef(shortRef)) {
    throw new Error(`Invalid pillar ref format: "${shortRef}"`);
  }
  return `[data-pillar-ref="${shortRef}"]`;
}

// ============================================================================
// Optimized Direct-to-Text Scanner (No AST)
// ============================================================================

/**
 * Truncate a string to a maximum length, appending "..." if truncated.
 */
function truncateLabel(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "...";
}

/**
 * Get a human-readable label directly from a DOM element for compact output.
 * All label sources are truncated to maxLength for consistent output size.
 */
function getElementLabelForCompact(el: Element, maxLength: number): string {
  // Try the existing getElementLabel first
  const label = getElementLabel(el);
  if (label) return truncateLabel(label, maxLength);

  // Check placeholder
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    if (el.placeholder) return truncateLabel(el.placeholder, maxLength);
  }

  // Check inner text (for buttons, links, etc.)
  const innerText = el.textContent?.trim();
  if (innerText && innerText.length > 0) {
    return truncateLabel(innerText, maxLength);
  }

  // Check name attribute
  const name = el.getAttribute("name");
  if (name) return truncateLabel(name, maxLength);

  // Check id
  if (el.id) return truncateLabel(el.id, maxLength);

  // Fallback to tag name
  return el.tagName.toLowerCase();
}

/** Context for direct scanning */
interface DirectScanContext {
  lines: string[];
  refs: Set<string>;
  interactableCount: number;
  totalLength: number;
  budgetExhausted: boolean;
  maxDepth: number;
  options: Required<Omit<ScanOptions, "root" | "excludeSelector">> & {
    excludeSelector?: string;
  };
}

/**
 * Recursively traverse DOM and output text directly (no AST).
 */
function traverseDOMDirect(
  node: Node,
  ctx: DirectScanContext,
  depth: number
): void {
  // Track max depth
  if (depth > ctx.maxDepth) {
    ctx.maxDepth = depth;
  }

  // Check depth limit
  if (depth > ctx.options.maxDepth) {
    return;
  }

  // Handle text nodes
  if (node.nodeType === Node.TEXT_NODE) {
    if (ctx.options.includeText && !ctx.budgetExhausted) {
      const text = node.textContent?.trim();
      if (text && text.length >= ctx.options.minTextLength) {
        // Truncate long text
        const truncated =
          text.length > ctx.options.maxTextLength
            ? text.slice(0, ctx.options.maxTextLength) + "..."
            : text;
        const lineLength = truncated.length + 1; // +1 for newline join
        if (ctx.totalLength + lineLength > ctx.options.maxTotalLength) {
          ctx.budgetExhausted = true;
          return;
        }
        ctx.lines.push(truncated);
        ctx.totalLength += lineLength;
      }
    }
    return;
  }

  // Handle element nodes
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return;
  }

  const el = node as Element;
  const tagName = el.tagName.toLowerCase();

  // Skip certain tags
  if (SKIP_TAGS.has(tagName)) {
    return;
  }

  // Check exclude selector
  if (ctx.options.excludeSelector) {
    try {
      if (el.matches(ctx.options.excludeSelector)) {
        return;
      }
    } catch {
      // Invalid selector, ignore
    }
  }

  // Check visibility
  if (ctx.options.visibleOnly && !isElementVisible(el)) {
    return;
  }

  // Skip redacted subtrees entirely — no text, no interactables, no recursion
  if (el.hasAttribute("data-pillar-redact")) {
    return;
  }

  // Check if interactable — skip individually redacted elements (e.g. password inputs)
  if (isInteractable(el)) {
    if (isRedacted(el)) {
      return;
    }

    const interactionType = getInteractionType(el);
    const label = getElementLabelForCompact(el, ctx.options.maxLabelLength);

    // Reuse existing ref if present (for delta scans), otherwise generate a new one
    let refId = el.getAttribute("data-pillar-ref");
    if (!refId) {
      refId = generateRefId();
      el.setAttribute("data-pillar-ref", refId);
    }

    // Track ref for delta computation
    ctx.refs.add(refId);

    // Output in format: TYPE: label [[ref]]
    const line = `${interactionType.toUpperCase()}: ${label} [[${refId}]]`;
    ctx.lines.push(line);
    ctx.totalLength += line.length + 1;
    ctx.interactableCount++;
  }

  // Recurse into children
  for (const child of el.childNodes) {
    traverseDOMDirect(child, ctx, depth + 1);
  }
}

/**
 * Optimized single-pass DOM scanner that outputs compact text directly.
 * Skips the intermediate AST for better performance.
 *
 * @param options - Scan options
 * @returns Compact scan result with text content ready for LLM
 *
 * @example
 * ```typescript
 * const result = scanPageDirect();
 * console.log(result.content);
 * // === PAGE: My App | /dashboard ===
 * // Welcome to your dashboard
 * // CLICK: Create Report [[pr-a1]]
 * // === 5 interactable elements ===
 * ```
 */
export function scanPageDirect(options?: ScanOptions): CompactScanResult {
  // Clear any existing pillar refs before scanning
  clearPillarRefs();

  const root = options?.root || document.body;

  const ctx: DirectScanContext = {
    lines: [],
    refs: new Set(),
    interactableCount: 0,
    totalLength: 0,
    budgetExhausted: false,
    maxDepth: 0,
    options: {
      ...DEFAULT_SCAN_OPTIONS,
      ...options,
    },
  };

  // Add header
  ctx.lines.push(
    `=== PAGE: ${document.title} | ${window.location.pathname} ===`
  );
  ctx.lines.push("");

  // Single-pass traversal
  traverseDOMDirect(root, ctx, 0);

  // Add footer
  ctx.lines.push("");
  ctx.lines.push(`=== ${ctx.interactableCount} interactable elements ===`);

  // Store scan state for future delta comparisons
  lastScanLines = new Set(ctx.lines);
  lastScanRefs = new Set(ctx.refs);

  return {
    content: ctx.lines.join("\n"),
    interactableCount: ctx.interactableCount,
    timestamp: Date.now(),
    url: window.location.href,
    title: document.title,
  };
}

/**
 * Delta DOM scanner that only returns changes since the last scan.
 * Reuses existing refs on elements, assigns new refs only to new elements.
 * Compares output lines against the previous scan to find new content.
 *
 * Must be called after an initial `scanPageDirect()` which establishes
 * the baseline. If called without a prior scan, behaves like a full scan
 * but without the header/footer framing.
 *
 * @param options - Scan options
 * @returns Delta scan result with only new lines and removed ref IDs
 */
export function scanPageDelta(options?: ScanOptions): DeltaScanResult {
  // Do NOT clear refs — reuse existing ones on elements that still have them
  const root = options?.root || document.body;

  const ctx: DirectScanContext = {
    lines: [],
    refs: new Set(),
    interactableCount: 0,
    totalLength: 0,
    budgetExhausted: false,
    maxDepth: 0,
    options: {
      ...DEFAULT_SCAN_OPTIONS,
      ...options,
    },
  };

  // Traverse DOM reusing existing refs, assigning new ones where needed
  traverseDOMDirect(root, ctx, 0);

  // Compute new lines (in current scan but not in last scan)
  const newLines = ctx.lines.filter((line) => !lastScanLines.has(line));

  // Compute removed refs (in last scan but no longer visible/interactable)
  const removedRefs = [...lastScanRefs].filter((ref) => !ctx.refs.has(ref));

  // Count new interactable elements (lines with ref markers)
  const refPattern = /\[\[pr-[a-z0-9]+\]\]$/;
  const newInteractableCount = newLines.filter((line) =>
    refPattern.test(line)
  ).length;

  const hasChanges = newLines.length > 0 || removedRefs.length > 0;

  // Update stored state for next delta
  lastScanLines = new Set(ctx.lines);
  lastScanRefs = new Set(ctx.refs);

  // Format content string for LLM
  let content: string | null = null;
  if (hasChanges) {
    const parts: string[] = [];

    if (newLines.length > 0) {
      parts.push(...newLines);
      parts.push("");
    }

    // Footer with summary
    const removedStr =
      removedRefs.length > 0
        ? `, ${removedRefs.length} removed: ${removedRefs.join(", ")}`
        : "";
    parts.push(
      `=== ${newInteractableCount} new${removedStr} ===`
    );

    content = parts.join("\n");
  }

  return {
    content,
    removedRefs,
    newInteractableCount,
    totalInteractableCount: ctx.refs.size,
    hasChanges,
    timestamp: Date.now(),
    url: window.location.href,
    title: document.title,
  };
}
