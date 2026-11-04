import type { SimulationScope } from "./runtime.ts";
export type LocalSimulationEndpoint = {
  postMessage(message: unknown): void;
  terminate(): void;
  onmessage: ((event: MessageEvent) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
};
/** Same authority and protocol; lower presentation density when Workers are unavailable. */
export async function createLocalEndpoint(): Promise<LocalSimulationEndpoint> {
  const { createSimulationRuntime } = await import("./runtime.ts");
  let disposed = false;
  const scope: SimulationScope = {
    onmessage: null,
    postMessage(message) {
      const copy = structuredClone(message);
      queueMicrotask(() => {
        if (!disposed) endpoint.onmessage?.(new MessageEvent("message", { data: copy }));
      });
    },
  };
  const runtime = createSimulationRuntime(scope, 8);
  const endpoint: LocalSimulationEndpoint = {
    onmessage: null,
    onerror: null,
    postMessage(message) {
      const copy = structuredClone(message);
      queueMicrotask(() => {
        if (!disposed) scope.onmessage?.(new MessageEvent("message", { data: copy }));
      });
    },
    terminate() {
      disposed = true;
      runtime.dispose();
    },
  };
  return endpoint;
}
