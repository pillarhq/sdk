/**
 * Text Selection Popover CSS Styles
 * Injected into the document head
 */

export const TEXT_SELECTION_STYLES = `
/* Pillar Text Selection Popover Styles */
.pillar-text-selection-popover {
  position: absolute;
  z-index: 99999;
  padding: 6px 12px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  font-size: 13px;
  font-weight: 500;
  line-height: 1;
  color: #ffffff;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3), 0 2px 4px rgba(0, 0, 0, 0.1);
  pointer-events: auto;
  opacity: 0;
  transform: translateY(4px) scale(0.95);
  transition: opacity 0.15s ease, transform 0.15s ease;
  cursor: pointer;
  user-select: none;
}

.pillar-text-selection-popover.pillar-text-selection-popover--visible {
  opacity: 1;
  transform: translateY(0) scale(1);
}

.pillar-text-selection-popover:hover {
  background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
  box-shadow: 0 6px 16px rgba(99, 102, 241, 0.4), 0 2px 4px rgba(0, 0, 0, 0.1);
}

.pillar-text-selection-popover:active {
  transform: translateY(0) scale(0.98);
}

.pillar-text-selection-popover__content {
  display: flex;
  align-items: center;
  gap: 6px;
}

.pillar-text-selection-popover__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
}

.pillar-text-selection-popover__icon svg {
  width: 100%;
  height: 100%;
}

/* Arrow pointing down to selection */
.pillar-text-selection-popover__arrow {
  position: absolute;
  bottom: -5px;
  left: 50%;
  transform: translateX(-50%) rotate(45deg);
  width: 10px;
  height: 10px;
  background: linear-gradient(135deg, #8b5cf6 0%, #8b5cf6 100%);
}

.pillar-text-selection-popover--below .pillar-text-selection-popover__arrow {
  bottom: auto;
  top: -5px;
  background: linear-gradient(135deg, #6366f1 0%, #6366f1 100%);
}
`;

