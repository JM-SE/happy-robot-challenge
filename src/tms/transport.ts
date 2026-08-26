import net from "node:net";

export interface TmsSocket {
  on(event: "connect" | "data" | "error" | "end" | "close", listener: (...args: unknown[]) => void): this;
  once(event: "connect" | "error" | "end" | "close", listener: (...args: unknown[]) => void): this;
  removeListener(event: string, listener: (...args: unknown[]) => void): this;
  write(data: Buffer, callback?: (error?: Error | null) => void): boolean;
  end(callback?: () => void): this;
  destroy(): this;
}

export interface TmsConnectOptions {
  host: string;
  port: number;
}

/** Injectable transport seam; a future TLS connector can implement this contract. */
export type TmsConnect = (options: TmsConnectOptions) => TmsSocket;

export const connectTcp: TmsConnect = ({ host, port }) => net.createConnection({ host, port });
