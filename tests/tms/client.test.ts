import { describe, expect, it } from "vitest";
import { TmsClient } from "../../src/tms/client";
import { TmsTimeoutError } from "../../src/tms/errors";
import type { TmsConfig } from "../../src/tms/types";
import type { TmsConnect, TmsSocket } from "../../src/tms/transport";

const config: TmsConfig = {
  host: "127.0.0.1", port: 9000, authToken: "token", connectTimeoutMs: 20, responseTimeoutMs: 20, maxFrameBytes: 4096,
};

class FakeSocket implements TmsSocket {
  private listeners = new Map<string, Array<(...args: unknown[]) => void>>();
  writes: Buffer[] = [];
  ended = false;
  destroyed = false;
  on(event: string, listener: (...args: unknown[]) => void): this { this.listeners.set(event, [...(this.listeners.get(event) ?? []), listener]); return this; }
  once(event: string, listener: (...args: unknown[]) => void): this { return this.on(event, listener); }
  removeListener(event: string, listener: (...args: unknown[]) => void): this { this.listeners.set(event, (this.listeners.get(event) ?? []).filter((candidate) => candidate !== listener)); return this; }
  write(data: Buffer, callback?: (error?: Error | null) => void): boolean { this.writes.push(data); callback?.(); return true; }
  end(): this { this.ended = true; return this; }
  destroy(): this { this.destroyed = true; return this; }
  emit(event: string, ...args: unknown[]): void { for (const listener of this.listeners.get(event) ?? []) listener(...args); }
}

describe("TmsClient", () => {
  it("uses a new socket, writes once, parses response and closes", async () => {
    const sockets: FakeSocket[] = [];
    const connect: TmsConnect = () => { const socket = new FakeSocket(); sockets.push(socket); queueMicrotask(() => { socket.emit("connect"); socket.emit("data", Buffer.from("MSG:hello\r\nEND\r\n")); }); return socket; };
    const client = new TmsClient(config, connect);
    await expect(client.execute({ command: "DEBUG_ECHO", fields: { MSG: "hello" } })).resolves.toMatchObject({ records: [{ fields: { MSG: "hello" } }] });
    await expect(client.execute({ command: "DEBUG_ECHO", fields: { MSG: "again" } })).resolves.toBeDefined();
    expect(sockets).toHaveLength(2);
    expect(sockets[0].writes).toHaveLength(1);
    expect(sockets[0].writes[0].toString()).toContain("CMD:DEBUG_ECHO|AUTH:token|MSG:hello\r\n");
    expect(sockets[0].ended).toBe(true);
  });

  it("times out and destroys a socket that never connects", async () => {
    let socket: FakeSocket | undefined;
    const client = new TmsClient(config, () => { socket = new FakeSocket(); return socket; });
    await expect(client.execute({ command: "DEBUG_ECHO", fields: { MSG: "hello" } })).rejects.toBeInstanceOf(TmsTimeoutError);
    expect(socket?.destroyed).toBe(true);
  });
});
