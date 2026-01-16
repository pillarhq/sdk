/**
 * Product Context Types for Pillar SDK
 * 
 * These types enable context-aware assistance by providing
 * information about what the user is doing in the product.
 */

/**
 * Product context for the assistant.
 * Pass this to help the assistant understand what the user is doing.
 */
export interface ProductContext {
  /** Current page path (e.g., "/settings/billing") */
  currentPage?: string;

  /** Current feature or section (e.g., "Billing Settings") */
  currentFeature?: string;

  /** User's role in the product (e.g., "admin", "member") */
  userRole?: string;

  /** Current user state or mode (e.g., "onboarding", "trial") */
  userState?: string;

  /** Recent user actions for context */
  recentActions?: string[];

  /** Any error state the user is experiencing */
  errorState?: {
    code: string;
    message: string;
  };

  /** Custom context data */
  custom?: Record<string, unknown>;
}

/**
 * User profile for personalization.
 */
export interface UserProfile {
  /** User identifier (for conversation continuity) */
  userId?: string;

  /** User's name for personalized responses */
  name?: string;

  /** User's role/permissions */
  role?: string;

  /** Account/organization info */
  accountType?: string;

  /** User's experience level */
  experienceLevel?: 'beginner' | 'intermediate' | 'advanced';
}

/**
 * Suggestion returned from the suggestions API.
 */
export interface Suggestion {
  type: 'article' | 'video' | 'tutorial' | 'action';
  id: string;
  title: string;
  description: string;
  relevanceScore: number;
  url?: string;
}

/**
 * Combined context sent to the backend.
 */
export interface AssistantContext {
  product: ProductContext;
  user: UserProfile;
}

/**
 * Default empty context.
 */
export const DEFAULT_PRODUCT_CONTEXT: ProductContext = {
  recentActions: [],
};

export const DEFAULT_USER_PROFILE: UserProfile = {};

/**
 * Maximum number of recent actions to track.
 */
export const MAX_RECENT_ACTIONS = 10;

