/**
 * Panel CSS Styles
 * Complete styling for the help panel (injected into Shadow DOM)
 * 
 * Class naming convention:
 * - Internal classes (_pillar-*): Apply all default styles
 * - Public classes (pillar-*): Empty by default, for user overrides
 * 
 * Each element renders both classes, e.g.: class="_pillar-header pillar-header"
 */

import type { ResolvedThemeConfig, ThemeColors } from '../../core/config';

/**
 * Generate CSS variable overrides from theme colors
 */
export function generateThemeVariables(colors: ThemeColors, prefix = ''): string {
  const lines: string[] = [];
  
  if (colors.primary) lines.push(`--pillar-primary${prefix}: ${colors.primary};`);
  if (colors.primaryHover) lines.push(`--pillar-primary-hover${prefix}: ${colors.primaryHover};`);
  if (colors.background) lines.push(`--pillar-bg${prefix}: ${colors.background};`);
  if (colors.backgroundSecondary) lines.push(`--pillar-bg-secondary${prefix}: ${colors.backgroundSecondary};`);
  if (colors.text) lines.push(`--pillar-text${prefix}: ${colors.text};`);
  if (colors.textMuted) lines.push(`--pillar-text-muted${prefix}: ${colors.textMuted};`);
  if (colors.border) lines.push(`--pillar-border${prefix}: ${colors.border};`);
  if (colors.borderLight) lines.push(`--pillar-border-light${prefix}: ${colors.borderLight};`);
  
  return lines.join('\n    ');
}

/**
 * Generate custom theme CSS from config
 */
export function generateThemeCSS(theme: ResolvedThemeConfig): string {
  const lightOverrides = generateThemeVariables(theme.colors);
  const darkOverrides = generateThemeVariables(theme.darkColors);
  
  let css = '';
  
  // Light mode overrides
  if (lightOverrides) {
    css += `
:host {
    ${lightOverrides}
}
`;
  }
  
  // Dark mode overrides - apply when in dark mode (either manual or auto)
  if (darkOverrides) {
    css += `
@media (prefers-color-scheme: dark) {
  :host:not([data-theme="light"]) {
    ${darkOverrides}
  }
}
:host([data-theme="dark"]) {
    ${darkOverrides}
}
`;
  }
  
  return css;
}

