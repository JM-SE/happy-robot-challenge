import { MAX_TMS_DEADLINE_MS } from "./limits";

export class DeadlineExceededError extends Error {
  readonly code = "DEADLINE_EXCEEDED" as const;
  constructor() { super("The operation exceeded its deadline."); this.name = "DeadlineExceededError"; }
}

export const DEADLINE_PHASES = {
  AUTH: "auth",
  ADMISSION: "admission",
  CONFIG: "config",
  CONNECT: "connect",
  TLS: "tls",
  WRITE: "write",
  RESPONSE: "response",
  PARSE: "parse",
  MAPPING: "mapping",
  RECONCILIATION: "reconciliation",
} as const;
export type DeadlinePhase = typeof DEADLINE_PHASES[keyof typeof DEADLINE_PHASES];

export class DeadlineBudget {
  readonly signal: AbortSignal;
  private readonly controller = new AbortController();
  private readonly expiresAt: number;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private currentPhase: DeadlinePhase | undefined;
  constructor(timeoutMs: number, now = Date.now) {
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > MAX_TMS_DEADLINE_MS) throw new RangeError("Invalid deadline.");
    this.signal = this.controller.signal;
    this.expiresAt = now() + timeoutMs;
    this.timer = setTimeout(() => this.controller.abort(new DeadlineExceededError()), timeoutMs);
  }
  remainingMs(now = Date.now): number { return Math.max(0, this.expiresAt - now()); }
  checkpoint(now = Date.now): void { if (this.signal.aborted || this.remainingMs(now) === 0) { this.controller.abort(new DeadlineExceededError()); throw new DeadlineExceededError(); } }
  cancel(reason = new DOMException("Operation cancelled", "AbortError")): void { this.controller.abort(reason); this.dispose(); }
  dispose(): void { if (this.timer !== undefined) { clearTimeout(this.timer); this.timer = undefined; } }
  get phase(): DeadlinePhase | undefined { return this.currentPhase; }
  async run<T>(operation: (signal: AbortSignal, remainingMs: number) => Promise<T>): Promise<T> {
    try {
      return await this.runPhase(undefined, operation);
    } finally {
      this.dispose();
    }
  }
  async runPhase<T>(phase: DeadlinePhase | undefined, operation: (signal: AbortSignal, remainingMs: number) => Promise<T>): Promise<T> {
    this.checkpoint();
    this.currentPhase = phase;
    let onAbort: (() => void) | undefined;
    const aborted = new Promise<never>((_, reject) => {
      onAbort = () => reject(this.signal.reason ?? new DeadlineExceededError());
      if (this.signal.aborted) onAbort();
      else this.signal.addEventListener("abort", onAbort, { once: true });
    });
    try { return await Promise.race([operation(this.signal, this.remainingMs()), aborted]); }
    finally {
      if (onAbort) this.signal.removeEventListener("abort", onAbort);
      this.currentPhase = undefined;
    }
  }
}

export function createDeadlineBudget(timeoutMs: number): DeadlineBudget { return new DeadlineBudget(timeoutMs); }
