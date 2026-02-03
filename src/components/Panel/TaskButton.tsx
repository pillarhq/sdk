/**
 * TaskButton Component
 * 
 * Renders a task action button in chat responses.
 * When clicked, triggers the task execution via the Pillar SDK.
 * For inline_ui actions, clicking toggles a confirmation card below the button.
 * 
 * Presentation (label, icon) is derived from task name and type.
 * The server only sends: name, task_type, data.
 */

import Pillar from '../../core/Pillar';
import type { TaskExecutePayload } from '../../core/events';
import { createConfirmActionCard } from '../Cards/ConfirmActionCard';
import { debug } from '../../utils/debug';

/**
 * Task data as received from the AI.
 * Simplified: server sends minimal data, SDK derives presentation.
 */
export interface TaskButtonData {
  /** Database UUID for the task (used for confirmation) */
  id?: string;
  /** Task unique identifier (e.g., 'invite_team_member') */
  name: string;
  /** Task type (navigate, trigger_action, etc.) */
  taskType?: TaskExecutePayload['taskType'];
  /** Data payload containing type-specific values */
  data?: Record<string, unknown>;
  /** If true, action executes immediately without user clicking */
  autoRun?: boolean;
  /** If true, action completes without waiting for host confirmation */
  autoComplete?: boolean;
}

interface TaskButtonProps {
  task: TaskButtonData;
  onExecute?: () => void;
}

/**
 * Default icons for each task type.
 */
const TASK_TYPE_ICONS: Record<string, string> = {
  navigate: 'arrow-right',
  open_modal: 'layout',
  fill_form: 'edit',
  trigger_action: 'zap',
  copy_text: 'copy',
  external_link: 'external-link',
  start_tutorial: 'play-circle',
};

/**
 * SVG icons for common task icons.
 */
