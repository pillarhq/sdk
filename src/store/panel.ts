/**
 * Panel Store
 * Signal-based state for panel open/close and configuration
 */

import { signal, computed } from '@preact/signals';
import type { PanelPosition, PanelMode } from '../core/config';

// ============================================================================
// Panel Open State Persistence
// ============================================================================

const PANEL_OPEN_STORAGE_KEY = 'pillar:panel_open';

/**
 * Load panel open state from localStorage.
 * Returns false if not set or on error.
 */
function loadPanelOpenState(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const stored = localStorage.getItem(PANEL_OPEN_STORAGE_KEY);
    return stored === 'true';
  } catch {
    return false;
  }
}

/**
 * Save panel open state to localStorage.
 */
function savePanelOpenState(open: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PANEL_OPEN_STORAGE_KEY, String(open));
  } catch {
    // Silently fail - localStorage may be unavailable
  }
}

// ============================================================================
// Panel State Signals
// ============================================================================

// Panel visibility state (initialized from localStorage for persistence across refreshes)
export const isOpen = signal(loadPanelOpenState());

// Active tab (which tab is currently selected)
export const activeTab = signal<string>('assistant');

// Panel position (left or right)
export const position = signal<PanelPosition>('right');

// Panel mode (overlay or push)
export const mode = signal<PanelMode>('overlay');

// Panel width
export const width = signal(380);

// Responsive hover breakpoint settings
// Viewport width below which panel switches to hover mode (false = always push)
export const hoverBreakpoint = signal<number | false>(1200);

// Whether to show backdrop when in hover mode
export const hoverBackdrop = signal(true);

// Viewport width below which the edge trigger hides and mobile trigger shows
export const mobileBreakpoint = signal(700);

// Viewport width below which the panel takes full screen width
export const fullWidthBreakpoint = signal(500);

// Current viewport width (updated by resize listener)
export const viewportWidth = signal(typeof window !== 'undefined' ? window.innerWidth : 1920);

// Resize listener cleanup function
let resizeCleanup: (() => void) | null = null;

/**
 * Whether the panel is currently in hover mode based on viewport width
 * Returns true when viewport is below hoverBreakpoint (and breakpoint is not disabled)
 */
export const isHoverMode = computed(() => {
  const bp = hoverBreakpoint.value;
  // If breakpoint is false, never use hover mode
  if (bp === false) return false;
  // Check if viewport is below breakpoint
  return viewportWidth.value < bp;
});

/**
 * Whether we're in mobile mode (below mobileBreakpoint)
 * When true, edge trigger hides and mobile trigger shows
 */
export const isMobileMode = computed(() => {
  return viewportWidth.value < mobileBreakpoint.value;
});

/**
 * Whether the panel should take full screen width
 * Returns true when viewport is below fullWidthBreakpoint
 */
export const isFullWidth = computed(() => {
  return viewportWidth.value < fullWidthBreakpoint.value;
});

/**
 * The effective panel mode based on responsive breakpoint
 * Returns 'overlay' when in hover mode (below breakpoint), otherwise returns configured mode
 */
export const effectiveMode = computed((): PanelMode => {
  if (isHoverMode.value) {
    return 'overlay';
  }
  return mode.value;
});

// Computed panel CSS class
export const panelClass = computed(() => {
  const classes = ['pillar-panel', `pillar-panel--${position.value}`];
  if (isOpen.value) {
    classes.push('pillar-panel--open');
  }
  return classes.join(' ');
});

// Actions
export const openPanel = () => {
  isOpen.value = true;
  savePanelOpenState(true);
  // Only prevent body scroll in overlay/hover mode
  if (effectiveMode.value === 'overlay') {
    document.body.style.overflow = 'hidden';
  }
};

export const closePanel = () => {
  isOpen.value = false;
  savePanelOpenState(false);
  // Restore body scroll
  if (effectiveMode.value === 'overlay') {
    document.body.style.overflow = '';
  }
};

export const togglePanel = () => {
  if (isOpen.value) {
    closePanel();
  } else {
    openPanel();
  }
};

export const setPosition = (pos: PanelPosition) => {
  position.value = pos;
};

export const setMode = (m: PanelMode) => {
  mode.value = m;
};

export const setWidth = (w: number) => {
  width.value = w;
};

export const setHoverBreakpoint = (bp: number | false) => {
  hoverBreakpoint.value = bp;
};

export const setHoverBackdrop = (show: boolean) => {
  hoverBackdrop.value = show;
};

export const setMobileBreakpoint = (bp: number) => {
  mobileBreakpoint.value = bp;
};

export const setFullWidthBreakpoint = (bp: number) => {
  fullWidthBreakpoint.value = bp;
};

export const setActiveTab = (tabId: string) => {
  activeTab.value = tabId;
};

/**
 * Initialize the viewport resize listener for responsive behavior
 * Should be called once during SDK initialization
 */
export const initViewportListener = () => {
  if (typeof window === 'undefined') return;
  
  // Clean up existing listener if any
  resizeCleanup?.();
  
  const handleResize = () => {
    viewportWidth.value = window.innerWidth;
  };
  
  // Update initial value
  viewportWidth.value = window.innerWidth;
  
  // Add resize listener
  window.addEventListener('resize', handleResize);
  
  resizeCleanup = () => {
    window.removeEventListener('resize', handleResize);
  };
};

/**
 * Clean up the viewport resize listener
 */
export const destroyViewportListener = () => {
  resizeCleanup?.();
  resizeCleanup = null;
};

// Reset panel state
export const resetPanel = () => {
  isOpen.value = false;
  savePanelOpenState(false);
  activeTab.value = 'assistant';
  // Always clear overflow on reset
  document.body.style.overflow = '';
};

