import net from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { TmsClient } from "../../src/tms/client";
import { TmsProtocolError, TmsResponseIncompleteError } from "../../src/tms/errors";
import { createMockLtmsServer } from "../../mock/ltms-server";
import { MOCK_FAULT_SCENARIOS } from "../../mock/scenarios";
import { testConfig } from "./test-helpers";

function readRawResponse(port: number, request: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host: "127.0.0.1", port });
    const chunks: Buffer[] = [];
    socket.on("connect", () => socket.end(request));
    socket.on("data", (chunk: Buffer) => chunks.push(chunk));
    socket.on("end", () => resolve(Buffer.concat(chunks)));
    socket.on("error", reject);
  });
}

describe("configurable local fault scenarios over TCP", () => {
  let server: ReturnType<typeof createMockLtmsServer> | undefined;

  afterEach(async () => {
    await server?.stop();
    server = undefined;
  });

  it.each([MOCK_FAULT_SCENARIOS.FRAGMENTED, MOCK_FAULT_SCENARIOS.DELAYED_END] as const)(
    "preserves the command-specific echo response with %s",
    async (scenario) => {
      server = createMockLtmsServer({ port: 0, authToken: "test-token", fault: scenario, faultDelayMs: 1 });
      const address = await server.start();
      const response = await new TmsClient(testConfig({ host: address.host, port: address.port })).execute({
        command: "DEBUG_ECHO",
        fields: { MSG: `${scenario}-echo` },
      });
      expect(response.records[0]?.fields).toEqual({ MSG: `${scenario}-echo`, FIELD_COUNT: "3" });
      expect(server.requestCount).toBe(1);
    },
  );

  it.each([MOCK_FAULT_SCENARIOS.FRAGMENTED, MOCK_FAULT_SCENARIOS.DELAYED_END] as const)(
    "preserves the command-specific search response with %s",
    async (scenario) => {
      server = createMockLtmsServer({ port: 0, authToken: "test-token", fault: scenario, faultDelayMs: 1 });
      const address = await server.start();
      const response = await new TmsClient(testConfig({ host: address.host, port: address.port })).execute({
        command: "LOAD_QUERY",
        fields: { ORIG_STATE: "TX", MAX_RESULTS: 1 },
      });
      expect(response.records).toHaveLength(1);
      expect(response.records[0]?.fields).toMatchObject({
        LOAD_ID: "LOAD-1001",
        ORIG_STATE: "TX",
        DEST_STATE: "CA",
        EQTYPE: "DRY_VAN",
      });
      expect(response.records[0]?.fields).not.toHaveProperty("MSG");
    },
  );

  it.each([MOCK_FAULT_SCENARIOS.FRAGMENTED, MOCK_FAULT_SCENARIOS.DELAYED_END] as const)(
    "preserves the command-specific detail response with %s",
    async (scenario) => {
      server = createMockLtmsServer({ port: 0, authToken: "test-token", fault: scenario, faultDelayMs: 1 });
      const address = await server.start();
      const response = await new TmsClient(testConfig({ host: address.host, port: address.port })).execute({
        command: "LOAD_GET",
        fields: { LOAD_ID: "LOAD-1002" },
      });
      expect(response.records).toHaveLength(1);
      expect(response.records[0]?.fields).toMatchObject({
        LOAD_ID: "LOAD-1002",
        ORIG_STATE: "IL",
        DEST_STATE: "GA",
        EQTYPE: "REEFER",
        NOTES: "",
      });
      expect(response.records[0]?.fields).not.toHaveProperty("MSG");
    },
  );

  it.each([MOCK_FAULT_SCENARIOS.FRAGMENTED, MOCK_FAULT_SCENARIOS.DELAYED_END] as const)(
    "preserves the command-specific booking response with %s",
    async (scenario) => {
      server = createMockLtmsServer({ port: 0, authToken: "test-token", fault: scenario, faultDelayMs: 1 });
      const address = await server.start();
      const response = await new TmsClient(testConfig({ host: address.host, port: address.port })).execute({
        command: "LOAD_BOOK",
        fields: { LOAD_ID: "LOAD-1001", MC_NUM: "12345", AGREED_RATE: 2200 },
      });
      expect(response.records[0]?.fields).toMatchObject({
        LOAD_ID: "LOAD-1001",
        MC_NUM: "12345",
        AGREED_RATE: "2200",
        BOOKING_REF: "BOOK-LOAD-1001",
      });
      expect(response.records[0]?.fields).not.toHaveProperty("MSG");
      expect(server.requestCount).toBe(1);
    },
  );

  it("keeps fragmented wire delivery byte-for-byte identical for a non-echo command", async () => {
    const request = Buffer.from("CMD:LOAD_GET|AUTH:test-token|LOAD_ID:LOAD-1001\r\n", "utf8");
    server = createMockLtmsServer({ port: 0, authToken: "test-token" });
    const normalAddress = await server.start();
    const normalResponse = await readRawResponse(normalAddress.port, request);
    await server.stop();
    server = undefined;

    server = createMockLtmsServer({ port: 0, authToken: "test-token", fault: MOCK_FAULT_SCENARIOS.FRAGMENTED, fragmentSize: 1 });
    const fragmentedAddress = await server.start();
    const fragmentedResponse = await readRawResponse(fragmentedAddress.port, request);

    expect(fragmentedResponse.equals(normalResponse)).toBe(true);
    expect(fragmentedResponse.toString("utf8")).toContain("LOAD_ID:LOAD-1001");
    expect(fragmentedResponse.toString("utf8")).toContain("END\r\n");
  });

  it("turns a configurable no-response fault into a response timeout", async () => {
    server = createMockLtmsServer({ port: 0, authToken: "test-token", fault: MOCK_FAULT_SCENARIOS.NO_RESPONSE });
    const address = await server.start();
    await expect(new TmsClient(testConfig({ host: address.host, port: address.port, responseTimeoutMs: 25 })).execute({
      command: "DEBUG_ECHO", fields: { MSG: "hello" },
    })).rejects.toMatchObject({ code: "RESPONSE_TIMEOUT", stage: "response" });
    expect(server.connectionCount).toBe(1);
    expect(server.requestCount).toBe(1);
    expect(server.dispatchCount).toBe(0);
  });

  it.each([
    [MOCK_FAULT_SCENARIOS.PARTIAL_WITHOUT_END, TmsResponseIncompleteError],
    [MOCK_FAULT_SCENARIOS.MALFORMED, TmsProtocolError],
    [MOCK_FAULT_SCENARIOS.INVALID_FRAMING, TmsProtocolError],
  ] as const)("classifies %s as a terminal client failure", async (scenario, errorType) => {
    server = createMockLtmsServer({ port: 0, authToken: "test-token", fault: scenario });
    const address = await server.start();
    await expect(new TmsClient(testConfig({ host: address.host, port: address.port })).execute({ command: "DEBUG_ECHO", fields: { MSG: "hello" } })).rejects.toBeInstanceOf(errorType);
    expect(server.connectionCount).toBe(1);
    expect(server.requestCount).toBe(1);
    expect(server.dispatchCount).toBe(0);
  });

  it("maps a configurable server error and never retries the booking command", async () => {
    server = createMockLtmsServer({ port: 0, authToken: "test-token", fault: MOCK_FAULT_SCENARIOS.SERVER_ERROR });
    const address = await server.start();
    const client = new TmsClient(testConfig({ host: address.host, port: address.port }));
    await expect(client.execute({ command: "LOAD_BOOK", fields: { LOAD_ID: "LOAD-1001", MC_NUM: "12345", AGREED_RATE: 2200 } })).rejects.toMatchObject({
      type: "TMS_REMOTE", code: "SERVER_ERROR",
    });
    expect(server.connectionCount).toBe(1);
    expect(server.requestCount).toBe(1);
    expect(server.dispatchCount).toBe(0);
  });
});