const ICONS: Record<string, string> = {
  'arrow-right': `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12,5 19,12 12,19"/></svg>`,
  'user-plus': `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>`,
  'settings': `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
  'external-link': `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15,3 21,3 21,9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`,
  'play-circle': `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="10,8 16,12 10,16 10,8"/></svg>`,
  'zap': `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13,2 3,14 12,14 11,22 21,10 12,10 13,2"/></svg>`,
  'message-circle': `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>`,
  'download': `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
  'copy': `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,
  'layout': `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>`,
  'edit': `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
};

/**
 * Derive a human-readable label from a task name.
 * Converts snake_case to Title Case.
 * 
 * Examples:
 *   'invite_team_member' -> 'Invite Team Member'
 *   'open_settings' -> 'Open Settings'
 */
function deriveLabel(name: string): string {
  return name
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Get the default icon for a task type.
 */
function getDefaultIcon(taskType?: string): string {
  if (!taskType) return 'zap';
  return TASK_TYPE_ICONS[taskType] || 'zap';
}

/**
 * Get the button class based on variant.
 */
function getButtonClass(variant: string = 'primary'): string {
  const baseClass = 'pillar-task-btn';
  return `${baseClass} pillar-task-btn--${variant}`;
}

/**
 * Create a TaskButton element.
 * 
 * Presentation is derived from task.name and task.taskType.
 * For inline_ui actions, clicking toggles a confirmation card below the button.
 */
export function createTaskButton(props: TaskButtonProps): HTMLButtonElement {
  const { task, onExecute } = props;
  
  const button = document.createElement('button');
  button.className = getButtonClass('primary');
  button.type = 'button';

  // Derive icon from taskType
  const iconName = getDefaultIcon(task.taskType);
  if (iconName && ICONS[iconName]) {
    const iconSpan = document.createElement('span');
    iconSpan.className = 'pillar-task-btn__icon';
    iconSpan.innerHTML = ICONS[iconName];
    button.appendChild(iconSpan);
  }

  // Derive label from name
  const label = deriveLabel(task.name);
  const labelSpan = document.createElement('span');
  labelSpan.className = 'pillar-task-btn__label';
  labelSpan.textContent = label;
  button.appendChild(labelSpan);

  // Track inline card state for inline_ui actions
  let inlineCardContainer: HTMLDivElement | null = null;
  let isCardVisible = false;

  // Add click handler
  button.addEventListener('click', () => {
    const pillar = Pillar.getInstance();
    
    // For inline_ui actions, toggle the confirmation card instead of executing
    if (task.taskType === 'inline_ui') {
      toggleInlineCard();
      return;
    }
    
    // For other actions, execute directly
    if (pillar) {
      const data = task.data || {};
      
      const payload: TaskExecutePayload = {
        id: task.id,
        name: task.name,
        data: data,
        taskType: task.taskType,
        path: data.path as string | undefined,
        externalUrl: data.url as string | undefined,
      };
      pillar.executeTask(payload);
    }
    onExecute?.();
  });

  /**
   * Toggle the inline confirmation card for inline_ui actions.
   * Creates the card lazily on first click.
   */
  function toggleInlineCard(): void {
    const pillar = Pillar.getInstance();
    
    if (isCardVisible && inlineCardContainer) {
      // Hide the card
      inlineCardContainer.style.display = 'none';
      isCardVisible = false;
      button.classList.remove('pillar-task-btn--active');
      debug.log('[Pillar] Collapsed inline_ui card:', task.name);
      return;
    }

    // Show or create the card
    if (!inlineCardContainer) {
      // Create card container - insert after the button's parent (the button group)
      inlineCardContainer = document.createElement('div');
      inlineCardContainer.className = 'pillar-task-btn-inline-card';
      
      const card = createConfirmActionCard(
        task,
        // onConfirm callback
        (data) => {
          if (pillar) {
            pillar.executeTask({
              id: task.id,
              name: task.name,
              taskType: task.taskType,
              data: data || task.data || {},
            });
          }
          // Collapse card after confirmation
          if (inlineCardContainer) {
            inlineCardContainer.style.display = 'none';
            isCardVisible = false;
            button.classList.remove('pillar-task-btn--active');
          }
          onExecute?.();
        },
        // onCancel callback
        () => {
          debug.log('[Pillar] Inline_ui action cancelled:', task.name);
          // Collapse card on cancel
          if (inlineCardContainer) {
            inlineCardContainer.style.display = 'none';
            isCardVisible = false;
            button.classList.remove('pillar-task-btn--active');
          }
        }
      );
      
      inlineCardContainer.appendChild(card);
      
      // Insert after the button group (parent of button)
      const buttonGroup = button.parentElement;
      if (buttonGroup && buttonGroup.parentElement) {
        buttonGroup.parentElement.insertBefore(inlineCardContainer, buttonGroup.nextSibling);
      }
      
      debug.log('[Pillar] Created inline_ui card for:', task.name);
    } else {
      // Show existing card
      inlineCardContainer.style.display = 'block';
    }
    
    isCardVisible = true;
    button.classList.add('pillar-task-btn--active');
    debug.log('[Pillar] Expanded inline_ui card:', task.name);
  }

  return button;
}

/**
 * Create a container with multiple task buttons.
 */
export function createTaskButtonGroup(tasks: TaskButtonData[]): HTMLDivElement {
  const container = document.createElement('div');
  container.className = 'pillar-task-btn-group';

  tasks.forEach((task) => {
    const button = createTaskButton({ task });
    container.appendChild(button);
  });

  return container;
}

/**
 * CSS styles for TaskButton (to be added to PANEL_STYLES).
 */
export const TASK_BUTTON_STYLES = `
/* Task Button Component */
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

/* Active state for inline_ui buttons with expanded card */
.pillar-task-btn--active {
  background: #1d4ed8;
  border-color: #1d4ed8;
}

/* Task button group */
.pillar-task-btn-group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

/* Inline card container for inline_ui actions */
.pillar-task-btn-inline-card {
  margin-top: 12px;
  animation: pillar-slide-down 0.15s ease-out;
}

@keyframes pillar-slide-down {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
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
`;
