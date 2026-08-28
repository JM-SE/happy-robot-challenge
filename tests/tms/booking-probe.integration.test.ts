import { afterEach, describe, expect, it } from "vitest";
import { createMockLtmsServer } from "../../mock/ltms-server";
import { createCarrierValidationHandoff, createNegotiationHandoff, ControlledBookingWorkflow, selectLoad, selectSoleLoadForValidation, type QueryRun } from "../../src/tms/controlled-booking";
import { createBookingCapability, runRealControlledBooking, wasPostWriteUncertain } from "./real/booking-probe";
import { createRealBookingCapability } from "../../src/tms/policy";
import { TmsClient } from "../../src/tms/client";
import type { TmsConfig } from "../../src/tms/types";

const runId = "run-local-2c";
const sessionId = "session-local-2c";

function handoffs(loadId: string, agreedRate: number) {
  return {
    negotiation: { loadId, runId, sessionId, agreedRate, finalAccepted: true, counterofferCount: 1 },
    carrier: { loadId, runId, sessionId, mcNumber: "12345", validated: true, validatedAt: Date.now(), validationReference: "fmcsa-local" },
  };
}

describe("Phase 2C booking workflow locally", () => {
  let server: ReturnType<typeof createMockLtmsServer> | undefined;

  afterEach(async () => {
    await server?.stop();
    server = undefined;
  });

  it("uses one current query, explicit selection, detail and one booking request", async () => {
    server = createMockLtmsServer({ port: 0, authToken: "token" });
    const address = await server.start();
    const config: TmsConfig = { mode: "real", host: address.host, port: address.port, authToken: "token", connectTimeoutMs: 1000, responseTimeoutMs: 1000, maxFrameBytes: 4096 };
    const capability = createRealBookingCapability(config, true);
    const selected = "LOAD-1002";
    const { negotiation, carrier } = handoffs(selected, 2900);

    const result = await runRealControlledBooking(config, {
      query: { originState: "IL", maxResults: 1 }, runId, sessionId, selectedLoadId: selected, selectionConfirmed: true,
      negotiation, carrier, bookingConfirmed: true,
    }, capability);

    expect(result.query.run.candidates).toHaveLength(1);
    expect(result.selection.selectedLoadId).toBe(selected);
    expect(result.detail.load.loadId).toBe(selected);
    expect(result.booking.booking.loadId).toBe(selected);
    expect(server.requestCount).toBe(3);
    expect(server.dispatchCount).toBe(3);
  });

  it("requires explicit selection confirmation before detail", async () => {
    server = createMockLtmsServer({ port: 0, authToken: "token" });
    const address = await server.start();
    const config: TmsConfig = { mode: "real", host: address.host, port: address.port, authToken: "token", connectTimeoutMs: 1000, responseTimeoutMs: 1000, maxFrameBytes: 4096 };
    const capability = createRealBookingCapability(config, true);
    const client = new TmsClient(config, undefined, capability);
    const workflow = new ControlledBookingWorkflow(config, client, capability);
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
    const config: TmsConfig = { mode: "real", host: address.host, port: address.port, authToken: "token", connectTimeoutMs: 1000, responseTimeoutMs: 1000, maxFrameBytes: 4096 };
    const capability = createRealBookingCapability(config, true);
    const client = new TmsClient(config, undefined, capability);
    const workflow = new ControlledBookingWorkflow(config, client, capability);
    const result = await workflow.query({ originState: "IL", maxResults: 1 }, runId, sessionId);
    workflow.select("LOAD-1002", true);
    await workflow.detail();

    const { negotiation, carrier } = handoffs("LOAD-1001", 2900);
    expect(() => workflow.authorize(createNegotiationHandoff(negotiation), createCarrierValidationHandoff(carrier), true)).toThrow(/selected load/i);
    expect(result.run.candidates[0]!.loadId).toBe("LOAD-1002");
    expect(server.requestCount).toBe(2);
  });

  it("requires explicit 2C confirmation when creating the runner capability", () => {
    expect(() => createBookingCapability({ mode: "real", host: "127.0.0.1", port: 9000, authToken: "token", connectTimeoutMs: 1, responseTimeoutMs: 1, maxFrameBytes: 4096 }, { NODE_ENV: "test", TMS_REAL_BOOKING_CONFIRMED: "false" })).toThrow();
  });

  it("does not classify a failed preflight GET as post-write booking uncertainty", async () => {
    server = createMockLtmsServer({ port: 0, authToken: "token" });
    const address = await server.start();
    const config: TmsConfig = { mode: "real", host: address.host, port: address.port, authToken: "token", connectTimeoutMs: 1000, responseTimeoutMs: 1000, maxFrameBytes: 4096 };
    const capability = createRealBookingCapability(config, true);
    const client = new TmsClient(config, undefined, capability);
    let error: unknown;

    try {
      await client.execute({ command: "LOAD_GET", fields: { LOAD_ID: "MISSING-LOAD" }, requestId: "phase-2c-preflight" });
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
    const config: TmsConfig = { mode: "real", host: address.host, port: address.port, authToken: "token", connectTimeoutMs: 1000, responseTimeoutMs: 20, maxFrameBytes: 4096 };
    const capability = createRealBookingCapability(config, true);
    const client = new TmsClient(config, undefined, capability);
    const workflow = new ControlledBookingWorkflow(config, client, capability);
    const query = await workflow.query({ originState: "IL", maxResults: 1 }, runId, sessionId);
    workflow.select("LOAD-1002", true);
    await workflow.detail();
    const { negotiation, carrier } = handoffs("LOAD-1002", 2900);
    const authorization = workflow.authorize(createNegotiationHandoff(negotiation), createCarrierValidationHandoff(carrier), true);

    const error = await workflow.book(authorization).catch((caught) => caught);
    expect(error).toMatchObject({ code: "RESPONSE_TIMEOUT", metadata: { writeAttempted: true } });
    expect(wasPostWriteUncertain(error)).toBe(true);
    await expect(workflow.book(authorization)).rejects.toThrow(/already been consumed/i);
    const reconciled = await workflow.reconcile(authorization, (load) => load.status === "BOOKED");

    expect(query.run.candidates).toHaveLength(1);
    expect(reconciled.load.loadId).toBe("LOAD-1002");
    expect(reconciled.outcome).toBe("reconciled");
    expect(server.requestCount).toBe(4);
  });

  it("does not permit reconciliation after a successful booking", async () => {
    server = createMockLtmsServer({ port: 0, authToken: "token" });
    const address = await server.start();
    const config: TmsConfig = { mode: "real", host: address.host, port: address.port, authToken: "token", connectTimeoutMs: 1000, responseTimeoutMs: 1000, maxFrameBytes: 4096 };
    const capability = createRealBookingCapability(config, true);
    const workflow = new ControlledBookingWorkflow(config, new TmsClient(config, undefined, capability), capability);
    const query = await workflow.query({ originState: "IL", maxResults: 1 }, runId, sessionId);
    workflow.select(query.run.candidates[0]!.loadId, true);
    await workflow.detail();
    const { negotiation, carrier } = handoffs("LOAD-1002", 2900);
    const authorization = workflow.authorize(createNegotiationHandoff(negotiation), createCarrierValidationHandoff(carrier), true);

    await workflow.book(authorization);

    await expect(workflow.reconcile(authorization, () => true)).rejects.toThrow(/genuine post-write booking uncertainty/i);
    expect(server.requestCount).toBe(3);
  });

  it("consumes the booking budget before concurrent booking calls", async () => {
    server = createMockLtmsServer({ port: 0, authToken: "token" });
    const address = await server.start();
    const config: TmsConfig = { mode: "real", host: address.host, port: address.port, authToken: "token", connectTimeoutMs: 1000, responseTimeoutMs: 1000, maxFrameBytes: 4096 };
    const capability = createRealBookingCapability(config, true);
    const workflow = new ControlledBookingWorkflow(config, new TmsClient(config, undefined, capability), capability);
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
});
