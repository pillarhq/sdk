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
  type InteractionType,
  type ScanOptions,
} from "../types/dom-scanner";

// ============================================================================
// Pillar Ref Management
// ============================================================================

/** Counter for generating unique ref IDs */
let refCounter = 0;

/**
 * Generate a unique ref ID for data-pillar-ref attribute
 */
function generateRefId(): string {
  return `pr-${Date.now().toString(36)}-${(refCounter++).toString(36)}`;
}

/**
 * Clear all pillar refs from the DOM.
 * Called before scanning to remove stale refs.
 */
export function clearPillarRefs(): void {
  document
    .querySelectorAll("[data-pillar-ref]")
    .forEach((el) => el.removeAttribute("data-pillar-ref"));
  // Reset counter for cleaner IDs
  refCounter = 0;
}

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
// Selector Building
// ============================================================================

/**
 * Build full selector from short ref ID.
 * Converts "pr-abc" to '[data-pillar-ref="pr-abc"]'
 *
 * @param shortRef - Short ref ID (e.g., "pr-abc")
 * @returns Full CSS selector for querySelector
 */
export function buildSelectorFromRef(shortRef: string): string {
  return `[data-pillar-ref="${shortRef}"]`;
}

// ============================================================================
// Optimized Direct-to-Text Scanner (No AST)
// ============================================================================

/**
 * Get a human-readable label directly from a DOM element for compact output.
 */
function getElementLabelForCompact(el: Element): string {
  // Try the existing getElementLabel first
  const label = getElementLabel(el);
  if (label) return label;

  // Check placeholder
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    if (el.placeholder) return el.placeholder;
  }

  // Check inner text (for buttons, links, etc.) - limited length
  const innerText = el.textContent?.trim();
  if (innerText && innerText.length <= 50) {
    return innerText;
  }

  // Check name attribute
  const name = el.getAttribute("name");
  if (name) return name;

  // Check id
  if (el.id) return el.id;

  // Fallback to tag name
  return el.tagName.toLowerCase();
}

/** Context for direct scanning */
interface DirectScanContext {
  lines: string[];
  interactableCount: number;
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
    if (ctx.options.includeText) {
      const text = node.textContent?.trim();
      if (text && text.length >= ctx.options.minTextLength) {
        // Truncate long text
        const truncated =
          text.length > ctx.options.maxTextLength
            ? text.slice(0, ctx.options.maxTextLength) + "..."
            : text;
        ctx.lines.push(truncated);
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

  // Check if interactable
  if (isInteractable(el)) {
    const interactionType = getInteractionType(el);
    const label = getElementLabelForCompact(el);
    const refId = generateRefId();

    // Add data-pillar-ref attribute to the element
    el.setAttribute("data-pillar-ref", refId);

    // Output in format: TYPE: label [[ref]]
    ctx.lines.push(`${interactionType.toUpperCase()}: ${label} [[${refId}]]`);
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
    interactableCount: 0,
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

  return {
    content: ctx.lines.join("\n"),
    interactableCount: ctx.interactableCount,
    timestamp: Date.now(),
    url: window.location.href,
    title: document.title,
  };
}
