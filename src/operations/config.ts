import "server-only";
import { createInMemoryCallEventStore } from "./store";
import { createDemoFixtures } from "./fixtures";
import type { CallEventStore } from "./contracts";
export const API_SOURCE = "adapter-fallback" as const;
export const UI_COOKIE = "operations_session";
let store: CallEventStore | undefined;
export function getOperationsStore(env: NodeJS.ProcessEnv = process.env): CallEventStore { if (!store) { const mode = env.ADAPTER_UI_DATA_MODE?.trim(); if (mode && mode !== "fixture") throw new Error("CONFIGURATION_UNAVAILABLE"); store = createInMemoryCallEventStore(); if (mode === "fixture") void Promise.all(createDemoFixtures().map((record) => store!.insert(record))); } return store; }
