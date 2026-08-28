import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { FileBookingAttemptLedger, InMemoryBookingAttemptLedger } from "../../src/tms/attempt-ledger";

const binding = { loadId: "LOAD-1", runId: "run-1", sessionId: "session-1" };
const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("booking attempt ledger", () => {
  it("rejects a duplicate claim in memory", async () => {
    const ledger = new InMemoryBookingAttemptLedger();
    await ledger.consumeOnce(binding);
    await expect(ledger.consumeOnce(binding)).rejects.toThrow(/already been consumed/i);
  });

  it("rejects a duplicate claim after a ledger instance restart", async () => {
    const directory = await mkdtemp(join(tmpdir(), "happyrobot-ledger-"));
    temporaryDirectories.push(directory);
    await new FileBookingAttemptLedger(directory).consumeOnce(binding);

    await expect(new FileBookingAttemptLedger(directory).consumeOnce(binding)).rejects.toThrow(/already been consumed/i);
  });

  it("rejects the same load after a new run or session is supplied", async () => {
    const directory = await mkdtemp(join(tmpdir(), "happyrobot-ledger-"));
    temporaryDirectories.push(directory);
    await new FileBookingAttemptLedger(directory).consumeOnce(binding);

    await expect(new FileBookingAttemptLedger(directory).consumeOnce({ ...binding, runId: "run-2", sessionId: "session-2" })).rejects.toThrow(/already been consumed/i);
  });

  it("allows only one concurrent durable claim", async () => {
    const directory = await mkdtemp(join(tmpdir(), "happyrobot-ledger-"));
    temporaryDirectories.push(directory);
    const ledger = new FileBookingAttemptLedger(directory);
    const results = await Promise.allSettled([
      ledger.consumeOnce(binding),
      ledger.consumeOnce(binding),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
  });

  it("allows only one claim across independent workers", async () => {
    const directory = await mkdtemp(join(tmpdir(), "happyrobot-ledger-"));
    temporaryDirectories.push(directory);
    const results = await Promise.allSettled([
      new FileBookingAttemptLedger(directory).consumeOnce(binding),
      new FileBookingAttemptLedger(directory).consumeOnce(binding),
      new FileBookingAttemptLedger(directory).consumeOnce(binding),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(2);
  });

  it("fails closed after a crash or fsync failure", async () => {
    const directory = await mkdtemp(join(tmpdir(), "happyrobot-ledger-"));
    temporaryDirectories.push(directory);
    const ledger = new FileBookingAttemptLedger(directory, {
      syncFile: async () => {
        throw new Error("simulated crash before durable sync");
      },
    });

    await expect(ledger.consumeOnce(binding)).rejects.toThrow(/ledger is unavailable/i);
    await expect(new FileBookingAttemptLedger(directory).consumeOnce(binding)).rejects.toThrow(/corrupt|already been consumed/i);
  });

  it("rejects an existing empty claim conservatively", async () => {
    const directory = await mkdtemp(join(tmpdir(), "happyrobot-ledger-"));
    temporaryDirectories.push(directory);
    const attemptKey = createHash("sha256").update(binding.loadId, "utf8").digest("hex");
    const attemptPath = join(directory, `${attemptKey}.attempt`);
    await writeFile(attemptPath, "", "utf8");

    await expect(new FileBookingAttemptLedger(directory).consumeOnce(binding)).rejects.toThrow(/corrupt|unavailable/i);
  });

  it("persists terminal state transitions and rejects stale or regressive fences", async () => {
    const directory = await mkdtemp(join(tmpdir(), "happyrobot-ledger-"));
    temporaryDirectories.push(directory);
    const ledger = new FileBookingAttemptLedger(directory, { createClaimToken: () => "claim-1" });
    const claimToken = await ledger.consumeOnce(binding);
    await ledger.transition(binding, claimToken, "sent");
    const attemptKey = createHash("sha256").update(binding.loadId, "utf8").digest("hex");
    const record = JSON.parse(await readFile(join(directory, `${attemptKey}.attempt`), "utf8")) as { state: string };
    expect(record.state).toBe("sent");
    await expect(ledger.transition(binding, "stale", "unknown")).rejects.toThrow(/fence/i);
    await expect(ledger.transition(binding, claimToken, "unknown")).rejects.toThrow(/cannot become uncertain/i);
  });

  it("fails closed when the ledger directory is unavailable", async () => {
    const directory = await mkdtemp(join(tmpdir(), "happyrobot-ledger-"));
    temporaryDirectories.push(directory);
    const filePath = join(directory, "not-a-directory");
    await writeFile(filePath, "fixture", "utf8");

    await expect(new FileBookingAttemptLedger(filePath).consumeOnce(binding)).rejects.toThrow(/ledger is unavailable/i);
  });
});
