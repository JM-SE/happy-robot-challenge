import net from "node:net";

export interface TmsSocket {
  on(event: "connect" | "data" | "error" | "end" | "close", listener: (...args: unknown[]) => void): this;
  once(event: "connect" | "error" | "end" | "close", listener: (...args: unknown[]) => void): this;
  removeListener(event: string, listener: (...args: unknown[]) => void): this;
  write(data: Buffer, callback?: (error?: Error | null) => void): boolean;
  end(callback?: () => void): this;
  destroy(): this;
}

export type TmsConnect = (options: { host: string; port: number }) => TmsSocket;

export const connectTcp: TmsConnect = ({ host, port }) => net.createConnection({ host, port });
