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

describe("adaptive preview fixtures", () => {
  it("models a Pro account with only a weekly quota", async () => {
    vi.stubGlobal("window", { location: { search: "?plan=pro&window=weekly" } });
    const value = await fetchUsage();
    expect(value.plan).toBe("Pro");
    expect(value.windows).toHaveLength(1);
    expect(value.windows?.[0].resetDurationSeconds).toBe(604800);
  });
  it("models a different duration without changing production defaults", async () => {
    vi.stubGlobal("window", { location: { search: "?plan=pro&duration=1440" } });
    expect((await fetchUsage()).windows?.[0].resetDurationSeconds).toBe(86400);
    vi.stubGlobal("window", { location: { search: "" } });
    expect((await fetchUsage()).windows?.[0].resetDurationSeconds).toBe(18000);
  });
  it("does not invent unlimited usage when Pro has no windows", async () => {
    vi.stubGlobal("window", { location: { search: "?plan=pro&window=none" } });
    expect((await fetchUsage()).windows).toEqual([]);
  });
});
