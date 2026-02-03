/**
 * useDebouncedValue Hook
 * 
 * Debounces a value by a specified delay. Useful for preventing
 * rapid UI updates during streaming text or frequent state changes.
 */

import { useEffect, useState } from 'preact/hooks';

/**
 * Returns a debounced version of the provided value.
 * The returned value only updates after the specified delay has passed
 * without the input value changing.
 * 
 * @param value - The value to debounce
 * @param delay - Delay in milliseconds before updating (default: 50ms)
 * @returns The debounced value
 * 
 * @example
 * ```tsx
 * const debouncedText = useDebouncedValue(rapidlyChangingText, 50);
 * // debouncedText only updates every 50ms at most
 * ```
 */
export function useDebouncedValue<T>(value: T, delay: number = 50): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // Set up timer to update debounced value after delay
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Cleanup: cancel timer if value changes before delay completes
    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}
