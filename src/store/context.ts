/**
 * Context Store
 * Signal-based state for context and user profile
 */

import { signal, computed } from '@preact/signals';
import type { Context, InternalContext, UserProfile } from '../core/context';
import { DEFAULT_CONTEXT, DEFAULT_USER_PROFILE, MAX_RECENT_ACTIONS } from '../core/context';

// Context state (uses InternalContext internally to track recentActions)
export const context = signal<InternalContext>({ ...DEFAULT_CONTEXT });

// User profile state
export const userProfile = signal<UserProfile>({ ...DEFAULT_USER_PROFILE });

// Computed: has context (more than defaults)
export const hasContext = computed(() => {
  const ctx = context.value;
  return !!(
    ctx.currentPage ||
    ctx.currentFeature ||
    ctx.userRole ||
    ctx.errorState ||
    (ctx.recentActions && ctx.recentActions.length > 0)
  );
});

// Computed: has error state
export const hasError = computed(() => !!context.value.errorState);

// Actions

/**
 * Set context fields (merges with existing).
 */
export const setContext = (ctx: Partial<Context>) => {
  context.value = {
    ...context.value,
    ...ctx,
  };
};

/**
 * Set user profile.
 */
export const setUserProfile = (profile: UserProfile) => {
  userProfile.value = { ...profile };
};

/**
 * Report a user action (tracked internally).
 */
export const reportAction = (action: string) => {
  const recentActions = context.value.recentActions || [];
  
  context.value = {
    ...context.value,
    recentActions: [
      ...recentActions.slice(-(MAX_RECENT_ACTIONS - 1)),
      action,
    ],
  };
};

/**
 * Set error state.
 */
export const setErrorState = (code: string, message: string) => {
  context.value = {
    ...context.value,
    errorState: { code, message },
  };
};

/**
 * Clear error state.
 */
export const clearErrorState = () => {
  const { errorState: _, ...rest } = context.value;
  context.value = rest as InternalContext;
};

/**
 * Get the full assistant context for API calls.
 */
export const getAssistantContext = () => ({
  product: context.value,
  user_profile: userProfile.value,
});

/**
 * Reset all context state.
 */
export const resetContext = () => {
  context.value = { ...DEFAULT_CONTEXT };
  userProfile.value = { ...DEFAULT_USER_PROFILE };
};

