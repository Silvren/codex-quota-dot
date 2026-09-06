import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchUsage } from "./usageProvider";

afterEach(() => vi.unstubAllGlobals());

describe("browser preview", () => {
  it.each(["", "?remaining=", "?remaining=garbage", "?remaining=101"])("uses the default quota for %s", async (search) => {
    vi.stubGlobal("window", { location: { search } });
    expect((await fetchUsage()).fiveHour.remainingPercent).toBe(36);
  });
  it("preserves explicit zero", async () => {
    vi.stubGlobal("window", { location: { search: "?remaining=0" } });
    expect((await fetchUsage()).fiveHour.remainingPercent).toBe(0);
  });
});
