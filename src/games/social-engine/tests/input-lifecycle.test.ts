import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { resetMotionInput } from "../ui/input-lifecycle.ts";

// Execute the authored motion function and lifecycle listeners, without a renderer
// or real browser. Synthetic visibility events deliberately have no accompanying blur.
const source = readFileSync(new URL("../ui/app.ts", import.meta.url), "utf8");
const handlers = source.slice(source.indexOf("function motion() {"), source.indexOf('window.addEventListener("resize"'));
for (const vehicleId of [undefined, "car"]) {
  for (const code of ["KeyW", "KeyA", "KeyS", "KeyD"]) {
    test(`${vehicleId ? "vehicle" : "walking"} same ${code} resumes after visibility alone`, () => {
      const documentListeners = new Map<string, (e?: unknown) => void>();
      const windowListeners = new Map<string, () => void>();
      const sent: { type: string; args?: unknown }[] = [];
      const keys = new Set<string>();
      const document = {
        hidden: false,
        addEventListener: (name: string, callback: (e?: unknown) => void) => documentListeners.set(name, callback),
      };
      const context = vm.createContext({
        view: { player: { vehicleId } }, worker: {}, paused: false, hidden: false,
        panel: null, keyState: keys, lastMotion: "", settings: {}, document, resetMotionInput,
        window: { addEventListener: (name: string, callback: () => void) => windowListeners.set(name, callback) },
        command: (type: string, args?: unknown) => { sent.push({ type, args }); },
        setPause() {},
      });
      vm.runInContext(ts.transpileModule(handlers, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
      const press = () => documentListeners.get("keydown")!({ code, repeat: false, target: { matches: () => false }, preventDefault() {} });
      press();
      const first = sent.at(-1)!;
      assert.equal(first.type, vehicleId ? "DRIVE" : "MOVE");
      document.hidden = true;
      documentListeners.get("visibilitychange")!();
      assert.equal(keys.size, 0);
      assert.equal(sent.at(-1)!.type, "STOP");
      document.hidden = false;
      documentListeners.get("visibilitychange")!();
      const count = sent.length;
      press();
      assert.equal(sent.length, count + 1, "same direction must reach authority again after STOP");
      assert.deepEqual(sent.at(-1), first);
    });
  }
}
