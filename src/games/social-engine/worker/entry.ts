import { createSimulationRuntime, type SimulationScope } from "./runtime.ts";
createSimulationRuntime(globalThis as unknown as SimulationScope);