export const PANEL_STYLES = `
/* ============================================================================
   CSS Custom Properties (Variables)
   Users can override these to customize colors
   ============================================================================ */

:host {
  /* Core colors - Light mode (default) */
  --pillar-primary: #2563eb;
  --pillar-primary-hover: #1d4ed8;
  --pillar-primary-light: #eff6ff;
  --pillar-primary-light-hover: #dbeafe;
  
  --pillar-bg: #ffffff;
  --pillar-bg-secondary: #f9fafb;
  --pillar-bg-tertiary: #f3f4f6;
  
  --pillar-text: #1a1a1a;
  --pillar-text-secondary: #374151;
  --pillar-text-muted: #6b7280;
  --pillar-text-placeholder: #9ca3af;
  
  --pillar-border: #e5e7eb;
  --pillar-border-light: #f3f4f6;
  
  /* Shadows */
  --pillar-shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --pillar-shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  
  /* Code blocks */
  --pillar-code-bg: #1f2937;
  --pillar-code-text: #e5e7eb;
  
  /* Scrollbar */
  --pillar-scrollbar-track: transparent;
  --pillar-scrollbar-thumb: #d1d5db;
  --pillar-scrollbar-thumb-hover: #9ca3af;
  
  /* Spacing (can be customized) */
  --pillar-panel-width: 380px;
  --pillar-spacing-xs: 4px;
  --pillar-spacing-sm: 8px;
  --pillar-spacing-md: 12px;
  --pillar-spacing-lg: 16px;
  --pillar-spacing-xl: 20px;
  --pillar-spacing-2xl: 24px;
  
  /* Border radius */
  --pillar-radius-sm: 4px;
  --pillar-radius-md: 6px;
  --pillar-radius-lg: 8px;
  --pillar-radius-xl: 10px;
  --pillar-radius-full: 9999px;
  
  /* Typography */
  --pillar-font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  --pillar-font-mono: 'SF Mono', Consolas, monospace;
  --pillar-font-size-xs: 11px;
  --pillar-font-size-sm: 12px;
  --pillar-font-size-base: 14px;
  --pillar-font-size-md: 15px;
  --pillar-font-size-lg: 16px;
  --pillar-font-size-xl: 18px;
  --pillar-font-size-2xl: 20px;
  
  /* Animation */
  --pillar-transition-fast: 0.15s ease;
  --pillar-transition-normal: 0.3s ease;
}

/* Dark mode - Auto-detect from system preference */
@media (prefers-color-scheme: dark) {
  :host:not([data-theme="light"]) {
    --pillar-primary: #3b82f6;
    --pillar-primary-hover: #60a5fa;
    --pillar-primary-light: #1e3a5f;
    --pillar-primary-light-hover: #1e4976;
    
    --pillar-bg: #1a1a1a;
    --pillar-bg-secondary: #262626;
    --pillar-bg-tertiary: #333333;
    
    --pillar-text: #f5f5f5;
    --pillar-text-secondary: #e5e5e5;
    --pillar-text-muted: #a3a3a3;
    --pillar-text-placeholder: #737373;
    
    --pillar-border: #404040;
    --pillar-border-light: #333333;
    
    --pillar-shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
    --pillar-shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.4);
    
    --pillar-code-bg: #0d0d0d;
    --pillar-code-text: #e5e7eb;
    
    --pillar-scrollbar-thumb: #525252;
    --pillar-scrollbar-thumb-hover: #737373;
  }
}

/* Dark mode - Manual override */
:host([data-theme="dark"]) {
  --pillar-primary: #3b82f6;
  --pillar-primary-hover: #60a5fa;
  --pillar-primary-light: #1e3a5f;
  --pillar-primary-light-hover: #1e4976;
  
  --pillar-bg: #1a1a1a;
  --pillar-bg-secondary: #262626;
  --pillar-bg-tertiary: #333333;
  
  --pillar-text: #f5f5f5;
  --pillar-text-secondary: #e5e5e5;
  --pillar-text-muted: #a3a3a3;
  --pillar-text-placeholder: #737373;
  
  --pillar-border: #404040;
  --pillar-border-light: #333333;
  
  --pillar-shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
  --pillar-shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.4);
  
  --pillar-code-bg: #0d0d0d;
  --pillar-code-text: #e5e7eb;
  
  --pillar-scrollbar-thumb: #525252;
  --pillar-scrollbar-thumb-hover: #737373;
}

/* ============================================================================
   Base Styles
   Note: No CSS reset - we rely on explicit styles for SDK components
   and allow custom cards to inherit host app styling (Tailwind, etc.)
   ============================================================================ */

:host {
  font-family: var(--pillar-font-family);
  font-size: var(--pillar-font-size-base);
  line-height: 1.5;
  color: var(--pillar-text);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* ============================================================================
   Panel Container
   Internal: _pillar-panel | Public: pillar-panel
   ============================================================================ */

._pillar-panel {
  position: fixed;
  top: 0;
  bottom: 0;
  width: var(--pillar-panel-width);
  max-width: 100vw;
  background: var(--pillar-bg);
  border-left: 1px solid var(--pillar-border);
  display: flex;
  flex-direction: column;
  z-index: 99999;
  transform: translateX(100%);
  transition: transform var(--pillar-transition-normal);
}

._pillar-panel--right {
  right: 0;
}

._pillar-panel--left {
  left: 0;
  border-left: none;
  border-right: 1px solid var(--pillar-border);
  transform: translateX(-100%);
}

._pillar-panel--open {
  transform: translateX(0);
}

._pillar-panel--manual {
  position: static;
  transform: none;
  height: 100%;
}

._pillar-panel-root {
  display: flex;
  flex-direction: column;
  height: 100%;
}

._pillar-panel-ui {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

/* Public override classes - empty by default */
.pillar-panel {}
.pillar-panel-root {}
.pillar-panel-ui {}

/* ============================================================================
   Backdrop
   ============================================================================ */

._pillar-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.3);
  opacity: 0;
  visibility: hidden;
  transition: opacity var(--pillar-transition-normal), visibility var(--pillar-transition-normal);
  z-index: 99998;
}

._pillar-backdrop--visible {
  opacity: 1;
  visibility: visible;
}

.pillar-backdrop {}

/* ============================================================================
   Header
   Internal: _pillar-header | Public: pillar-header
   ============================================================================ */

._pillar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--pillar-spacing-lg) var(--pillar-spacing-xl);
  border-bottom: 1px solid var(--pillar-border);
  flex-shrink: 0;
  background: var(--pillar-bg);
}

._pillar-header-left {
  display: flex;
  align-items: center;
  gap: var(--pillar-spacing-sm);
}

._pillar-header-title {
  font-size: var(--pillar-font-size-lg);
  font-weight: 600;
  color: var(--pillar-text);
}

/* Public override classes */
.pillar-header {}
.pillar-header-left {}
.pillar-header-title {}

/* ============================================================================
   Icon Buttons (back, home, close)
   Internal: _pillar-icon-btn | Public: pillar-icon-btn
   ============================================================================ */

._pillar-icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  color: var(--pillar-text-muted);
  background: none;
  border: none;
  border-radius: var(--pillar-radius-md);
  cursor: pointer;
  transition: color var(--pillar-transition-fast), background var(--pillar-transition-fast);
}

._pillar-icon-btn:hover {
  color: var(--pillar-text);
  background: var(--pillar-bg-tertiary);
}

._pillar-icon-btn svg {
  width: 20px;
  height: 20px;
}

.pillar-icon-btn {}
.pillar-back-btn {}
.pillar-home-btn {}
.pillar-close-btn {}

/* ============================================================================
   Content Area
   Internal: _pillar-content | Public: pillar-content
   ============================================================================ */

._pillar-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  min-height: 0;
}

.pillar-content {}

/* ============================================================================
   Search Input
   Internal: _pillar-search | Public: pillar-search
   ============================================================================ */

._pillar-search {
  position: relative;
  padding: var(--pillar-spacing-lg) var(--pillar-spacing-xl);
}

._pillar-search-input {
  width: 100%;
  padding: 10px 12px 10px 40px;
  font-size: var(--pillar-font-size-base);
  font-family: var(--pillar-font-family);
  color: var(--pillar-text);
  background: var(--pillar-bg-secondary);
  border: 1px solid var(--pillar-border);
  border-radius: var(--pillar-radius-lg);
  outline: none;
  transition: border-color var(--pillar-transition-fast), box-shadow var(--pillar-transition-fast);
}

._pillar-search-input:focus {
  border-color: var(--pillar-primary);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

._pillar-search-input::placeholder {
  color: var(--pillar-text-placeholder);
}

._pillar-search-icon {
  position: absolute;
  left: 32px;
  top: 50%;
  transform: translateY(-50%);
  width: 18px;
  height: 18px;
  color: var(--pillar-text-placeholder);
  pointer-events: none;
}

._pillar-search-icon svg {
  width: 18px;
  height: 18px;
}

.pillar-search {}
.pillar-search-input {}
.pillar-search-icon {}

/* ============================================================================
   Chat Input (Persistent Bottom)
   Internal: _pillar-chat-input | Public: pillar-chat-input
   ============================================================================ */

._pillar-chat-input-container {
  flex-shrink: 0;
  border-top: 1px solid var(--pillar-border);
  background: var(--pillar-bg);
  display: flex;
  flex-direction: column;
  max-height: 50%;
  transition: max-height var(--pillar-transition-normal);
}

._pillar-chat-input-container--expanded {
  max-height: 60%;
}

._pillar-chat-input-messages {
  flex: 1;
  overflow-y: auto;
  padding: 0;
  max-height: 0;
  transition: max-height var(--pillar-transition-normal), padding var(--pillar-transition-normal);
}

._pillar-chat-input-container--expanded ._pillar-chat-input-messages {
  max-height: 300px;
  padding: var(--pillar-spacing-lg) var(--pillar-spacing-xl);
}

._pillar-chat-input-message {
  margin-bottom: var(--pillar-spacing-md);
}

._pillar-chat-input-message--user {
  text-align: right;
}

._pillar-chat-input-message-content {
  display: inline-block;
  max-width: 85%;
  padding: 10px 14px;
  border-radius: var(--pillar-spacing-lg);
  font-size: var(--pillar-font-size-base);
  line-height: 1.5;
}

._pillar-chat-input-message--user ._pillar-chat-input-message-content {
  background: var(--pillar-primary);
  color: #ffffff;
  border-bottom-right-radius: var(--pillar-radius-sm);
}

._pillar-chat-input-message--assistant ._pillar-chat-input-message-content {
  background: var(--pillar-bg-tertiary);
  color: var(--pillar-text);
  border-bottom-left-radius: var(--pillar-radius-sm);
}

._pillar-chat-input-sources {
  margin-top: var(--pillar-spacing-sm);
  padding-top: var(--pillar-spacing-sm);
  border-top: 1px solid var(--pillar-border);
}

._pillar-chat-input-sources-title {
  font-size: var(--pillar-font-size-xs);
  font-weight: 500;
  color: var(--pillar-text-muted);
  margin-bottom: 6px;
}

._pillar-chat-input-source {
  display: block;
  padding: 6px 10px;
  margin-bottom: var(--pillar-spacing-xs);
  font-size: var(--pillar-font-size-sm);
  color: var(--pillar-primary);
  background: var(--pillar-primary-light);
  border-radius: var(--pillar-radius-md);
  text-decoration: none;
  cursor: pointer;
}

._pillar-chat-input-source:hover {
  background: var(--pillar-primary-light-hover);
}

._pillar-chat-input-area {
  padding: var(--pillar-spacing-md) var(--pillar-spacing-lg);
}

._pillar-chat-input-wrapper {
  display: flex;
  flex-direction: column;
  background: var(--pillar-bg-secondary);
  border: 1px solid var(--pillar-border);
  border-radius: var(--pillar-radius-xl);
  transition: border-color var(--pillar-transition-fast), box-shadow var(--pillar-transition-fast);
}

._pillar-chat-input-wrapper:focus-within {
  border-color: var(--pillar-primary);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

._pillar-chat-input-textarea {
  display: block;
  width: 100%;
  padding: 12px 14px 8px;
  font-size: var(--pillar-font-size-base);
  font-family: var(--pillar-font-family);
  line-height: 1.5;
  color: var(--pillar-text);
  background: transparent;
  border: none;
  outline: none;
  resize: none;
  overflow-y: hidden;
  box-sizing: border-box;
}

._pillar-chat-input-textarea::placeholder {
  color: var(--pillar-text-placeholder);
}

.pillar-chat-input-container {}
.pillar-chat-input-messages {}
.pillar-chat-input-message {}
.pillar-chat-input-message-content {}
.pillar-chat-input-sources {}
.pillar-chat-input-area {}
.pillar-chat-input-wrapper {}
.pillar-chat-input-textarea {}

/* ============================================================================
   Chat Input Footer (contains send button)
   ============================================================================ */

._pillar-chat-input-footer {
  display: flex;
  justify-content: flex-end;
  padding: 8px 10px;
}

/* ============================================================================
   Send Button - In footer row, right aligned
   Internal: _pillar-send-btn | Public: pillar-send-btn
   ============================================================================ */

._pillar-send-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  color: var(--pillar-text-muted);
  background: var(--pillar-bg-tertiary);
  border: none;
  border-radius: var(--pillar-radius-md);
  cursor: pointer;
  flex-shrink: 0;
  transition: all var(--pillar-transition-fast);
}

._pillar-send-btn:hover:not(:disabled) {
  color: #ffffff;
  background: var(--pillar-primary);
}

._pillar-send-btn:disabled {
  color: var(--pillar-text-placeholder);
  background: var(--pillar-bg-tertiary);
  cursor: not-allowed;
}

._pillar-send-btn svg {
  width: 16px;
  height: 16px;
}

.pillar-send-btn {}
.pillar-chat-input-footer {}

/* ============================================================================
   Loading States
   Internal: _pillar-loading | Public: pillar-loading
   ============================================================================ */

._pillar-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px var(--pillar-spacing-xl);
  color: var(--pillar-text-muted);
}

._pillar-loading-spinner {
  width: 24px;
  height: 24px;
  border: 2px solid var(--pillar-border);
  border-top-color: var(--pillar-primary);
  border-radius: 50%;
  animation: pillar-spin 0.8s linear infinite;
}

@keyframes pillar-spin {
  to { transform: rotate(360deg); }
}

.pillar-loading {}
.pillar-loading-spinner {}

/* ============================================================================
   Progress Indicator (AI activity status)
   Internal: _pillar-progress | Public: pillar-progress
   ============================================================================ */

._pillar-progress-indicator {
  display: flex;
  align-items: center;
  gap: var(--pillar-spacing-sm);
  padding: var(--pillar-spacing-sm) 0;
}

._pillar-progress-indicator ._pillar-loading-spinner {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

._pillar-progress-message {
  font-size: var(--pillar-font-size-sm);
  color: var(--pillar-text-muted);
  font-style: italic;
}

.pillar-progress-indicator {}
.pillar-progress-message {}

/* ============================================================================
   Empty States
   Internal: _pillar-empty | Public: pillar-empty
   ============================================================================ */

._pillar-empty {
  padding: 40px var(--pillar-spacing-xl);
  text-align: center;
  color: var(--pillar-text-muted);
}

._pillar-empty-icon {
  width: 48px;
  height: 48px;
  margin: 0 auto var(--pillar-spacing-lg);
  color: var(--pillar-border);
}

._pillar-empty-title {
  font-size: var(--pillar-font-size-lg);
  font-weight: 500;
  color: var(--pillar-text);
  margin-bottom: var(--pillar-spacing-xs);
}

._pillar-empty-description {
  font-size: var(--pillar-font-size-base);
}

.pillar-empty {}
.pillar-empty-icon {}
.pillar-empty-title {}
.pillar-empty-description {}

/* ============================================================================
   Section Titles
   Internal: _pillar-section-title | Public: pillar-section-title
   ============================================================================ */

._pillar-section-title {
  padding: var(--pillar-spacing-md) var(--pillar-spacing-xl) var(--pillar-spacing-sm);
  font-size: var(--pillar-font-size-xs);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--pillar-text-muted);
}

.pillar-section-title {}

/* ============================================================================
   Related Articles
   ============================================================================ */

._pillar-related-articles {
  border-top: 1px solid var(--pillar-border);
  margin-top: var(--pillar-spacing-2xl);
  padding-top: var(--pillar-spacing-sm);
}

.pillar-related-articles {}

/* ============================================================================
   Scrollbar Styling
   ============================================================================ */

._pillar-content::-webkit-scrollbar,
._pillar-chat-input-messages::-webkit-scrollbar {
  width: 6px;
}

._pillar-content::-webkit-scrollbar-track,
._pillar-chat-input-messages::-webkit-scrollbar-track {
  background: var(--pillar-scrollbar-track);
}

._pillar-content::-webkit-scrollbar-thumb,
._pillar-chat-input-messages::-webkit-scrollbar-thumb {
  background: var(--pillar-scrollbar-thumb);
  border-radius: 3px;
}

._pillar-content::-webkit-scrollbar-thumb:hover,
._pillar-chat-input-messages::-webkit-scrollbar-thumb:hover {
  background: var(--pillar-scrollbar-thumb-hover);
}

/* ============================================================================
   Home View
   ============================================================================ */

._pillar-home-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: var(--pillar-spacing-xl);
}

._pillar-home-view-header {
  text-align: center;
  padding: var(--pillar-spacing-2xl) 0;
}

._pillar-home-view-icon {
  font-size: 40px;
  margin-bottom: var(--pillar-spacing-md);
}

._pillar-home-view-title {
  font-size: var(--pillar-font-size-xl);
  font-weight: 600;
  color: var(--pillar-text);
  margin: 0;
}

._pillar-home-view-questions {
  display: flex;
  flex-direction: column;
  gap: var(--pillar-spacing-sm);
  margin-bottom: var(--pillar-spacing-xl);
}

._pillar-home-view-input-wrapper {
  margin-top: auto;
  display: flex;
  flex-direction: column;
  background: var(--pillar-bg-secondary);
  border: 1px solid var(--pillar-border);
  border-radius: var(--pillar-radius-xl);
  transition: border-color var(--pillar-transition-fast), box-shadow var(--pillar-transition-fast);
}

._pillar-home-view-input-wrapper:focus-within {
  border-color: var(--pillar-primary);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

._pillar-home-view-input {
  display: block;
  width: 100%;
  padding: 12px 14px 8px;
  font-size: var(--pillar-font-size-base);
  font-family: var(--pillar-font-family);
  line-height: 1.5;
  color: var(--pillar-text);
  background: transparent;
  border: none;
  outline: none;
  resize: none;
  overflow-y: hidden;
  box-sizing: border-box;
}

._pillar-home-view-input::placeholder {
  color: var(--pillar-text-placeholder);
}

._pillar-home-view-input-row {
  display: flex;
  justify-content: flex-end;
  padding: 8px 10px;
}

._pillar-home-view-send-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  color: var(--pillar-text-muted);
  background: var(--pillar-bg-tertiary);
  border: none;
  border-radius: var(--pillar-radius-md);
  cursor: pointer;
  flex-shrink: 0;
  transition: all var(--pillar-transition-fast);
}

._pillar-home-view-send-btn:hover:not(:disabled) {
  color: #ffffff;
  background: var(--pillar-primary);
}

._pillar-home-view-send-btn:disabled {
  color: var(--pillar-text-placeholder);
  background: var(--pillar-bg-tertiary);
  cursor: not-allowed;
}

._pillar-home-view-send-btn svg {
  width: 16px;
  height: 16px;
}

.pillar-home-view {}
.pillar-home-view-header {}
.pillar-home-view-title {}
.pillar-home-view-questions {}
.pillar-home-view-input-wrapper {}
.pillar-home-view-input {}
.pillar-home-view-send-btn {}

/* ============================================================================
   Question Chip
   ============================================================================ */

._pillar-question-chip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: var(--pillar-spacing-md) var(--pillar-spacing-lg);
  font-size: var(--pillar-font-size-base);
  font-family: var(--pillar-font-family);
  text-align: left;
  color: var(--pillar-text);
  background: var(--pillar-bg-secondary);
  border: 1px solid var(--pillar-border);
  border-radius: var(--pillar-radius-lg);
  cursor: pointer;
  transition: background var(--pillar-transition-fast), border-color var(--pillar-transition-fast);
}

._pillar-question-chip:hover {
  border-color: var(--pillar-primary);
}

._pillar-question-chip-text {
  flex: 1;
}

._pillar-question-chip-arrow {
  color: var(--pillar-text-muted);
  margin-left: var(--pillar-spacing-sm);
  transition: color var(--pillar-transition-fast), transform var(--pillar-transition-fast);
}

._pillar-question-chip:hover ._pillar-question-chip-arrow {
  color: var(--pillar-primary);
  transform: translateX(2px);
}

._pillar-question-chip-skeleton {
  height: 44px;
  background: var(--pillar-bg-secondary);
  border: 1px solid var(--pillar-border);
  border-radius: var(--pillar-radius-lg);
  overflow: hidden;
}

._pillar-question-chip-skeleton-bar {
  width: 60%;
  height: 14px;
  margin: 15px var(--pillar-spacing-lg);
  background: linear-gradient(90deg, var(--pillar-border) 25%, var(--pillar-bg-tertiary) 50%, var(--pillar-border) 75%);
  background-size: 200% 100%;
  animation: pillar-shimmer 1.5s infinite;
  border-radius: var(--pillar-radius-sm);
}

@keyframes pillar-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.pillar-question-chip {}
.pillar-question-chip-text {}
.pillar-question-chip-arrow {}
.pillar-question-chip-skeleton {}
.pillar-question-chip-skeleton-bar {}

/* ============================================================================
   Standalone Chat View
   Internal: _pillar-chat-view | Public: pillar-chat-view
   ============================================================================ */

._pillar-chat-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

._pillar-chat-view-messages {
  flex: 1;
  overflow-y: auto;
  padding: var(--pillar-spacing-xl);
  display: flex;
  flex-direction: column;
}

._pillar-chat-view-welcome {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px var(--pillar-spacing-xl);
  text-align: center;
  flex: 1;
}

._pillar-chat-view-welcome-icon {
  font-size: 48px;
  margin-bottom: var(--pillar-spacing-lg);
}

._pillar-chat-view-welcome-title {
  font-size: var(--pillar-font-size-xl);
  font-weight: 600;
  color: var(--pillar-text);
  margin-bottom: var(--pillar-spacing-sm);
}

._pillar-chat-view-welcome-text {
  font-size: var(--pillar-font-size-base);
  color: var(--pillar-text-muted);
  max-width: 280px;
}

._pillar-chat-view-message {
  margin-bottom: var(--pillar-spacing-lg);
}

._pillar-chat-view-message--user {
  text-align: right;
}

._pillar-chat-view-message--assistant {
  text-align: left;
}

.pillar-chat-view {}
.pillar-chat-view-messages {}
.pillar-chat-view-welcome {}
.pillar-chat-view-message {}

/* ============================================================================
   User Message Bubble
   Internal: _pillar-message-user | Public: pillar-message-user
   ============================================================================ */

._pillar-message-user {
  display: inline-block;
  max-width: 85%;
  padding: 10px 14px;
  border-radius: var(--pillar-spacing-lg);
  border-bottom-right-radius: var(--pillar-radius-sm);
  font-size: var(--pillar-font-size-base);
  line-height: 1.5;
  background: var(--pillar-primary);
  color: #ffffff;
  white-space: pre-wrap;
  word-wrap: break-word;
}

._pillar-message-user-images {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: var(--pillar-spacing-sm);
}

._pillar-message-user-image {
  max-width: 120px;
  max-height: 120px;
  border-radius: var(--pillar-radius-md);
  object-fit: cover;
}

.pillar-message-user {}
.pillar-message-user-images {}
.pillar-message-user-image {}

/* ============================================================================
   AI Response
   Internal: _pillar-message-assistant | Public: pillar-message-assistant
   ============================================================================ */

._pillar-message-assistant {
  font-size: var(--pillar-font-size-base);
  line-height: 1.6;
  color: var(--pillar-text-secondary);
}

._pillar-message-assistant p {
  margin: 0 0 var(--pillar-spacing-md);
}

._pillar-message-assistant p:last-child {
  margin-bottom: 0;
}

._pillar-message-assistant h2 {
  font-size: var(--pillar-font-size-lg);
  font-weight: 600;
  color: var(--pillar-text);
  margin: var(--pillar-spacing-lg) 0 var(--pillar-spacing-sm);
}

._pillar-message-assistant h3 {
  font-size: var(--pillar-font-size-md);
  font-weight: 600;
  color: var(--pillar-text);
  margin: 14px 0 6px;
}

._pillar-message-assistant h4 {
  font-size: var(--pillar-font-size-base);
  font-weight: 600;
  color: var(--pillar-text);
  margin: var(--pillar-spacing-md) 0 6px;
}

._pillar-message-assistant ul,
._pillar-message-assistant ol {
  margin: 0 0 var(--pillar-spacing-md);
  padding-left: var(--pillar-spacing-2xl);
  list-style-position: outside;
}

._pillar-message-assistant ul {
  list-style-type: disc;
}

._pillar-message-assistant ol {
  list-style-type: decimal;
}

._pillar-message-assistant li {
  margin-bottom: var(--pillar-spacing-xs);
}

._pillar-message-assistant code {
  padding: 2px 6px;
  font-size: var(--pillar-font-size-sm);
  background: var(--pillar-bg-tertiary);
  border-radius: var(--pillar-radius-sm);
  font-family: var(--pillar-font-mono);
  color: var(--pillar-text);
}

._pillar-message-assistant pre {
  margin: var(--pillar-spacing-md) 0;
  padding: var(--pillar-spacing-md) 14px;
  background: var(--pillar-code-bg);
  border-radius: var(--pillar-radius-lg);
  overflow-x: auto;
}

._pillar-message-assistant pre code {
  padding: 0;
  background: none;
  color: var(--pillar-code-text);
  font-size: var(--pillar-font-size-sm);
  line-height: 1.5;
}

._pillar-message-assistant a {
  color: var(--pillar-primary);
  text-decoration: none;
}

._pillar-message-assistant a:hover {
  text-decoration: underline;
}

._pillar-message-assistant strong {
  font-weight: 600;
  color: var(--pillar-text);
}

._pillar-message-assistant em {
  font-style: italic;
}

.pillar-message-assistant {}

/* ============================================================================
   Chat Sources
   Internal: _pillar-chat-sources | Public: pillar-chat-sources
   ============================================================================ */

._pillar-chat-sources {
  margin-top: var(--pillar-spacing-md);
  padding-top: var(--pillar-spacing-md);
  border-top: 1px solid var(--pillar-border);
}

._pillar-chat-sources-title {
  font-size: var(--pillar-font-size-xs);
  font-weight: 500;
  color: var(--pillar-text-muted);
  margin-bottom: var(--pillar-spacing-sm);
}

._pillar-chat-source {
  display: block;
  padding: var(--pillar-spacing-sm) var(--pillar-spacing-md);
  margin-bottom: 6px;
  font-size: var(--pillar-font-size-sm);
  color: var(--pillar-primary);
  background: var(--pillar-primary-light);
  border-radius: var(--pillar-radius-lg);
  text-decoration: none;
  cursor: pointer;
  transition: background var(--pillar-transition-fast);
}

._pillar-chat-source:hover {
  background: var(--pillar-primary-light-hover);
}

.pillar-chat-sources {}
.pillar-chat-sources-title {}
.pillar-chat-source {}

/* ============================================================================
   Chat Actions (Suggested action buttons)
   Internal: _pillar-chat-actions | Public: pillar-chat-actions
   ============================================================================ */

._pillar-chat-actions {
  margin-top: var(--pillar-spacing-md);
  padding-top: var(--pillar-spacing-md);
  border-top: 1px solid var(--pillar-border);
}

._pillar-chat-actions-title {
  font-size: var(--pillar-font-size-xs);
  font-weight: 500;
  color: var(--pillar-text-muted);
  margin-bottom: var(--pillar-spacing-sm);
}

._pillar-chat-actions-buttons {
  display: flex;
  flex-direction: column;
  gap: var(--pillar-spacing-sm);
}

/* Task buttons should wrap horizontally */
._pillar-chat-actions-buttons > ._pillar-task-button-group {
  display: flex;
  flex-wrap: wrap;
  gap: var(--pillar-spacing-sm);
}

/* Confirm cards take full width */
._pillar-chat-actions-buttons > .pillar-confirm-card-wrapper {
  width: 100%;
}

.pillar-chat-actions {}
.pillar-chat-actions-title {}
.pillar-chat-actions-buttons {}

/* ============================================================================
   Chat View Input Area - Cursor-style design
   ============================================================================ */

._pillar-chat-view-input-area {
  flex-shrink: 0;
  padding: var(--pillar-spacing-md) var(--pillar-spacing-lg);
  border-top: 1px solid var(--pillar-border);
  background: var(--pillar-bg);
}

._pillar-chat-view-input-wrapper {
  display: flex;
  flex-direction: column;
  background: var(--pillar-bg-secondary);
  border: 1px solid var(--pillar-border);
  border-radius: var(--pillar-radius-xl);
  transition: border-color var(--pillar-transition-fast), box-shadow var(--pillar-transition-fast);
}

._pillar-chat-view-input-wrapper:focus-within {
  border-color: var(--pillar-primary);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

._pillar-chat-view-input {
  display: block;
  width: 100%;
  padding: 12px 14px 8px;
  font-size: var(--pillar-font-size-base);
  font-family: var(--pillar-font-family);
  line-height: 1.5;
  color: var(--pillar-text);
  background: transparent;
  border: none;
  outline: none;
  resize: none;
  overflow-y: hidden;
  box-sizing: border-box;
}

._pillar-chat-view-input::placeholder {
  color: var(--pillar-text-placeholder);
}

._pillar-chat-view-input-row {
  display: flex;
  justify-content: flex-end;
  padding: 8px 10px;
}

._pillar-chat-view-send-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  color: var(--pillar-text-muted);
  background: var(--pillar-bg-tertiary);
  border: none;
  border-radius: var(--pillar-radius-md);
  cursor: pointer;
  flex-shrink: 0;
  transition: all var(--pillar-transition-fast);
}

._pillar-chat-view-send-btn:hover:not(:disabled) {
  color: #ffffff;
  background: var(--pillar-primary);
}

._pillar-chat-view-send-btn:active:not(:disabled) {
  transform: scale(0.95);
}

._pillar-chat-view-send-btn:disabled {
  color: var(--pillar-text-placeholder);
  background: var(--pillar-bg-tertiary);
  cursor: not-allowed;
}

._pillar-chat-view-send-btn svg {
  width: 16px;
  height: 16px;
}

.pillar-chat-view-input-area {}
.pillar-chat-view-input-wrapper {}
.pillar-chat-view-input {}
.pillar-chat-view-send-btn {}
.pillar-chat-view-input-footer {}
.pillar-chat-view-new-chat-btn {}

/* New chat button styling */
._pillar-chat-view-input-footer {
  display: flex;
  justify-content: center;
  margin-top: var(--pillar-spacing-sm);
}

._pillar-chat-view-new-chat-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  font-size: var(--pillar-font-size-sm);
  font-weight: 500;
  font-family: var(--pillar-font-family);
  color: var(--pillar-text-muted);
  background: transparent;
  border: 1px solid var(--pillar-border);
  border-radius: var(--pillar-radius-lg);
  cursor: pointer;
  transition: all var(--pillar-transition-fast);
}

._pillar-chat-view-new-chat-btn:hover {
  color: var(--pillar-text);
  background: var(--pillar-bg-secondary);
  border-color: var(--pillar-text-muted);
}

._pillar-chat-view-new-chat-icon {
  display: flex;
  align-items: center;
  justify-content: center;
}

._pillar-chat-view-new-chat-icon svg {
  width: 14px;
  height: 14px;
}

/* Scrollbar for chat view */
._pillar-chat-view-messages::-webkit-scrollbar {
  width: 6px;
}

._pillar-chat-view-messages::-webkit-scrollbar-track {
  background: var(--pillar-scrollbar-track);
}

._pillar-chat-view-messages::-webkit-scrollbar-thumb {
  background: var(--pillar-scrollbar-thumb);
  border-radius: 3px;
}

._pillar-chat-view-messages::-webkit-scrollbar-thumb:hover {
  background: var(--pillar-scrollbar-thumb-hover);
}

/* ============================================================================
   Chat Image Upload
   ============================================================================ */

._pillar-chat-view-input-area--dragging {
  position: relative;
  background: rgba(37, 99, 235, 0.05);
}

._pillar-chat-drop-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: rgba(37, 99, 235, 0.1);
  border: 2px dashed var(--pillar-primary);
  border-radius: var(--pillar-radius-lg);
  color: var(--pillar-primary);
  font-size: var(--pillar-font-size-sm);
  font-weight: 500;
  z-index: 10;
  pointer-events: none;
}

._pillar-chat-drop-overlay svg {
  width: 24px;
  height: 24px;
}

._pillar-chat-images-preview {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 12px 12px 4px 12px;
}

._pillar-chat-image-thumb {
  position: relative;
  width: 56px;
  height: 56px;
  border-radius: var(--pillar-radius-md);
  overflow: hidden;
  border: 1px solid var(--pillar-border);
}

._pillar-chat-image-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

._pillar-chat-image-loading {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

._pillar-chat-image-error {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(239, 68, 68, 0.3);
  color: #dc2626;
  font-weight: bold;
  font-size: 14px;
}

._pillar-chat-image-remove {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 18px;
  height: 18px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.6);
  border: none;
  border-radius: 50%;
  color: white;
  cursor: pointer;
  opacity: 0;
  transition: opacity var(--pillar-transition-fast);
}

._pillar-chat-image-thumb:hover ._pillar-chat-image-remove {
  opacity: 1;
}

._pillar-chat-image-remove svg {
  width: 10px;
  height: 10px;
}

._pillar-chat-image-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  color: var(--pillar-text-muted);
  background: transparent;
  border: none;
  border-radius: var(--pillar-radius-md);
  cursor: pointer;
  transition: color var(--pillar-transition-fast);
}

._pillar-chat-image-btn:hover:not(:disabled) {
  color: var(--pillar-text);
}

._pillar-chat-image-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

._pillar-chat-image-btn svg {
  width: 18px;
  height: 18px;
}

.pillar-chat-images-preview {}
.pillar-chat-image-thumb {}
.pillar-chat-image-remove {}
.pillar-chat-image-btn {}
.pillar-chat-drop-overlay {}

/* ============================================================================
   Legacy Class Mappings (for backward compatibility)
   Maps old BEM-style class names to new internal classes
   ============================================================================ */

.pillar-panel { }
.pillar-panel--right { }
.pillar-panel--left { }
.pillar-panel--open { }
.pillar-panel--manual { }
.pillar-panel-root { }
.pillar-panel-ui { }
.pillar-panel__header { }
.pillar-panel__header-left { }
.pillar-panel__back-btn { }
.pillar-panel__home-btn { }
.pillar-panel__title { }
.pillar-panel__close-btn { }
.pillar-panel__content { }
.pillar-search { }
.pillar-search__input { }
.pillar-search__icon { }
.pillar-category-card { }
.pillar-category-card__icon { }
.pillar-category-card__content { }
.pillar-category-card__title { }
.pillar-category-card__description { }
.pillar-category-card__count { }
.pillar-article-card { }
.pillar-article-card__title { }
.pillar-article-card__excerpt { }
.pillar-article-card__meta { }
.pillar-article { }
.pillar-article__title { }
.pillar-article__content { }
.pillar-category-header { }
.pillar-category-header__title { }
.pillar-category-header__description { }
.pillar-chat-input-container { }
.pillar-chat-input-container--expanded { }
.pillar-chat-input__messages { }
.pillar-chat-input__message { }
.pillar-chat-input__message--user { }
.pillar-chat-input__message--assistant { }
.pillar-chat-input__message-content { }
.pillar-chat-input__sources { }
.pillar-chat-input__sources-title { }
.pillar-chat-input__source { }
.pillar-chat-input__area { }
.pillar-chat-input__wrapper { }
.pillar-chat-input__input { }
.pillar-chat-input__send-btn { }
.pillar-loading { }
.pillar-loading__spinner { }
.pillar-empty { }
.pillar-empty__icon { }
.pillar-empty__title { }
.pillar-empty__description { }
.pillar-section-title { }
.pillar-related-articles { }
.pillar-home-view { }
.pillar-chat-view { }
.pillar-chat-view__messages { }
.pillar-chat-view__welcome { }
.pillar-chat-view__welcome-icon { }
.pillar-chat-view__welcome-title { }
.pillar-chat-view__welcome-text { }
.pillar-chat-view__message { }
.pillar-chat-view__message--user { }
.pillar-chat-view__message--assistant { }
.pillar-chat-view__user-bubble { }
.pillar-chat-view__ai-response { }
.pillar-chat-view__sources { }
.pillar-chat-view__sources-title { }
.pillar-chat-view__source { }
.pillar-chat-view__input-area { }
.pillar-chat-view__input-wrapper { }
.pillar-chat-view__input { }
.pillar-chat-view__send-btn { }
.pillar-backdrop { }
.pillar-backdrop--visible { }

/* ============================================================================
   Task Button Component
   ============================================================================ */

.pillar-task-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  font-size: 13px;
  font-weight: 500;
  font-family: inherit;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
  border: 1px solid transparent;
  text-decoration: none;
}

.pillar-task-btn__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.pillar-task-btn__icon svg {
  width: 16px;
  height: 16px;
}

.pillar-task-btn__label {
  white-space: nowrap;
}

/* Primary variant (default) */
.pillar-task-btn--primary {
  background: #2563eb;
  color: #ffffff;
  border-color: #2563eb;
}

.pillar-task-btn--primary:hover {
  background: #1d4ed8;
  border-color: #1d4ed8;
}

/* Default variant */
.pillar-task-btn--default {
  background: #f3f4f6;
  color: #1a1a1a;
  border-color: #e5e7eb;
}

.pillar-task-btn--default:hover {
  background: #e5e7eb;
}

/* Secondary variant */
.pillar-task-btn--secondary {
  background: #eff6ff;
  color: #2563eb;
  border-color: #dbeafe;
}

.pillar-task-btn--secondary:hover {
  background: #dbeafe;
}

/* Outline variant */
.pillar-task-btn--outline {
  background: transparent;
  color: #2563eb;
  border-color: #2563eb;
}

.pillar-task-btn--outline:hover {
  background: #eff6ff;
}

/* Ghost variant */
.pillar-task-btn--ghost {
  background: transparent;
  color: #6b7280;
  border-color: transparent;
}

.pillar-task-btn--ghost:hover {
  background: #f3f4f6;
  color: #1a1a1a;
}

/* Task button group */
.pillar-task-btn-group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

/* Task suggestion card in chat */
.pillar-task-suggestion {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  margin-top: 12px;
}

.pillar-task-suggestion__header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #6b7280;
}

.pillar-task-suggestion__header svg {
  width: 14px;
  height: 14px;
}

.pillar-task-suggestion__description {
  font-size: 13px;
  color: #374151;
}

/* ============================================================================
   Feedback Icons
   Internal: _pillar-feedback | Public: pillar-feedback
   ============================================================================ */

._pillar-message-assistant-wrapper {
  position: relative;
}

._pillar-feedback-icons {
  display: flex;
  gap: 4px;
  margin-top: var(--pillar-spacing-sm);
  justify-content: flex-end;
}

._pillar-feedback-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  background: transparent;
  border: 1px solid var(--pillar-border);
  border-radius: var(--pillar-radius-md);
  cursor: pointer;
  color: var(--pillar-text-placeholder);
  transition: all var(--pillar-transition-fast);
}

._pillar-feedback-btn:hover {
  color: var(--pillar-text-muted);
  background: var(--pillar-bg-secondary);
  border-color: var(--pillar-border);
}

._pillar-feedback-btn--active {
  color: var(--pillar-primary);
  background: var(--pillar-primary-light);
  border-color: var(--pillar-primary);
}

._pillar-feedback-btn--active:hover {
  color: var(--pillar-primary);
  background: var(--pillar-primary-light-hover);
}

._pillar-feedback-btn svg {
  width: 14px;
  height: 14px;
}

.pillar-feedback-icons {}
.pillar-feedback-btn {}
.pillar-message-assistant-wrapper {}

/* ============================================================================
   Action Status Indicators
   Internal: _pillar-action-status | Public: pillar-action-status
   Shows completion status for auto-run actions (checkmark, X, or spinner)
   ============================================================================ */

._pillar-message-assistant-content {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

._pillar-action-status {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  margin-top: 2px;
}

._pillar-action-status-indicator {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
}

._pillar-action-status-indicator svg {
  width: 16px;
  height: 16px;
}

._pillar-action-status-indicator--success {
  color: #22c55e;
}

._pillar-action-status-indicator--failed {
  color: #ef4444;
}

._pillar-action-status-indicator--pending {
  color: var(--pillar-text-muted);
  animation: pillar-spin 1s linear infinite;
}

@keyframes pillar-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.pillar-action-status {}
.pillar-action-status-indicator {}
.pillar-message-assistant-content {}

/* ============================================================================
   Context Tags
   Internal: _pillar-context-tag | Public: pillar-context-tag
   Removable chips for user context items (highlighted text, etc.)
   ============================================================================ */

._pillar-context-tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 8px 14px 0;
}

._pillar-context-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 200px;
  padding: 4px 6px 4px 8px;
  font-size: var(--pillar-font-size-sm);
  color: var(--pillar-text-secondary);
  background: var(--pillar-bg-tertiary);
  border: 1px solid var(--pillar-border);
  border-radius: var(--pillar-radius-md);
  cursor: default;
  transition: all var(--pillar-transition-fast);
}

._pillar-context-tag:hover {
  background: var(--pillar-bg-secondary);
  border-color: var(--pillar-text-muted);
}

._pillar-context-tag-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  color: var(--pillar-primary);
}

._pillar-context-tag-icon svg {
  width: 12px;
  height: 12px;
}

._pillar-context-tag-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.3;
}

._pillar-context-tag-remove {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  padding: 0;
  margin-left: 2px;
  color: var(--pillar-text-placeholder);
  background: transparent;
  border: none;
  border-radius: var(--pillar-radius-sm);
  cursor: pointer;
  flex-shrink: 0;
  transition: all var(--pillar-transition-fast);
}

._pillar-context-tag-remove:hover {
  color: var(--pillar-text);
  background: var(--pillar-border);
}

._pillar-context-tag-remove svg {
  width: 12px;
  height: 12px;
}

.pillar-context-tag-list {}
.pillar-context-tag {}
.pillar-context-tag-icon {}
.pillar-context-tag-label {}
.pillar-context-tag-remove {}

/* Context tags inside user message bubbles need inverted colors */
._pillar-message-user ._pillar-context-tag-list {
  padding: 0 0 8px 0;
}

._pillar-message-user ._pillar-context-tag {
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.3);
  color: #ffffff;
}

._pillar-message-user ._pillar-context-tag:hover {
  background: rgba(255, 255, 255, 0.3);
  border-color: rgba(255, 255, 255, 0.4);
}

._pillar-message-user ._pillar-context-tag-icon {
  color: #ffffff;
}

._pillar-message-user ._pillar-context-tag-label {
  color: #ffffff;
}

/* ============================================================================
   Unified Chat Input
   Internal: _pillar-unified-input | Public: pillar-unified-input
   Reusable input component with context tag support
   ============================================================================ */

._pillar-unified-input-wrapper {
  display: flex;
  flex-direction: column;
  background: var(--pillar-bg-secondary);
  border: 1px solid var(--pillar-border);
  border-radius: var(--pillar-radius-xl);
  transition: border-color var(--pillar-transition-fast), box-shadow var(--pillar-transition-fast);
}

._pillar-unified-input-wrapper:focus-within {
  border-color: var(--pillar-primary);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

._pillar-unified-input {
  display: block;
  width: 100%;
  padding: 12px 14px 8px;
  font-size: var(--pillar-font-size-base);
  font-family: var(--pillar-font-family);
  line-height: 1.5;
  color: var(--pillar-text);
  background: transparent;
  border: none;
  outline: none;
  resize: none;
  overflow-y: hidden;
  box-sizing: border-box;
}

._pillar-unified-input::placeholder {
  color: var(--pillar-text-placeholder);
}

._pillar-unified-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

._pillar-unified-input-row {
  display: flex;
  justify-content: flex-end;
  padding: 8px 10px;
}

._pillar-unified-send-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  color: #ffffff;
  background: var(--pillar-primary);
  border: none;
  border-radius: var(--pillar-radius-md);
  cursor: pointer;
  flex-shrink: 0;
  transition: all var(--pillar-transition-fast);
}

._pillar-unified-send-btn:hover:not(:disabled) {
  background: var(--pillar-primary-hover);
}

._pillar-unified-send-btn:disabled {
  color: var(--pillar-text-placeholder);
  background: var(--pillar-bg-tertiary);
  cursor: not-allowed;
}

._pillar-unified-send-btn svg {
  width: 16px;
  height: 16px;
}

.pillar-unified-input-wrapper {}
.pillar-unified-input {}
.pillar-unified-input-row {}
.pillar-unified-send-btn {}
`;
