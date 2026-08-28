import { DeadlineBudget, type DeadlinePhase } from "./deadline";
import { TmsConcurrencyError, TmsRateLimitError } from "./errors";
import { BoundedTokenBucketRateLimiter, RejectingSemaphore } from "./resource-controls";

export interface TmsControlOptions {
  readonly rateLimiter?: BoundedTokenBucketRateLimiter;
  readonly semaphore?: RejectingSemaphore;
  readonly deadlineMs: number;
  readonly rateKey?: string;
}

export interface TmsAdmission {
  readonly budget: DeadlineBudget;
  readonly release: () => void;
}

export function admitTmsRequestWithBudget(budget: DeadlineBudget, options: Omit<TmsControlOptions, "deadlineMs">): TmsAdmission {
  try {
    budget.checkpoint();
    const rate = (options.rateLimiter ?? defaultRateLimiter).consume(options.rateKey ?? "anonymous");
    if (!rate.allowed) throw new TmsRateLimitError(rate.retryAfterMs);
    const release = (options.semaphore ?? defaultSemaphore).tryAcquire();
    if (!release) throw new TmsConcurrencyError();
    let released = false;
    return { budget, release: () => { if (!released) { released = true; release(); } } };
  } catch (error) {
    throw error;
  }
}

export function admitTmsRequest(options: TmsControlOptions): TmsAdmission {
  const budget = new DeadlineBudget(options.deadlineMs);
  try {
    return admitTmsRequestWithBudget(budget, options);
  } catch (error) {
    budget.dispose();
    throw error;
  }
}

export function checkpoint(budget: DeadlineBudget, phase: DeadlinePhase): number {
  budget.checkpoint();
  const remaining = budget.remainingMs();
  void phase;
  return remaining;
}

const defaultRateLimiter = new BoundedTokenBucketRateLimiter();
const defaultSemaphore = new RejectingSemaphore();
