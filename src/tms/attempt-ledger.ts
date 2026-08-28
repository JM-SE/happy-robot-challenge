import { createHash, randomUUID } from "node:crypto";
import { mkdir, open, rename, type FileHandle } from "node:fs/promises";
import { join } from "node:path";
import { TmsConfigurationError } from "./errors";

export interface BookingAttemptBinding {
  loadId: string;
  runId: string;
  sessionId: string;
}

export interface BookingAttemptLedger {
  consumeOnce(binding: BookingAttemptBinding): Promise<string>;
  transition(binding: BookingAttemptBinding, claimToken: string, state: BookingAttemptState): Promise<void>;
}

export const BOOKING_ATTEMPT_STATES = {
  NOT_SENT: "not-sent",
  SENT: "sent",
  UNKNOWN: "unknown",
} as const;
export type BookingAttemptState = (typeof BOOKING_ATTEMPT_STATES)[keyof typeof BOOKING_ATTEMPT_STATES];

export interface FileBookingAttemptLedgerOptions {
  /** Test-only fault seam. A failed sync leaves the claim in place. */
  readonly syncFile?: (handle: FileHandle) => Promise<void>;
  /** Test-only fault seam for the directory durability barrier. */
  readonly syncDirectory?: (directory: string) => Promise<void>;
  /** Test-only deterministic fencing-token seam. */
  readonly createClaimToken?: () => string;
}

function loadDigest(loadId: string): string {
  return createHash("sha256")
    .update(loadId, "utf8")
    .digest("hex");
}

function bindingDigest(binding: BookingAttemptBinding): string {
  return createHash("sha256")
    .update(JSON.stringify([binding.loadId, binding.runId, binding.sessionId]), "utf8")
    .digest("hex");
}

export class InMemoryBookingAttemptLedger implements BookingAttemptLedger {
  private readonly consumed = new Set<string>();
  private readonly states = new Map<string, BookingAttemptState>();

  async consumeOnce(binding: BookingAttemptBinding): Promise<string> {
    const key = loadDigest(binding.loadId);
    if (this.consumed.has(key)) throw new TmsConfigurationError("The booking attempt has already been consumed.");
    this.consumed.add(key);
    this.states.set(key, BOOKING_ATTEMPT_STATES.NOT_SENT);
    return key;
  }

  async transition(binding: BookingAttemptBinding, claimToken: string, state: BookingAttemptState): Promise<void> {
    const current = this.states.get(loadDigest(binding.loadId));
    if (!current || claimToken !== loadDigest(binding.loadId)) throw new TmsConfigurationError("The booking attempt claim fence does not match.");
    if (state === BOOKING_ATTEMPT_STATES.NOT_SENT || (current === BOOKING_ATTEMPT_STATES.UNKNOWN && state === BOOKING_ATTEMPT_STATES.SENT) || (current === BOOKING_ATTEMPT_STATES.SENT && state !== BOOKING_ATTEMPT_STATES.SENT)) {
      throw new TmsConfigurationError("The durable booking attempt cannot become uncertain after success.");
    }
    this.states.set(claimToken, state);
  }
}

export class FileBookingAttemptLedger implements BookingAttemptLedger {
  constructor(
    private readonly directory: string,
    private readonly options: FileBookingAttemptLedgerOptions = {},
  ) {}

