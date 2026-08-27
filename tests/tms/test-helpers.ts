import type { TmsConfig } from "../../src/tms/types";
import type { TmsConnect, TmsSocket } from "../../src/tms/transport";

type Listener = (...args: unknown[]) => void;
type RegisteredListener = { listener: Listener; once: boolean };

/** A deterministic socket double for lifecycle/race tests. */
export class TestSocket implements TmsSocket {
  private readonly listeners = new Map<string, RegisteredListener[]>();
  readonly writes: Buffer[] = [];
  ended = false;
  destroyed = false;
  endCalls = 0;
  destroyCalls = 0;
  writeError: Error | null = null;

  on(event: string, listener: Listener): this {
    const current = this.listeners.get(event) ?? [];
    current.push({ listener, once: false });
    this.listeners.set(event, current);
    return this;
  }

  once(event: string, listener: Listener): this {
    const current = this.listeners.get(event) ?? [];
    current.push({ listener, once: true });
    this.listeners.set(event, current);
    return this;
  }

  removeListener(event: string, listener: Listener): this {
    this.listeners.set(event, (this.listeners.get(event) ?? []).filter((entry) => entry.listener !== listener));
    return this;
  }

  listenerCount(event: string): number {
    return this.listeners.get(event)?.length ?? 0;
  }

  write(data: Buffer, callback?: (error?: Error | null) => void): boolean {
    this.writes.push(data);
    callback?.(this.writeError);
    return true;
  }

  end(): this {
    this.ended = true;
    this.endCalls += 1;
    return this;
  }

  destroy(): this {
    this.destroyed = true;
    this.destroyCalls += 1;
    return this;
  }

  emit(event: string, ...args: unknown[]): void {
    const current = [...(this.listeners.get(event) ?? [])];
    for (const entry of current) {
      if (entry.once) this.removeListener(event, entry.listener);
      entry.listener(...args);
    }
  }
}

export function socketConnect(socket: TestSocket): TmsConnect {
  return () => socket;
}

export function testConfig(overrides: Partial<TmsConfig> = {}): TmsConfig {
  return {
    mode: "mock",
    host: "127.0.0.1",
    port: 9000,
    authToken: "test-token",
    connectTimeoutMs: 25,
    responseTimeoutMs: 25,
    maxFrameBytes: 4096,
    ...overrides,
  };
}

export function oneByteChunks(value: string | Buffer): Buffer[] {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(value, "utf8");
  return Array.from({ length: bytes.length }, (_, index) => bytes.subarray(index, index + 1));
}

export function expectNoSocketListeners(socket: TestSocket): void {
  for (const event of ["connect", "data", "error", "end", "close"]) {
    if (socket.listenerCount(event) !== 0) throw new Error(`listener leaked for ${event}`);
  }
}
