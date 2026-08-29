import { TmsAdapterError } from "./errors";

export class LoadNotFoundError extends TmsAdapterError {
  constructor() {
    super({ type: "TMS_DOMAIN", code: "LOAD_NOT_FOUND", message: "Load was not found.", retryable: false, stage: "response" });
  }
}

export class BookingConflictError extends TmsAdapterError {
  constructor() {
    super({ type: "TMS_DOMAIN", code: "BOOKING_CONFLICT", message: "The load is no longer available.", retryable: false, stage: "response" });
  }
}

export class RateNotAcceptedError extends TmsAdapterError {
  constructor() {
    super({ type: "TMS_DOMAIN", code: "RATE_NOT_ACCEPTED", message: "The offered rate was not accepted.", retryable: false, stage: "validation" });
  }
}
