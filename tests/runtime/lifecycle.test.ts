import { describe, expect, it, vi } from "vitest";
import { RuntimeLifecycle } from "../../src/runtime/lifecycle";

describe("runtime lifecycle", () => {
  it("closes owned resources once and in reverse registration order", async () => {
    const events: string[] = [];
    const lifecycle = new RuntimeLifecycle();
    lifecycle.register({ close: () => { events.push("first"); } });
    lifecycle.register({ close: () => { events.push("second"); } });
    await lifecycle.close();
    await lifecycle.close();
    expect(events).toEqual(["second", "first"]);
  });

  it("does not reject when a resource close fails", async () => {
    const lifecycle = new RuntimeLifecycle();
    lifecycle.register({ close: vi.fn(async () => { throw new Error("private detail"); }) });
    await expect(lifecycle.close()).resolves.toBeUndefined();
  });
});
