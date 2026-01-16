/**
 * Router Store
 * Signal-based state for panel navigation
 */

import { signal, computed } from '@preact/signals';
import { resetChat } from './chat';

export type ViewType = 'home' | 'chat';

export interface ViewState {
  type: ViewType;
  params?: Record<string, string>;
}

// Navigation stack for back button support
export const viewStack = signal<ViewState[]>([]);

// Current active view
export const currentView = signal<ViewState>({ type: 'home' });

// Computed: whether we can go back
export const canGoBack = computed(() => viewStack.value.length > 0);

// Computed: whether we're at home
export const isAtHome = computed(() => currentView.value.type === 'home');

// Actions
export const navigate = (view: ViewType, params?: Record<string, string>) => {
  // Push current state to stack before navigating
  viewStack.value = [...viewStack.value, { ...currentView.value }];
  currentView.value = { type: view, params };
};

export const goBack = () => {
  const stack = viewStack.value;
  if (stack.length > 0) {
    // Clear chat when leaving chat views
    const currentType = currentView.value.type;
    if (currentType === 'chat') {
      resetChat();
    }

    const previousState = stack[stack.length - 1];
    currentView.value = previousState;
    viewStack.value = stack.slice(0, -1);
  }
};

export const goHome = () => {
  // Clear chat when leaving chat views
  const currentType = currentView.value.type;
  if (currentType === 'chat') {
    resetChat();
  }

  viewStack.value = [];
  currentView.value = { type: 'home' };
};

export const resetRouter = () => {
  viewStack.value = [];
  currentView.value = { type: 'home' };
};

// Navigate to chat view
export const navigateToChat = () => {
  navigate('chat');
};
