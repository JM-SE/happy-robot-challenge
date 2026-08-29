import { LOAD_DATASET } from "../../mock/dataset";
import { LoadNotFoundError, RateNotAcceptedError } from "./domain-errors";
import { MAX_PUBLIC_RATE, type PublicBookingRequest } from "./public-contracts";

export const DEMO_BOOKED_AT = "2000-01-01T00:00:00.000Z";

interface MockBookingScenario {
  loadId: string;
  rate: number;
}

const ACCEPTED_SCENARIO: MockBookingScenario = { loadId: "LOAD-1002", rate: 2900 };
const PUBLIC_CATALOG = new Map(LOAD_DATASET.map((load) => [load.loadId, { loadId: load.loadId, rate: load.rate }]));

export function knownMockLoadIds(): readonly string[] {
  return [...PUBLIC_CATALOG.keys()];
}

export function validateMockBookingScenario(request: PublicBookingRequest): void {
  const load = PUBLIC_CATALOG.get(request.loadId);
  if (!load) throw new LoadNotFoundError();
  if (request.agreedRate <= 0 || request.agreedRate > MAX_PUBLIC_RATE || request.loadId !== ACCEPTED_SCENARIO.loadId || request.agreedRate !== ACCEPTED_SCENARIO.rate) {
    throw new RateNotAcceptedError();
  }
  if (load.rate !== request.agreedRate) throw new RateNotAcceptedError();
}
