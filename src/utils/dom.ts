/**
 * DOM Utilities for Pillar SDK
 */

/**
 * Creates an HTML element with the given tag name and attributes
 */
export function createElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attributes?: Record<string, string>,
  children?: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  
  if (attributes) {
    for (const [key, value] of Object.entries(attributes)) {
      if (key === 'className') {
        element.className = value;
      } else if (key === 'innerHTML') {
        element.innerHTML = value;
      } else if (key === 'textContent') {
        element.textContent = value;
      } else {
        element.setAttribute(key, value);
      }
    }
  }
  
  if (children) {
    for (const child of children) {
      if (typeof child === 'string') {
        element.appendChild(document.createTextNode(child));
      } else {
        element.appendChild(child);
      }
    }
  }
  
  return element;
}

/**
 * Safely inserts CSS into a Shadow DOM or document
 */
export function injectStyles(
  container: ShadowRoot | Document,
  css: string,
  id?: string
): HTMLStyleElement {
  const style = document.createElement('style');
  if (id) {
    style.id = id;
  }
  style.textContent = css;
  
  if (container instanceof Document) {
    container.head.appendChild(style);
  } else {
    container.appendChild(style);
  }
  
  return style;
}

/**
 * Gets the scrollable parent of an element
 */
export function getScrollParent(element: Element): Element | null {
  let parent = element.parentElement;
  
  while (parent) {
    const { overflow, overflowY, overflowX } = getComputedStyle(parent);
    
    if (/(auto|scroll)/.test(overflow + overflowY + overflowX)) {
      return parent;
    }
    
    parent = parent.parentElement;
  }
  
  return null;
}

/**
 * Gets the viewport dimensions
 */
export function getViewportDimensions(): { width: number; height: number } {
  return {
    width: window.innerWidth || document.documentElement.clientWidth,
    height: window.innerHeight || document.documentElement.clientHeight,
  };
}

/**
 * Checks if an element is visible in the viewport
 */
export function isElementInViewport(element: Element): boolean {
  const rect = element.getBoundingClientRect();
  const { width, height } = getViewportDimensions();
  
  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= height &&
    rect.right <= width
  );
}

/**
 * Waits for the DOM to be ready
 */
export function domReady(): Promise<void> {
  return new Promise((resolve) => {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => resolve(), { once: true });
    } else {
      resolve();
    }
  });
}

/**
 * Escapes HTML special characters
 */
export function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Debounces a function
 */
export function debounce<T extends unknown[]>(
  fn: (...args: T) => void,
  delay: number
): (...args: T) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  
  return (...args: T) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Throttles a function
 */
export function throttle<T extends unknown[]>(
  fn: (...args: T) => void,
  limit: number
): (...args: T) => void {
  let inThrottle = false;
  
  return (...args: T) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}

/**
 * Generates a unique ID
 */
export function uniqueId(prefix = 'pillar'): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