describe("remote-code matrix and booking isolation", () => {
  let server: ReturnType<typeof createMockLtmsServer> | undefined;

  afterEach(async () => {
    await server?.stop();
    server = undefined;
  });

  it("supports every remote code through the production mock without sharing booking state", async () => {
    server = createMockLtmsServer({ port: 0, authToken: "token" });
    const address = await server.start();
    const client = new TmsClient(testConfig({ host: address.host, port: address.port, authToken: "wrong" }));
    await expect(client.execute({ command: "DEBUG_ECHO", fields: { MSG: "hello" } })).rejects.toMatchObject({ code: "AUTH_FAILED" });

    const errorCases: Array<[string, Parameters<TmsClient["execute"]>[0]]> = [
      ["UNKNOWN_CMD", { command: "FUTURE_COMMAND" }],
      ["MISSING_FIELD", { command: "LOAD_QUERY" }],
      ["UNKNOWN_LOAD", { command: "LOAD_GET", fields: { LOAD_ID: "LOAD-404" } }],
    ];
    for (const [code, request] of errorCases) {
      const isolatedClient = new TmsClient(testConfig({ host: address.host, port: address.port, authToken: "token" }));
      await expect(isolatedClient.execute(request)).rejects.toMatchObject({ code });
    }

    const valid = new TmsClient(testConfig({ host: address.host, port: address.port, authToken: "token" }));
    await expect(valid.execute({ command: "LOAD_BOOK", fields: { LOAD_ID: "LOAD-1001", MC_NUM: "12345", AGREED_RATE: 2301 } })).rejects.toMatchObject({ code: "INVALID_RATE" });
    await expect(valid.execute({ command: "LOAD_BOOK", fields: { LOAD_ID: "LOAD-1001", MC_NUM: "12345", AGREED_RATE: 2200 } })).resolves.toBeDefined();
    await expect(valid.execute({ command: "LOAD_BOOK", fields: { LOAD_ID: "LOAD-1001", MC_NUM: "12345", AGREED_RATE: 2200 } })).rejects.toMatchObject({ code: "ALREADY_BOOKED" });

    const serverError = createMockLtmsServer({ port: 0, authToken: "token", bookingServerError: true });
    const serverErrorAddress = await serverError.start();
    try {
      await expect(new TmsClient(testConfig({ host: serverErrorAddress.host, port: serverErrorAddress.port, authToken: "token" })).execute({
        command: "LOAD_BOOK", fields: { LOAD_ID: "LOAD-1002", MC_NUM: "12345", AGREED_RATE: 2900 },
      })).rejects.toMatchObject({ code: "SERVER_ERROR" });
    } finally {
      await serverError.stop();
    }
  });

  it("does not mutate booking state when a booking fails, and isolates instances", async () => {
    server = createMockLtmsServer({ port: 0, authToken: "token", bookingServerError: false });
    const address = await server.start();
    const client = new TmsClient(testConfig({ host: address.host, port: address.port, authToken: "token" }));
    await expect(client.execute({ command: "LOAD_BOOK", fields: { LOAD_ID: "LOAD-1001", MC_NUM: "12345", AGREED_RATE: 2301 } })).rejects.toMatchObject({ code: "INVALID_RATE" });
    await expect(client.execute({ command: "LOAD_BOOK", fields: { LOAD_ID: "LOAD-1001", MC_NUM: "12345", AGREED_RATE: 2200 } })).resolves.toBeDefined();

    const second = createMockLtmsServer({ port: 0, authToken: "token" });
    const secondAddress = await second.start();
    try {
      await expect(new TmsClient(testConfig({ host: secondAddress.host, port: secondAddress.port, authToken: "token" })).execute({
        command: "LOAD_BOOK", fields: { LOAD_ID: "LOAD-1001", MC_NUM: "12345", AGREED_RATE: 2200 },
      })).resolves.toBeDefined();
    } finally {
      await second.stop();
    }
  });
});
