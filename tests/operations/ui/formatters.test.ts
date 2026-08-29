import { expect, it } from "vitest"; import { date, rate } from "../../../src/operations/lib/formatters";
it("uses safe formatting fallbacks", () => { expect(date("bad")).toBe("Unavailable"); expect(rate(undefined)).toBe("—"); });
