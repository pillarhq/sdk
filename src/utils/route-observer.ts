/**
 * Route Observer
 * Detects SPA navigation and notifies when the route changes.
 * 
 * Supports:
 * - pushState/replaceState (React Router, Vue Router, etc.)
 * - popstate (browser back/forward)
 * - hashchange (hash-based routing)
 */

export interface RouteInfo {
  pathname: string;
  search: string;
  hash: string;
  url: string;
  title: string;
}

export type RouteChangeCallback = (route: RouteInfo) => void;

export interface RouteObserverOptions {
  /** Debounce rapid route changes (ms). Default: 100 */
  debounceMs?: number;
}

export class RouteObserver {
  private _callback: RouteChangeCallback | null = null;
  private _debounceMs: number;
  private _debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private _lastRoute: string | null = null;
  private _running = false;

  // Store original methods to restore on stop
  private _originalPushState: typeof history.pushState | null = null;
  private _originalReplaceState: typeof history.replaceState | null = null;

  constructor(options: RouteObserverOptions = {}) {
    this._debounceMs = options.debounceMs ?? 100;
  }

  /**
   * Whether the observer is currently running.
   */
  get running(): boolean {
    return this._running;
  }

  /**
   * Register a callback for route changes.
   */
  onRouteChange(callback: RouteChangeCallback): void {
    this._callback = callback;
  }

  /**
   * Start observing route changes.
   */
  start(): void {
    if (this._running) return;
    if (typeof window === 'undefined') return;

    this._running = true;
    this._lastRoute = this._getCurrentUrl();

    // Patch history methods to detect pushState/replaceState
    this._patchHistory();

    // Listen for popstate (back/forward navigation)
    window.addEventListener('popstate', this._handleRouteChange);

    // Listen for hashchange (hash-based routing)
    window.addEventListener('hashchange', this._handleRouteChange);
  }

  /**
   * Stop observing route changes.
   */
  stop(): void {
    if (!this._running) return;

    this._running = false;

    // Restore original history methods
    this._restoreHistory();

    // Remove event listeners
    window.removeEventListener('popstate', this._handleRouteChange);
    window.removeEventListener('hashchange', this._handleRouteChange);

    // Clear debounce timer
    if (this._debounceTimer) {
      clearTimeout(this._debounceTimer);
      this._debounceTimer = null;
    }
  }

  /**
   * Get the current route info.
   */
  getCurrentRoute(): RouteInfo {
    return {
      pathname: window.location.pathname,
      search: window.location.search,
      hash: window.location.hash,
      url: window.location.href,
      title: document.title,
    };
  }

  /**
   * Patch history.pushState and history.replaceState to detect navigation.
   */
  private _patchHistory(): void {
    // Save original methods
    this._originalPushState = history.pushState.bind(history);
    this._originalReplaceState = history.replaceState.bind(history);

    // Patch pushState
    history.pushState = (...args) => {
      this._originalPushState!(...args);
      this._handleRouteChange();
    };

    // Patch replaceState
    history.replaceState = (...args) => {
      this._originalReplaceState!(...args);
      this._handleRouteChange();
    };
  }

  /**
   * Restore original history methods.
   */
  private _restoreHistory(): void {
    if (this._originalPushState) {
      history.pushState = this._originalPushState;
    }
    if (this._originalReplaceState) {
      history.replaceState = this._originalReplaceState;
    }
    this._originalPushState = null;
    this._originalReplaceState = null;
  }

  /**
   * Handle route change (with debouncing).
   */
  private _handleRouteChange = (): void => {
    // Clear existing debounce timer
    if (this._debounceTimer) {
      clearTimeout(this._debounceTimer);
    }

    // Debounce rapid changes
    this._debounceTimer = setTimeout(() => {
      const currentUrl = this._getCurrentUrl();

      // Only fire if route actually changed
      if (currentUrl !== this._lastRoute) {
        this._lastRoute = currentUrl;

        if (this._callback) {
          this._callback(this.getCurrentRoute());
        }
      }
    }, this._debounceMs);
  };

  /**
   * Get current URL for comparison.
   */
  private _getCurrentUrl(): string {
    return window.location.pathname + window.location.search + window.location.hash;
  }
}
