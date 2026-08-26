import { createMockLtmsServer } from "./ltms-server";

const server = createMockLtmsServer({
  host: process.env.TMS_HOST ?? "127.0.0.1",
  port: Number(process.env.TMS_PORT ?? 9000),
  authToken: process.env.TMS_AUTH_TOKEN ?? "local-test-token",
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
