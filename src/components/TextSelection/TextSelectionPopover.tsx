/**
 * Text Selection Popover Component
 * Shows "Ask AI" button near selected text
 */

import { h } from 'preact';
import { useEffect, useRef, useState, useCallback } from 'preact/hooks';

const SPARKLE_ICON = `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M10 2a1 1 0 011 1v1.323l3.954 1.582 1.599-.8a1 1 0 01.894 1.79l-1.233.616 1.738 5.42a1 1 0 01-.285 1.05A3.989 3.989 0 0115 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.715-5.349L10 6.477l-3.763 1.105 1.715 5.349a1 1 0 01-.285 1.05A3.989 3.989 0 015 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.738-5.42-1.233-.617a1 1 0 01.894-1.788l1.599.799L9 4.323V3a1 1 0 011-1z"/></svg>`;

interface TextSelectionPopoverProps {
  label: string;
  x: number;
  y: number;
  isVisible: boolean;
  onClick: () => void;
}

export function TextSelectionPopover({
  label,
  x,
  y,
  isVisible,
  onClick,
}: TextSelectionPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x, y });
  const [isBelow, setIsBelow] = useState(false);

  const updatePosition = useCallback(() => {
    if (!popoverRef.current || !isVisible) return;

    const rect = popoverRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let adjustedX = x;
    let adjustedY = y;
    let showBelow = false;

    // Center horizontally on the selection point
    adjustedX = x - rect.width / 2;

    // Keep within viewport horizontally
    if (adjustedX < 10) {
      adjustedX = 10;
    } else if (adjustedX + rect.width > viewportWidth - 10) {
      adjustedX = viewportWidth - rect.width - 10;
    }

    // Position above selection by default, with offset for arrow
    adjustedY = y - rect.height - 10;

    // If not enough space above, show below
    if (adjustedY < 10) {
      adjustedY = y + 10;
      showBelow = true;
    }

    setPosition({ x: adjustedX, y: adjustedY });
    setIsBelow(showBelow);
  }, [x, y, isVisible]);

  useEffect(() => {
    if (isVisible) {
      // Initial position calculation
      requestAnimationFrame(updatePosition);
    }
  }, [isVisible, updatePosition, x, y]);

  const handleClick = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onClick();
  };

  const className = `pillar-text-selection-popover${isVisible ? ' pillar-text-selection-popover--visible' : ''}${isBelow ? ' pillar-text-selection-popover--below' : ''}`;

  return (
    <div
      ref={popoverRef}
      class={className}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <div class="pillar-text-selection-popover__content">
        <span
          class="pillar-text-selection-popover__icon"
          dangerouslySetInnerHTML={{ __html: SPARKLE_ICON }}
        />
        <span>{label}</span>
      </div>
      <div class="pillar-text-selection-popover__arrow" />
    </div>
  );
}

