/**
 * Panel Header Component
 * Navigation header with back, home, and close buttons
 */

import { h } from 'preact';
import { canGoBack, isAtHome, goBack, goHome, type ViewType } from '../../store/router';
import { closePanel } from '../../store/panel';

const BACK_ICON = `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clip-rule="evenodd"/></svg>`;
const HOME_ICON = `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"/></svg>`;
const CLOSE_ICON = `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>`;

const VIEW_TITLES: Record<ViewType, string> = {
  home: 'Assistant',
  chat: 'Assistant',
};

interface HeaderProps {
  currentView: ViewType;
  customTitle?: string;
  /** Hide back and home navigation buttons */
  hideNavigation?: boolean;
}

export function Header({ currentView, customTitle, hideNavigation = false }: HeaderProps) {
  const showBack = !hideNavigation && canGoBack.value;
  const showHome = !hideNavigation && !isAtHome.value;
  const title = customTitle || VIEW_TITLES[currentView];

  const handleBack = () => {
    goBack();
  };

  const handleHome = () => {
    goHome();
  };

  const handleClose = () => {
    closePanel();
  };

  return (
    <header class="_pillar-header pillar-header">
      <div class="_pillar-header-left pillar-header-left">
        {showBack && (
          <button
            class="_pillar-icon-btn pillar-icon-btn pillar-back-btn"
            onClick={handleBack}
            aria-label="Go back"
            type="button"
            dangerouslySetInnerHTML={{ __html: BACK_ICON }}
          />
        )}
        {showHome && (
          <button
            class="_pillar-icon-btn pillar-icon-btn pillar-home-btn"
            onClick={handleHome}
            aria-label="Go to home"
            type="button"
            dangerouslySetInnerHTML={{ __html: HOME_ICON }}
          />
        )}
        <span class="_pillar-header-title pillar-header-title">{title}</span>
      </div>
      <button
        class="_pillar-icon-btn pillar-icon-btn pillar-close-btn"
        onClick={handleClose}
        aria-label="Close assistant panel"
        type="button"
        dangerouslySetInnerHTML={{ __html: CLOSE_ICON }}
      />
    </header>
  );
}

