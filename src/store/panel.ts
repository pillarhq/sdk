/**
 * Panel Store
 * Signal-based state for panel open/close and configuration
 */

import { signal, computed } from '@preact/signals';
import type { PanelPosition, PanelMode } from '../core/config';

// Panel visibility state
export const isOpen = signal(false);

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
  // Only prevent body scroll in overlay/hover mode
  if (effectiveMode.value === 'overlay') {
    document.body.style.overflow = 'hidden';
  }
};

export const closePanel = () => {
  isOpen.value = false;
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
  activeTab.value = 'assistant';
  // Always clear overflow on reset
  document.body.style.overflow = '';
};

