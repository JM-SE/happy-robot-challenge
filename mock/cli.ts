import { createMockLtmsServer } from "./ltms-server";
import { MOCK_FAULT_SCENARIOS, type MockFaultScenario } from "./scenarios";

function parseFaultScenario(value: string | undefined): MockFaultScenario | undefined {
  if (!value || value === MOCK_FAULT_SCENARIOS.NONE) return undefined;
  if (Object.values(MOCK_FAULT_SCENARIOS).includes(value as (typeof MOCK_FAULT_SCENARIOS)[keyof typeof MOCK_FAULT_SCENARIOS])) {
    return value as MockFaultScenario;
  }
  return { kind: "remote-error", code: value };
}

const server = createMockLtmsServer({
  host: process.env.TMS_HOST ?? "127.0.0.1",
  port: Number(process.env.TMS_PORT ?? 9000),
  authToken: process.env.TMS_AUTH_TOKEN ?? "local-test-token",
  fault: parseFaultScenario(process.env.TMS_MOCK_SCENARIO),
  faultDelayMs: Number(process.env.TMS_MOCK_DELAY_MS ?? 10),
  fragmentSize: Number(process.env.TMS_MOCK_FRAGMENT_SIZE ?? 1),
});

const shutdown = async () => {
  await server.stop();
  process.exit(0);
};

async function main(): Promise<void> {
  const address = await server.start();
  console.log(`Mock LTMS listening on ${address.host}:${address.port}`);
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

void main();
