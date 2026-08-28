import type { Socket } from "node:net";

export const MOCK_FAULT_SCENARIOS = {
  NONE: "none",
  NO_RESPONSE: "no-response",
  PARTIAL_WITHOUT_END: "partial-without-end",
  MALFORMED: "malformed",
  INVALID_FRAMING: "invalid-framing",
  DELAYED_END: "delayed-end",
  FRAGMENTED: "fragmented",
  SERVER_ERROR: "server-error",
  POST_WRITE_NO_RESPONSE: "post-write-no-response",
} as const;

export type MockFaultName = (typeof MOCK_FAULT_SCENARIOS)[keyof typeof MOCK_FAULT_SCENARIOS];

export interface MockRemoteFault {
  kind: "remote-error";
  code: string;
  message?: string;
}

export type MockFaultScenario = MockFaultName | MockRemoteFault;

export interface MockFaultOptions {
  scenario: MockFaultScenario;
  delayMs?: number;
  fragmentSize?: number;
}

export type MockTimer = ReturnType<typeof setTimeout>;
export type MockSchedule = (callback: () => void, delayMs: number) => void;

const DEFAULT_DELAY_MS = 10;
const DEFAULT_FRAGMENT_SIZE = 1;

function errorFrame(code: string, message: string): Buffer {
  const safeCode = code.replace(/[^A-Za-z0-9_]/g, "_").toUpperCase().slice(0, 64) || "INJECTED_ERROR";
  const safeMessage = message.replace(/[|\r\n]/g, " ").slice(0, 256) || "Injected remote failure";
  return Buffer.from(`ERR|CODE:${safeCode}|MSG:${safeMessage}\r\n`, "utf8");
}

function validDelay(value: number | undefined): number {
  return Number.isFinite(value) && (value ?? 0) >= 0 ? value ?? 0 : DEFAULT_DELAY_MS;
}

function validFragmentSize(value: number | undefined): number {
  return Number.isInteger(value) && (value ?? 0) > 0 ? value ?? DEFAULT_FRAGMENT_SIZE : DEFAULT_FRAGMENT_SIZE;
}

export function resolveMockFault(options: {
  fault?: MockFaultScenario;
  faultScenario?: MockFaultScenario;
  bookingServerError?: boolean;
  faultDelayMs?: number;
  fragmentSize?: number;
}): MockFaultOptions | undefined {
  const scenario = options.fault ?? options.faultScenario ?? (options.bookingServerError ? MOCK_FAULT_SCENARIOS.SERVER_ERROR : undefined);
  if (!scenario || scenario === MOCK_FAULT_SCENARIOS.NONE) return undefined;
  return { scenario, delayMs: validDelay(options.faultDelayMs), fragmentSize: validFragmentSize(options.fragmentSize) };
}

/** Applies a fault that must terminate before command dispatch. */
export function applyPreDispatchFault(socket: Socket, fault: MockFaultOptions | undefined): boolean {
  if (!fault) return false;
  const { scenario } = fault;

  if (scenario === MOCK_FAULT_SCENARIOS.NO_RESPONSE) return true;
  if (scenario === MOCK_FAULT_SCENARIOS.PARTIAL_WITHOUT_END) {
    socket.end(Buffer.from("MSG:partial\r\n", "utf8"));
    return true;
  }
  if (scenario === MOCK_FAULT_SCENARIOS.MALFORMED) {
    socket.end(Buffer.from("NOT_A_FIELD\r\nEND\r\n", "utf8"));
    return true;
  }
  if (scenario === MOCK_FAULT_SCENARIOS.INVALID_FRAMING) {
    socket.end(Buffer.from("MSG:bad\nEND\r\n", "utf8"));
    return true;
  }
  if (scenario === MOCK_FAULT_SCENARIOS.SERVER_ERROR) {
    socket.end(errorFrame("SERVER_ERROR", "Booking service unavailable"));
    return true;
  }
  if (typeof scenario === "object") {
    socket.end(errorFrame(scenario.code, scenario.message ?? "Injected remote failure"));
    return true;
  }
  return false;
}

/** Delivers a command-specific response while applying only post-dispatch delivery faults. */
export function writePostDispatchResponse(
  socket: Socket,
  response: Buffer,
  fault: MockFaultOptions | undefined,
  schedule: MockSchedule,
): boolean {
  if (!fault) return false;
  const { scenario } = fault;

  if (scenario === MOCK_FAULT_SCENARIOS.POST_WRITE_NO_RESPONSE) return true;

  if (scenario === MOCK_FAULT_SCENARIOS.FRAGMENTED) {
    const fragmentSize = fault.fragmentSize ?? DEFAULT_FRAGMENT_SIZE;
    for (let offset = 0; offset < response.length; offset += fragmentSize) {
      socket.write(response.subarray(offset, offset + fragmentSize));
    }
    socket.end();
    return true;
  }
  if (scenario === MOCK_FAULT_SCENARIOS.DELAYED_END) {
    const terminalFrame = Buffer.from("END\r\n", "utf8");
    if (!response.subarray(-terminalFrame.length).equals(terminalFrame)) {
      socket.end(response);
      return true;
    }

    socket.write(response.subarray(0, -terminalFrame.length));
    schedule(() => {
      if (!socket.destroyed) socket.end(terminalFrame);
    }, fault.delayMs ?? DEFAULT_DELAY_MS);
    return true;
  }
  return false;
}
