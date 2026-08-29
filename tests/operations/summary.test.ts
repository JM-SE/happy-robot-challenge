import { describe, expect, it } from "vitest";
import { createDemoFixtures } from "../../src/operations/fixtures";
import { summarizeCalls } from "../../src/operations/summary";
describe("operations summary", () => { it("calculates canonical fixture KPIs", () => { const summary = summarizeCalls(createDemoFixtures()); expect(summary.totalCalls).toBe(8); expect(summary.fmcsaverified).toBe(7); expect(summary.fmcsaDenominator).toBe(7); expect(summary.loadsMatched).toBe(3); expect(summary.demoBookings).toBe(1); expect(summary.failedNegotiations).toBe(1); expect(summary.handoffs).toBe(1); expect(summary.technicalErrors).toBe(1); }); it("returns null for an empty denominator", () => { expect(summarizeCalls([]).fmcsaVerificationRate).toBeNull(); }); });
