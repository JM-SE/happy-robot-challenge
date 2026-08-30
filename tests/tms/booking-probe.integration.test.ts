import { afterEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createMockLtmsServer } from "../../mock/ltms-server";
import { createCarrierValidationHandoff, createNegotiationHandoff, ControlledBookingWorkflow, selectLoad, selectSoleLoadForValidation, type QueryRun } from "../../src/tms/controlled-booking";
import { createBookingCapability, readRealBookingRuntimeInput, runRealControlledBooking, wasPostWriteUncertain } from "./real/booking-probe";
import { TMS_EXECUTION_SCOPES, type TmsCommandPolicy } from "../../src/tms/policy";
import { createControlledBookingPort } from "../../src/tms/client";
import { TmsRemoteError } from "../../src/tms/errors";
import type { TmsConfig } from "../../src/tms/types";
import { FileBookingAttemptLedger } from "../../src/tms/attempt-ledger";
import type { AuthoritativeReconciliationClassifier } from "../../src/tms/real/reconciliation";

const runId = "run-local-2c";
const sessionId = "session-local-2c";
const ledgerDirectories: string[] = [];

function testLedger(): FileBookingAttemptLedger {
  const directory = join(tmpdir(), `happyrobot-phase-2c-${randomUUID()}`);
  ledgerDirectories.push(directory);
  return new FileBookingAttemptLedger(directory);
}

function handoffs(loadId: string, agreedRate: number) {
  return {
    negotiation: { loadId, runId, sessionId, agreedRate, finalAccepted: true, counterofferCount: 1 },
    carrier: { loadId, runId, sessionId, mcNumber: "12345", validated: true, validatedAt: Date.now(), validationReference: "fmcsa-local" },
  };
}

function realConfig(address: { host: string; port: number }, overrides: Partial<TmsConfig> = {}): TmsConfig {
  return {
    mode: "mock",
    host: address.host,
    port: address.port,
    authToken: "token",
    connectTimeoutMs: 1000,
    responseTimeoutMs: 1000,
    maxFrameBytes: 4096,
    targetPin: `${address.host}:${address.port}`,
    approvedTargets: [`${address.host}:${address.port}`],
    transportApproval: "private-network",
    ...overrides,
  };
}

function localCapability(): TmsCommandPolicy {
  return { scope: TMS_EXECUTION_SCOPES.MOCK_LOCAL };
}

function loadResponse(loadId = "LOAD-1", status?: string) {
  return {
    records: [{
      rawLine: `LOAD_ID:${loadId}|RATE:100`,
      fields: {
        LOAD_ID: loadId,
        ORIG_STATE: "TX",
        DEST_STATE: "CA",
        ORIG_CITY: "Dallas",
        DEST_CITY: "Los Angeles",
        EQTYPE: "DRY_VAN",
        RATE: "100",
        MAX_BUY: "100",
        ...(status ? { STATUS: status } : {}),
      },
    }],
    rawBytes: 100,
  };
}

