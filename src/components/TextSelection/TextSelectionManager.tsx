/**
 * Text Selection Manager
 * Detects text selection and shows "Ask AI" popover
 */

import { h, render } from 'preact';
import type { EventEmitter } from '../../core/events';
import type { ResolvedConfig } from '../../core/config';
import { TEXT_SELECTION_STYLES } from './styles';
import { TextSelectionPopover } from './TextSelectionPopover';
import { injectStyles } from '../../utils/dom';
import { addUserContext } from '../../store/chat';

const STYLES_ID = 'pillar-text-selection-styles';
const MIN_SELECTION_LENGTH = 3;

export class TextSelectionManager {
  private config: ResolvedConfig;
  private events: EventEmitter;
  private openPanel: () => void;

  private container: HTMLDivElement | null = null;
  private isVisible = false;
  private currentSelection = '';
  private stylesInjected = false;

  constructor(
    config: ResolvedConfig,
    events: EventEmitter,
    openPanel: () => void
  ) {
    this.config = config;
    this.events = events;
    this.openPanel = openPanel;
  }

  /**
   * Initialize the text selection manager
   */
  init(): void {
    // Inject styles
    if (!this.stylesInjected) {
      injectStyles(document, TEXT_SELECTION_STYLES, STYLES_ID);
      this.stylesInjected = true;
    }

    // Create container for popover
    this.container = document.createElement('div');
    this.container.id = 'pillar-text-selection-container';
    document.body.appendChild(this.container);

    // Bind events
    this.bindEvents();
  }

  /**
   * Destroy the text selection manager
   */
  destroy(): void {
    this.unbindEvents();

    // Unmount Preact component
    if (this.container) {
      render(null, this.container);
      this.container.remove();
      this.container = null;
    }

    // Remove styles
    document.getElementById(STYLES_ID)?.remove();
    this.stylesInjected = false;

    this.isVisible = false;
    this.currentSelection = '';
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private bindEvents(): void {
    document.addEventListener('mouseup', this.handleMouseUp);
    document.addEventListener('mousedown', this.handleMouseDown);
    document.addEventListener('keydown', this.handleKeyDown);
    document.addEventListener('scroll', this.handleScroll, true);
  }

  private unbindEvents(): void {
    document.removeEventListener('mouseup', this.handleMouseUp);
    document.removeEventListener('mousedown', this.handleMouseDown);
    document.removeEventListener('keydown', this.handleKeyDown);
    document.removeEventListener('scroll', this.handleScroll, true);
  }

  private handleMouseUp = (e: MouseEvent): void => {
    // Delay to allow selection to be finalized
    setTimeout(() => {
      this.checkSelection(e);
    }, 10);
  };

  private handleMouseDown = (e: MouseEvent): void => {
    // Hide popover when clicking elsewhere (unless clicking on popover itself)
    const target = e.target as HTMLElement;
    if (!target.closest('.pillar-text-selection-popover')) {
      this.hidePopover();
    }
  };

  private handleKeyDown = (e: KeyboardEvent): void => {
    // Hide on Escape
    if (e.key === 'Escape') {
      this.hidePopover();
    }
  };

  private handleScroll = (): void => {
    // Hide on scroll
    if (this.isVisible) {
      this.hidePopover();
    }
  };

  private checkSelection(e: MouseEvent): void {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      return;
    }

    const selectedText = selection.toString().trim();

    // Validate selection
    if (selectedText.length < MIN_SELECTION_LENGTH) {
      return;
    }

    // Check if selection is within Pillar panel (don't show popover there)
    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer;
    const element = container instanceof Element ? container : container.parentElement;
    
    if (element?.closest('[data-pillar-panel]') || element?.closest('.pillar-panel-host')) {
      return;
    }

    // Get position for popover (above the selection)
    const rect = range.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + window.scrollY;

    this.currentSelection = selectedText;
    this.showPopover(x, y);
  }

  private showPopover(x: number, y: number): void {
    if (!this.container) return;

    this.isVisible = true;

    render(
      <TextSelectionPopover
        label={this.config.textSelection.label}
        x={x}
        y={y}
        isVisible={true}
        onClick={this.handlePopoverClick}
      />,
      this.container
    );

    // Emit event
    this.events.emit('textSelection:shown', { text: this.currentSelection });
  }

  private hidePopover(): void {
    if (!this.container || !this.isVisible) return;

    this.isVisible = false;

    render(
      <TextSelectionPopover
        label={this.config.textSelection.label}
        x={0}
        y={0}
        isVisible={false}
        onClick={() => {}}
      />,
      this.container
    );
  }

  private handlePopoverClick = (): void => {
    if (!this.currentSelection) return;

    // Emit event
    this.events.emit('textSelection:click', { text: this.currentSelection });

    // Add highlighted text to user context
    addUserContext({
      type: 'highlighted_text',
      url_origin: window.location.href,
      text_content: this.currentSelection,
    });

    // Hide popover
    this.hidePopover();

    // Clear the text selection
    window.getSelection()?.removeAllRanges();

    // Open the panel
    this.openPanel();
  };
}

