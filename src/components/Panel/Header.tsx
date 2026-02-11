/**
 * Panel Header Component
 * Navigation header with back, home, history, and close buttons.
 * In mobile mode, the header doubles as a drag handle: swipe down to dismiss.
 */

import { useRef, useEffect } from "preact/hooks";
import { hasMessages, selectConversationById } from "../../store/chat";
import { closePanel, isMobileMode } from "../../store/panel";
import {
  canGoBack,
  goBack,
  goHome,
  isAtHome,
  type ViewType,
} from "../../store/router";
import { HistoryDropdown } from "./HistoryDropdown";

const BACK_ICON = `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clip-rule="evenodd"/></svg>`;
const HOME_ICON = `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"/></svg>`;
const CLOSE_ICON = `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>`;
const NEW_CHAT_ICON = `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"/></svg>`;

// Drag-to-dismiss thresholds
const DISMISS_THRESHOLD = 120; // px distance to trigger dismiss
const VELOCITY_THRESHOLD = 0.5; // px/ms flick speed to trigger dismiss
const DRAG_DEAD_ZONE = 10; // px before a touch is considered a drag

interface HeaderProps {
  currentView: ViewType;
  /** Hide back and home navigation buttons */
  hideNavigation?: boolean;
}

export function Header({ currentView, hideNavigation = false }: HeaderProps) {
  const headerRef = useRef<HTMLElement>(null);
  const isMobile = isMobileMode.value;

  const showBack = !hideNavigation && canGoBack.value;
  const showHome = !hideNavigation && !isAtHome.value;
  // Show new chat button in chat view when there are messages
  const showNewChat = currentView === "chat" && hasMessages.value;

  const handleBack = () => {
    goBack();
  };

  const handleHome = () => {
    goHome();
  };

  const handleNewChat = () => {
    goHome();
  };

  const handleClose = () => {
    closePanel();
  };

  const handleSelectConversation = selectConversationById;

  // ---- Drag-to-dismiss (mobile bottom sheet) ----
  useEffect(() => {
    if (!isMobile) return;

    const header = headerRef.current;
    if (!header) return;

    const panel = header.closest("._pillar-panel") as HTMLElement | null;
    if (!panel) return;

    let startY = 0;
    let currentY = 0;
    let isDragging = false;
    let dragStarted = false;
    let startTime = 0;

    const onTouchStart = (e: TouchEvent) => {
      // Don't hijack taps on buttons
      if ((e.target as HTMLElement).closest("button")) return;

      startY = e.touches[0].clientY;
      currentY = startY;
      startTime = Date.now();
      isDragging = true;
      dragStarted = false;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!isDragging) return;

      currentY = e.touches[0].clientY;
      const deltaY = currentY - startY;

      // Only allow downward drag
      if (deltaY < 0) return;

      // Dead zone — don't start dragging until the finger moves enough
      if (!dragStarted) {
        if (deltaY < DRAG_DEAD_ZONE) return;
        dragStarted = true;
        panel.style.transition = "none";
      }

      // Rubber-band resistance past the dismiss threshold
      const resistedDelta =
        deltaY < DISMISS_THRESHOLD
          ? deltaY
          : DISMISS_THRESHOLD + (deltaY - DISMISS_THRESHOLD) * 0.3;

      panel.style.transform = `translateY(${resistedDelta}px)`;
      e.preventDefault();
    };

    const onTouchEnd = () => {
      if (!isDragging || !dragStarted) {
        isDragging = false;
        return;
      }
      isDragging = false;
      dragStarted = false;

      const deltaY = currentY - startY;
      const elapsed = Date.now() - startTime;
      const velocity = deltaY / Math.max(elapsed, 1);

      // Restore CSS transition and force reflow so the browser picks it up
      panel.style.transition = "";
      void panel.offsetHeight;

      if (deltaY > DISMISS_THRESHOLD || velocity > VELOCITY_THRESHOLD) {
        // Dismiss — animate to off-screen then close
        panel.style.transform = "translateY(100%)";

        const cleanup = () => {
          panel.removeEventListener("transitionend", cleanup);
          clearTimeout(fallback);
          panel.style.transform = "";
          closePanel();
        };
        // Fallback in case transitionend doesn't fire
        const fallback = setTimeout(cleanup, 600);
        panel.addEventListener("transitionend", cleanup);
      } else {
        // Snap back to open position
        panel.style.transform = "";
      }
    };

    header.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", onTouchEnd);

    return () => {
      header.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
      // Clean up any leftover inline styles
      panel.style.transition = "";
      panel.style.transform = "";
    };
  }, [isMobile]);

  return (
    <header ref={headerRef} class="_pillar-header pillar-header">
      {isMobile && (
        <div class="_pillar-drag-indicator pillar-drag-indicator">
          <div class="_pillar-drag-indicator-pill" />
        </div>
      )}
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
        {showHome && !showNewChat && (
          <button
            class="_pillar-icon-btn pillar-icon-btn pillar-home-btn"
            onClick={handleHome}
            aria-label="Go to home"
            type="button"
            dangerouslySetInnerHTML={{ __html: HOME_ICON }}
          />
        )}
      </div>
      <div class="_pillar-header-right pillar-header-right">
        {showNewChat && (
          <button
            class="_pillar-icon-btn pillar-icon-btn pillar-new-chat-btn"
            onClick={handleNewChat}
            aria-label="New chat"
            title="New chat"
            type="button"
            dangerouslySetInnerHTML={{ __html: NEW_CHAT_ICON }}
          />
        )}
        <HistoryDropdown onSelectConversation={handleSelectConversation} />
        <button
          class="_pillar-icon-btn pillar-icon-btn pillar-close-btn"
          onClick={handleClose}
          aria-label="Close assistant panel"
          type="button"
          dangerouslySetInnerHTML={{ __html: CLOSE_ICON }}
        />
      </div>
    </header>
  );
}
