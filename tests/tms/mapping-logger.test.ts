import { afterEach, describe, expect, it, vi } from "vitest";
import { TmsUpstreamError } from "../../src/tms/errors";
import { logTmsMappingFailure } from "../../src/tms/logger";

describe("safe TMS mapping diagnostics", () => {
  afterEach(() => vi.restoreAllMocks());

  it("logs only an allowlisted category, field and record index", () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const error = new TmsUpstreamError("Load response contains invalid rate data.", {
      category: "invalid-field",
      field: "rate",
      recordIndex: 2,
    });

    logTmsMappingFailure({ operation: "search", requestId: "request-123", error });

    expect(warning).toHaveBeenCalledWith("[tms-mapping]", JSON.stringify({
      operation: "search",
      requestId: "request-123",
      recordIndex: 2,
      category: "invalid-field",
      field: "rate",
    }));
    expect(JSON.stringify(warning.mock.calls)).not.toContain("secret");
  });

  it("does not log arbitrary diagnostic fields or values", () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const error = new TmsUpstreamError("internal value secret", {
      category: "invalid-field",
      field: "rate|secret",
      recordIndex: 99,
    });

    logTmsMappingFailure({ operation: "detail", requestId: "request-123", error });

    expect(warning).not.toHaveBeenCalled();
  });

  it("logs only an allowlisted structural detail", () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const error = new TmsUpstreamError("internal value secret", {
      category: "invalid-field",
      field: "pickupDate",
      detail: "pattern",
    });

    logTmsMappingFailure({ operation: "search", requestId: "request-123", error });

    expect(warning).toHaveBeenCalledWith("[tms-mapping]", JSON.stringify({
      operation: "search",
      requestId: "request-123",
      recordIndex: 0,
      category: "invalid-field",
      field: "pickupDate",
      detail: "pattern",
      shape: undefined,
    }));
    expect(JSON.stringify(warning.mock.calls)).not.toContain("secret");
  });
});
