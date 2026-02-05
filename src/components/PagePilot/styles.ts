/**
 * Page Pilot Banner CSS Styles
 * Injected into the document head (outside Shadow DOM)
 * Uses the same CSS variables as the Pillar panel for consistent theming
 */

export const PAGE_PILOT_STYLES = `
/* Pillar Page Pilot Banner Styles */

/* Define CSS variables at the container level (same as panel) */
#pillar-page-pilot-container {
  /* Core colors - Light mode (default) */
  --pillar-primary: #2563eb;
  --pillar-primary-hover: #1d4ed8;
  --pillar-bg: #ffffff;
  --pillar-bg-secondary: #f9fafb;
  --pillar-text: #1a1a1a;
  --pillar-text-secondary: #374151;
  --pillar-border: #e5e7eb;
  --pillar-shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  --pillar-font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  --pillar-radius-lg: 8px;
  --pillar-radius-md: 6px;
  --pillar-transition-fast: 0.15s ease;
}

/* Dark mode - Auto-detect from system preference */
@media (prefers-color-scheme: dark) {
  #pillar-page-pilot-container:not([data-theme="light"]) {
    --pillar-primary: #3b82f6;
    --pillar-primary-hover: #60a5fa;
    --pillar-bg: #1a1a1a;
    --pillar-bg-secondary: #262626;
    --pillar-text: #f5f5f5;
    --pillar-text-secondary: #e5e5e5;
    --pillar-border: #404040;
    --pillar-shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.4);
  }
}

/* Dark mode - Manual override via html class or data attribute */
html.dark #pillar-page-pilot-container,
[data-theme="dark"] #pillar-page-pilot-container,
#pillar-page-pilot-container[data-theme="dark"] {
  --pillar-primary: #3b82f6;
  --pillar-primary-hover: #60a5fa;
  --pillar-bg: #1a1a1a;
  --pillar-bg-secondary: #262626;
  --pillar-text: #f5f5f5;
  --pillar-text-secondary: #e5e5e5;
  --pillar-border: #404040;
  --pillar-shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.4);
}

@keyframes pillar-pulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.6;
    transform: scale(1.1);
  }
}

@keyframes pillar-banner-fade-in {
  from {
    opacity: 0;
    transform: translate(-50%, -10px);
  }
  to {
    opacity: 1;
    transform: translate(-50%, 0);
  }
}

._pillar-page-pilot-banner {
  position: fixed;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 99999;
  font-family: var(--pillar-font-family);
  animation: pillar-banner-fade-in 0.2s ease-out;
}

._pillar-page-pilot-banner__content {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  background: var(--pillar-bg);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid var(--pillar-border);
  border-radius: var(--pillar-radius-lg);
  box-shadow: var(--pillar-shadow-md), 0 0 0 1px rgba(0, 0, 0, 0.05);
}

._pillar-page-pilot-banner__indicator {
  width: 8px;
  height: 8px;
  background: var(--pillar-primary);
  border-radius: 50%;
  animation: pillar-pulse 1.5s ease-in-out infinite;
  flex-shrink: 0;
}

._pillar-page-pilot-banner__text {
  font-size: 13px;
  font-weight: 500;
  color: var(--pillar-text);
  white-space: nowrap;
}

._pillar-page-pilot-banner__stop {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  margin-left: 4px;
  font-family: inherit;
  font-size: 12px;
  font-weight: 500;
  color: var(--pillar-text-secondary);
  background: var(--pillar-bg-secondary);
  border: 1px solid var(--pillar-border);
  border-radius: var(--pillar-radius-md);
  cursor: pointer;
  transition: all var(--pillar-transition-fast);
}

._pillar-page-pilot-banner__stop:hover {
  color: var(--pillar-primary);
  background: var(--pillar-bg);
  border-color: var(--pillar-primary);
}

._pillar-page-pilot-banner__stop:active {
  transform: scale(0.97);
}

._pillar-page-pilot-banner__stop-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
}

._pillar-page-pilot-banner__stop-icon svg {
  width: 100%;
  height: 100%;
}
`;