  async consumeOnce(binding: BookingAttemptBinding): Promise<string> {
    if (!this.directory.trim()) throw new TmsConfigurationError("A durable booking attempt ledger directory is required.");
    let claimToken: string | undefined;
    try {
      await mkdir(this.directory, { recursive: true });
    } catch {
      throw new TmsConfigurationError("The durable booking attempt ledger is unavailable.");
    }
    const attemptKey = loadDigest(binding.loadId);
    const digest = bindingDigest(binding);
    const path = join(this.directory, `${attemptKey}.attempt`);
    try {
      const handle = await open(path, "wx");
      try {
        // O_EXCL is the create-only fence. A partially written file is
        // intentionally never removed: after a crash it blocks the attempt.
        claimToken = this.options.createClaimToken?.() ?? randomUUID();
        if (!claimToken.trim()) throw new Error("empty claim token");
        await handle.writeFile(
          JSON.stringify({
            schemaVersion: 1,
            attemptKey,
            bindingDigest: digest,
            claimToken,
            fenceToken: claimToken,
            state: BOOKING_ATTEMPT_STATES.NOT_SENT satisfies BookingAttemptState,
            rollbackAvailable: false,
            claimedAt: new Date().toISOString(),
          }) + "\n",
          "utf8",
        );
        await (this.options.syncFile ?? defaultSyncFile)(handle);
      } finally {
        await handle.close();
      }
      await (this.options.syncDirectory ?? defaultSyncDirectory)(this.directory);
      return claimToken!;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") {
        await this.rejectExistingClaim(path, attemptKey, digest);
      }
      throw new TmsConfigurationError("The durable booking attempt ledger is unavailable.");
    }
  }

  async transition(binding: BookingAttemptBinding, claimToken: string, state: BookingAttemptState): Promise<void> {
    if (!claimToken.trim()) throw new TmsConfigurationError("The durable booking attempt claim is invalid.");
    if (state === BOOKING_ATTEMPT_STATES.NOT_SENT) throw new TmsConfigurationError("The durable booking attempt state cannot move backwards.");
    const attemptKey = loadDigest(binding.loadId);
    const path = join(this.directory, `${attemptKey}.attempt`);
    let value: unknown;
    try {
      const handle = await open(path, "r");
      try { value = JSON.parse(await handle.readFile("utf8")); } finally { await handle.close(); }
    } catch { throw new TmsConfigurationError("The durable booking attempt ledger is unavailable."); }
    const digest = bindingDigest(binding);
    if (!isLedgerRecord(value) || value.attemptKey !== attemptKey || value.bindingDigest !== digest || value.claimToken !== claimToken) {
      throw new TmsConfigurationError("The durable booking attempt claim fence does not match.");
    }
    if ((value.state === BOOKING_ATTEMPT_STATES.UNKNOWN && state === BOOKING_ATTEMPT_STATES.SENT)
      || (value.state === BOOKING_ATTEMPT_STATES.SENT && state === BOOKING_ATTEMPT_STATES.UNKNOWN)
      )
      throw new TmsConfigurationError("The durable booking attempt cannot become uncertain after success.");
    const replacement = join(this.directory, `.${attemptKey}.${claimToken}.tmp`);
    const handle = await open(replacement, "wx");
    try {
      await handle.writeFile(`${JSON.stringify({ ...value, state })}\n`, "utf8");
      await (this.options.syncFile ?? defaultSyncFile)(handle);
    } finally { await handle.close(); }
    try {
      await rename(replacement, path);
      await (this.options.syncDirectory ?? defaultSyncDirectory)(this.directory);
    } catch {
      throw new TmsConfigurationError("The durable booking attempt ledger is unavailable.");
    }
  }

  private async rejectExistingClaim(path: string, attemptKey: string, digest: string): Promise<never> {
    let recordText: string;
    try {
      const record = await open(path, "r");
      try {
        recordText = await record.readFile("utf8");
      } finally {
        await record.close();
      }
    } catch {
      throw new TmsConfigurationError("The durable booking attempt ledger is unavailable.");
    }

    if (!recordText.trim()) {
      throw new TmsConfigurationError("The durable booking attempt ledger contains a corrupt claim.");
    }

    let value: unknown;
    try {
      value = JSON.parse(recordText);
    } catch {
      throw new TmsConfigurationError("The durable booking attempt ledger contains a corrupt claim.");
    }
    if (!isLedgerRecord(value) || value.attemptKey !== attemptKey) {
      throw new TmsConfigurationError("The durable booking attempt ledger contains a corrupt claim.");
    }
    if (value.bindingDigest !== digest) {
      throw new TmsConfigurationError("The booking attempt has already been consumed; the binding does not match the durable claim.");
    }
    throw new TmsConfigurationError("The booking attempt has already been consumed.");
  }
}

interface LedgerRecord {
  schemaVersion: 1;
  attemptKey: string;
  bindingDigest: string;
  claimToken: string;
  fenceToken: string;
  state: BookingAttemptState;
  rollbackAvailable: false;
  claimedAt: string;
}

function isLedgerRecord(value: unknown): value is LedgerRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return record.schemaVersion === 1
    && typeof record.attemptKey === "string" && record.attemptKey.length > 0
    && typeof record.bindingDigest === "string" && /^[a-f0-9]{64}$/.test(record.bindingDigest)
    && typeof record.claimToken === "string" && record.claimToken.length > 0
    && record.fenceToken === record.claimToken
    && (record.state === "not-sent" || record.state === "sent" || record.state === "unknown")
    && record.rollbackAvailable === false
    && typeof record.claimedAt === "string" && record.claimedAt.length > 0;
}

async function defaultSyncFile(handle: FileHandle): Promise<void> {
  await handle.sync();
}

async function defaultSyncDirectory(directory: string): Promise<void> {
  // Windows does not expose a synchronisable directory handle through the
  // Node filesystem API. The exclusive create plus flushed file is the
  // equivalent supported durability barrier on that platform.
  if (process.platform === "win32") return;
  const handle = await open(directory, "r");
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}
