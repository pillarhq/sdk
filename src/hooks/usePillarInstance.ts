/**
 * usePillarInstance Hook
 *
 * Provides access to the Pillar singleton instance.
 * This is a convenience hook for components that need to interact
 * with the Pillar SDK (e.g., calling plan/workflow methods).
 *
 * Note: This returns a stable reference since Pillar is a singleton.
 * The value may be null if the SDK is not initialized.
 */

import { useMemo } from 'preact/hooks';
import Pillar from '../core/Pillar';

/**
 * Hook to get the Pillar SDK instance.
 *
 * @returns The Pillar instance or null if not initialized
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const pillar = usePillarInstance();
 *
 *   const handleClick = () => {
 *     pillar?.startPlan();
 *   };
 *
 *   return <button onClick={handleClick}>Start</button>;
 * }
 * ```
 */
export function usePillarInstance() {
  return useMemo(() => Pillar.getInstance(), []);
}
