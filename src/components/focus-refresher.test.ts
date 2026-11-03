import { describe, expect, it, vi } from "vitest";
import { FOCUS_REFRESH_MS, focusRefresher } from "./focus-refresher";

describe("focusRefresher", () => {
  it("refreshes when the tab shows again, at most once per interval", () => {
    let time = 0;
    const refresh = vi.fn();
    const onReturn = focusRefresher(refresh, () => time);
    onReturn(true);
    expect(refresh).not.toHaveBeenCalled();
    time = FOCUS_REFRESH_MS;
    onReturn(true);
    // Focus and visibilitychange fire together
    onReturn(true);
    expect(refresh).toHaveBeenCalledOnce();
    time += FOCUS_REFRESH_MS;
    onReturn(true);
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("does nothing while the tab is hidden", () => {
    let time = 0;
    const refresh = vi.fn();
    const onReturn = focusRefresher(refresh, () => time);
    time = FOCUS_REFRESH_MS * 3;
    onReturn(false);
    expect(refresh).not.toHaveBeenCalled();
  });
});
