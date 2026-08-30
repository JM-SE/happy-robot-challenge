import { RUNTIME_SHUTDOWN_TIMEOUT_MS } from "./constants";

export interface ManagedRuntimeResource {
  readonly close: () => void | Promise<void>;
}

export class RuntimeLifecycle {
  private readonly resources = new Set<ManagedRuntimeResource>();
  private closed = false;

  register(resource: ManagedRuntimeResource): () => void {
    if (this.closed) {
      void closeWithTimeout(resource, RUNTIME_SHUTDOWN_TIMEOUT_MS);
      return () => undefined;
    }
    this.resources.add(resource);
    return () => this.resources.delete(resource);
  }

  get size(): number {
    return this.resources.size;
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    const resources = [...this.resources].reverse();
    this.resources.clear();
    await Promise.all(resources.map((resource) => closeWithTimeout(resource, RUNTIME_SHUTDOWN_TIMEOUT_MS)));
  }
}

async function closeWithTimeout(resource: ManagedRuntimeResource, timeoutMs: number): Promise<void> {
  await Promise.race([
    Promise.resolve().then(() => resource.close()).catch(() => undefined),
    new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}
