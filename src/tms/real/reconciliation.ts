import type { LoadPublic } from "../types";

export const RECONCILIATION_OUTCOMES = {
  RECONCILED: "reconciled",
  STILL_UNCERTAIN: "still-uncertain",
} as const;

export type ReconciliationOutcome = (typeof RECONCILIATION_OUTCOMES)[keyof typeof RECONCILIATION_OUTCOMES];

/** An authoritative source, never a caller supplied boolean predicate. */
export interface AuthoritativeReconciliationClassifier {
  classify(load: LoadPublic): Promise<ReconciliationOutcome> | ReconciliationOutcome;
}

export const noReconciliationAuthority: AuthoritativeReconciliationClassifier = {
  classify: () => RECONCILIATION_OUTCOMES.STILL_UNCERTAIN,
};