describe("Phase 2C booking workflow locally", () => {
  let server: ReturnType<typeof createMockLtmsServer> | undefined;

  afterEach(async () => {
    await server?.stop();
    server = undefined;
    await Promise.all(ledgerDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
  });

  it("uses one current query, explicit selection, detail and one booking request", async () => {
    server = createMockLtmsServer({ port: 0, authToken: "token" });
    const address = await server.start();
    const config = realConfig(address);
    const capability = localCapability();
    const selected = "LOAD-1002";
    const { negotiation, carrier } = handoffs(selected, 2900);

    const result = await runRealControlledBooking(config, {
      query: { originState: "IL", maxResults: 1 }, runId, sessionId, selectedLoadId: selected, selectionConfirmed: true,
      negotiation, carrier, bookingConfirmed: true,
    }, capability, undefined, {
      ledger: testLedger(),
      handoffProvider: {
        getNegotiation: () => createNegotiationHandoff(negotiation),
        getCarrierValidation: () => createCarrierValidationHandoff(carrier),
      },
    });

    expect(result.query.run.candidates).toHaveLength(1);
    expect(result.selection.selectedLoadId).toBe(selected);
    expect(result.detail.load.loadId).toBe(selected);
    expect(result.booking.booking.loadId).toBe(selected);
    expect(server.requestCount).toBe(3);
    expect(server.dispatchCount).toBe(3);
  });

  it("rejects a rate above the private ceiling before authorization or booking side effects", async () => {
    server = createMockLtmsServer({ port: 0, authToken: "token" });
    const address = await server.start();
    const config = realConfig(address);
    const error = await runRealControlledBooking(config, {
      query: { originState: "TX", maxResults: 1 },
      runId,
      sessionId,
      selectedLoadId: "LOAD-1001",
      selectionConfirmed: true,
      negotiation: { loadId: "LOAD-1001", runId, sessionId, agreedRate: 2301, finalAccepted: true, counterofferCount: 1 },
      carrier: { loadId: "LOAD-1001", runId, sessionId, mcNumber: "12345", validated: true, validatedAt: Date.now(), validationReference: "fmcsa-local" },
      bookingConfirmed: true,
    }, localCapability(), undefined, { ledger: testLedger() }).catch((caught) => caught);

    expect(error).toMatchObject({ code: "RATE_NOT_ACCEPTED" });
    expect(server.requestCount).toBe(2);
    expect(server.dispatchCount).toBe(2);
  });

  it("requires explicit selection confirmation before detail", async () => {
    server = createMockLtmsServer({ port: 0, authToken: "token" });
    const address = await server.start();
    const config = realConfig(address);
    const capability = localCapability();
     const port = createControlledBookingPort(config, capability);
      const workflow = new ControlledBookingWorkflow(config, port, capability, undefined, undefined, testLedger());
    const result = await workflow.query({ originState: "TX" }, runId, sessionId);

    expect(result.run.candidates.length).toBeGreaterThan(0);
    expect(() => workflow.select(result.run.candidates[0]!.loadId, false)).toThrow(/explicit load selection/i);
    expect(server.requestCount).toBe(1);
  });

  it("does not allow sole-result validation to hide multiple candidates", () => {
    const queryRun: QueryRun = {
      runId,
      sessionId,
      query: { originState: "TX", maxResults: 1 },
      candidates: [
        { loadId: "LOAD-1", originState: "TX", destinationState: "CA", originCity: "Dallas", destinationCity: "Los Angeles", equipmentType: "DRY_VAN", rate: 100, notes: "" },
        { loadId: "LOAD-2", originState: "TX", destinationState: "CA", originCity: "Dallas", destinationCity: "Los Angeles", equipmentType: "DRY_VAN", rate: 110, notes: "" },
      ],
      queriedAt: Date.now(),
      expiresAt: Date.now() + 1000,
    };

    expect(() => selectSoleLoadForValidation(queryRun, true)).toThrow(/exactly one returned candidate/i);
    expect(() => selectLoad(queryRun, "LOAD-1", false)).toThrow(/explicit load selection/i);
    expect(selectLoad(queryRun, "LOAD-1", true).selectedLoadId).toBe("LOAD-1");
    expect(() => selectLoad({ ...queryRun, expiresAt: 100 }, "LOAD-1", true, 100)).toThrow(/expired/i);
  });

  it("requires handoffs bound to the exact selected load and session", async () => {
    server = createMockLtmsServer({ port: 0, authToken: "token" });
    const address = await server.start();
    const config = realConfig(address);
    const capability = localCapability();
     const port = createControlledBookingPort(config, capability);
      const workflow = new ControlledBookingWorkflow(config, port, capability, undefined, undefined, testLedger());
    const result = await workflow.query({ originState: "IL", maxResults: 1 }, runId, sessionId);
    workflow.select("LOAD-1002", true);
    await workflow.detail();

    const { negotiation, carrier } = handoffs("LOAD-1001", 2900);
    expect(() => workflow.authorize(createNegotiationHandoff(negotiation), createCarrierValidationHandoff(carrier), true)).toThrow(/selected load/i);
    expect(result.run.candidates[0]!.loadId).toBe("LOAD-1002");
    expect(server.requestCount).toBe(2);
  });

  it("requires explicit 2C confirmation when creating the runner capability", () => {
    expect(() => createBookingCapability({ mode: "real", host: "127.0.0.1", port: 9000, authToken: "token", connectTimeoutMs: 1, responseTimeoutMs: 1, maxFrameBytes: 4096 })).toThrow(/authority|blocked/i);
  });

  it("does not treat runtime JSON handoffs as trusted real inputs", () => {
    expect(() => readRealBookingRuntimeInput({
      NODE_ENV: "test",
      TMS_MODE: "real",
      TMS_ENV: "non-production",
      TMS_REAL_ENABLED: "true",
      TMS_REAL_BOOK_QUERY_JSON: JSON.stringify({ originState: "TX" }),
      TMS_REAL_BOOK_NEGOTIATION_JSON: "{}",
    })).toThrow(/trusted provider/i);
  });

  it("does not classify a failed preflight GET as post-write booking uncertainty", async () => {
    server = createMockLtmsServer({ port: 0, authToken: "token" });
    const address = await server.start();
    const config = realConfig(address);
    const capability = localCapability();
     const port = createControlledBookingPort(config, capability);
    let error: unknown;

    try {
       await port.execute({ command: "LOAD_GET", fields: { LOAD_ID: "MISSING-LOAD" }, requestId: "phase-2c-preflight" });
    } catch (caught) {
      error = caught;
    }

    expect(error).toMatchObject({ code: "UNKNOWN_LOAD", metadata: { command: "LOAD_GET", writeAttempted: true } });
    expect(wasPostWriteUncertain(error)).toBe(false);
    expect(server.requestCount).toBe(1);
  });

  it("allows only one reconciliation after a post-write timeout", async () => {
    server = createMockLtmsServer({ port: 0, authToken: "token", fault: "post-write-no-response" });
    const address = await server.start();
    const config = realConfig(address, { responseTimeoutMs: 20 });
    const capability = localCapability();
     const port = createControlledBookingPort(config, capability);
      const workflow = new ControlledBookingWorkflow(config, port, capability, undefined, undefined, testLedger());
    const query = await workflow.query({ originState: "IL", maxResults: 1 }, runId, sessionId);
    workflow.select("LOAD-1002", true);
    await workflow.detail();
    const { negotiation, carrier } = handoffs("LOAD-1002", 2900);
    const authorization = workflow.authorize(createNegotiationHandoff(negotiation), createCarrierValidationHandoff(carrier), true);

    const error = await workflow.book(authorization).catch((caught) => caught);
    expect(error).toMatchObject({ code: "RESPONSE_TIMEOUT", metadata: { writeAttempted: true } });
    expect(wasPostWriteUncertain(error)).toBe(true);
    await expect(workflow.book(authorization)).rejects.toThrow(/already been consumed/i);
    const classifier: AuthoritativeReconciliationClassifier = { classify: (load) => load.status === "BOOKED" ? "reconciled" : "still-uncertain" };
    const reconciled = await workflow.reconcile(authorization, classifier);

    expect(query.run.candidates).toHaveLength(1);
    expect(reconciled.load.loadId).toBe("LOAD-1002");
    expect(reconciled.outcome).toBe("reconciled");
    expect(server.requestCount).toBe(4);
  });

  it("does not permit reconciliation after a successful booking", async () => {
    server = createMockLtmsServer({ port: 0, authToken: "token" });
    const address = await server.start();
    const config = realConfig(address);
    const capability = localCapability();
      const workflow = new ControlledBookingWorkflow(config, createControlledBookingPort(config, capability), capability, undefined, undefined, testLedger());
    const query = await workflow.query({ originState: "IL", maxResults: 1 }, runId, sessionId);
    workflow.select(query.run.candidates[0]!.loadId, true);
    await workflow.detail();
    const { negotiation, carrier } = handoffs("LOAD-1002", 2900);
    const authorization = workflow.authorize(createNegotiationHandoff(negotiation), createCarrierValidationHandoff(carrier), true);

    await workflow.book(authorization);

    await expect(workflow.reconcile(authorization)).rejects.toThrow(/genuine post-write booking uncertainty/i);
    expect(server.requestCount).toBe(3);
  });

  it("consumes the booking budget before concurrent booking calls", async () => {
    server = createMockLtmsServer({ port: 0, authToken: "token" });
    const address = await server.start();
    const config = realConfig(address);
    const capability = localCapability();
      const workflow = new ControlledBookingWorkflow(config, createControlledBookingPort(config, capability), capability, undefined, undefined, testLedger());
    const query = await workflow.query({ originState: "IL", maxResults: 1 }, runId, sessionId);
    workflow.select(query.run.candidates[0]!.loadId, true);
    await workflow.detail();
    const { negotiation, carrier } = handoffs("LOAD-1002", 2900);
    const authorization = workflow.authorize(createNegotiationHandoff(negotiation), createCarrierValidationHandoff(carrier), true);

    const results = await Promise.allSettled([workflow.book(authorization), workflow.book(authorization)]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")[0]).toMatchObject({ reason: expect.objectContaining({ message: expect.stringMatching(/already been consumed/i) }) });
    expect(server.requestCount).toBe(3);
  });

  it("treats a malformed post-write booking response as uncertain", async () => {
    const config = realConfig({ host: "127.0.0.1", port: 9000 });
    const capability = localCapability();
    let bookingCalls = 0;
    const port = {
      execute: async ({ command }: { command: string }) => {
        if (command === "LOAD_QUERY" || command === "LOAD_GET") return loadResponse();
        throw new Error("Booking must use the dedicated execution method.");
      },
      executeBooking: async () => {
        bookingCalls += 1;
        return { records: [{ rawLine: "LOAD_ID:LOAD-1", fields: { LOAD_ID: "LOAD-1", MC_NUM: "12345", AGREED_RATE: "100" } }], rawBytes: 50 };
      },
    };
    const workflow = new ControlledBookingWorkflow(config, port, capability, undefined, undefined, testLedger());
    const query = await workflow.query({ originState: "TX" }, runId, sessionId);
    workflow.select(query.run.candidates[0]!.loadId, true);
    await workflow.detail();
    const { negotiation, carrier } = handoffs("LOAD-1", 100);
    const authorization = workflow.authorize(createNegotiationHandoff(negotiation), createCarrierValidationHandoff(carrier), true);

    await expect(workflow.book(authorization)).rejects.toThrow(/booking response contains an invalid/i);
    expect(workflow.currentState).toBe("uncertain");
    expect(bookingCalls).toBe(1);
    await expect(workflow.book(authorization)).rejects.toThrow(/already been consumed/i);
  });

  it("keeps complete remote booking rejections deterministic after consuming the budget", async () => {
    const config = realConfig({ host: "127.0.0.1", port: 9000 });
    const capability = localCapability();
    const port = {
      execute: async ({ command }: { command: string }) => {
        if (command === "LOAD_QUERY" || command === "LOAD_GET") return loadResponse();
        throw new Error("Booking must use the dedicated execution method.");
      },
      executeBooking: async () => {
        throw new TmsRemoteError("INVALID_RATE", "", false);
      },
    };
    const workflow = new ControlledBookingWorkflow(config, port, capability, undefined, undefined, testLedger());
    const query = await workflow.query({ originState: "TX" }, runId, sessionId);
    workflow.select(query.run.candidates[0]!.loadId, true);
    await workflow.detail();
    const { negotiation, carrier } = handoffs("LOAD-1", 100);
    const authorization = workflow.authorize(createNegotiationHandoff(negotiation), createCarrierValidationHandoff(carrier), true);

    await expect(workflow.book(authorization)).rejects.toMatchObject({ type: "TMS_REMOTE", code: "INVALID_RATE" });
    expect(workflow.currentState).toBe("terminal");
    await expect(workflow.reconcile(authorization)).rejects.toThrow(/genuine post-write booking uncertainty/i);
  });

  it("denies the generic booking fallback in real mode before consuming the ledger", async () => {
    const config = { ...realConfig({ host: "127.0.0.1", port: 9000 }), mode: "real" as const };
    const capability = localCapability();
    const port = { execute: async () => loadResponse() };
    const workflow = new ControlledBookingWorkflow(config, port, capability, undefined, undefined, testLedger());
    const query = await workflow.query({ originState: "TX" }, runId, sessionId);
    workflow.select(query.run.candidates[0]!.loadId, true);
    await workflow.detail();
    const { negotiation, carrier } = handoffs("LOAD-1", 100);
    expect(() => workflow.authorize(createNegotiationHandoff(negotiation), createCarrierValidationHandoff(carrier), true)).toThrow(/test-only handoffs/i);
  });
});
