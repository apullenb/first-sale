// At most one refresh this often, however many focus and visibility events fire
export const FOCUS_REFRESH_MS = 5000;

// Calls `refresh` when the tab is visible again, throttled; the page has fresh data when it loads
export function focusRefresher(refresh: () => void, now: () => number = Date.now) {
  let last = now();
  return (visible: boolean) => {
    if (!visible || now() - last < FOCUS_REFRESH_MS) return;
    last = now();
    refresh();
  };
}
