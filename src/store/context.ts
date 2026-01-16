/**
 * Context Store
 * Signal-based state for product context and user profile
 * 
 * Phase 3: Product Integration - Context-aware assistance
 */

import { signal, computed } from '@preact/signals';
import type { ProductContext, UserProfile } from '../core/context';
import { DEFAULT_PRODUCT_CONTEXT, DEFAULT_USER_PROFILE, MAX_RECENT_ACTIONS } from '../core/context';

// Product context state
export const productContext = signal<ProductContext>({ ...DEFAULT_PRODUCT_CONTEXT });

// User profile state
export const userProfile = signal<UserProfile>({ ...DEFAULT_USER_PROFILE });

// Computed: has context (more than defaults)
export const hasContext = computed(() => {
  const ctx = productContext.value;
  return !!(
    ctx.currentPage ||
    ctx.currentFeature ||
    ctx.userRole ||
    ctx.errorState ||
    (ctx.recentActions && ctx.recentActions.length > 0)
  );
});

// Computed: has error state
export const hasError = computed(() => !!productContext.value.errorState);

// Actions

/**
 * Set the complete product context.
 */
export const setProductContext = (context: ProductContext) => {
  productContext.value = {
    ...context,
    recentActions: context.recentActions || [],
  };
};

/**
 * Update specific product context fields.
 */
export const updateContext = (updates: Partial<ProductContext>) => {
  productContext.value = {
    ...productContext.value,
    ...updates,
  };
};

/**
 * Set user profile.
 */
export const setUserProfile = (profile: UserProfile) => {
  userProfile.value = { ...profile };
};

/**
 * Report a user action.
 */
export const reportAction = (action: string) => {
  const recentActions = productContext.value.recentActions || [];
  
  productContext.value = {
    ...productContext.value,
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
  productContext.value = {
    ...productContext.value,
    errorState: { code, message },
  };
};

/**
 * Clear error state.
 */
export const clearErrorState = () => {
  const { errorState: _, ...rest } = productContext.value;
  productContext.value = rest as ProductContext;
};

/**
 * Get the full assistant context for API calls.
 */
export const getAssistantContext = () => ({
  product: productContext.value,
  user_profile: userProfile.value,
});

/**
 * Reset all context state.
 */
export const resetContext = () => {
  productContext.value = { ...DEFAULT_PRODUCT_CONTEXT };
  userProfile.value = { ...DEFAULT_USER_PROFILE };
};

