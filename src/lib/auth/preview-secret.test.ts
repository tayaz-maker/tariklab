import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire, syncBuiltinESMExports } from "node:module";

// Workers (and so `vite preview`, which runs workerd) forbid random values in
// global scope. Loading must not mint the preview secret.
const nodeCrypto = createRequire(import.meta.url)("node:crypto");
const realRandomBytes = nodeCrypto.randomBytes;
let loading = true;
let randomCallsAtLoad = 0;
nodeCrypto.randomBytes = (...args: unknown[]) => {
  if (loading) randomCallsAtLoad++;
  return realRandomBytes(...args);
};
syncBuiltinESMExports();
const { resolveAuthSecret } = await import("./preview-secret.ts");
loading = false;

describe("auth secret", () => {
  it("generates no random value while the module loads", () => {
    assert.equal(randomCallsAtLoad, 0);
  });

  it("uses a configured secret unchanged", () => {
    assert.equal(resolveAuthSecret("deployed-secret"), "deployed-secret");
  });

  it("falls back to one process-stable preview secret", () => {
    const first = resolveAuthSecret(undefined);
    assert.match(first, /^[0-9a-f]{64}$/);
    assert.equal(resolveAuthSecret(undefined), first);
  });

  it("the auth instance is built on first use, BETTER_AUTH_SECRET first", () => {
    const source = readFileSync(new URL("./server.ts", import.meta.url), "utf8");
    assert.match(source, /const createAuth = \(\) => betterAuth\(\{/);
    assert.match(source, /secret: resolveAuthSecret\(env\("BETTER_AUTH_SECRET"\)\)/);
    assert.match(source, /authInstance \?\?= createAuth\(\)/);
    assert.doesNotMatch(source, /export const auth = betterAuth/);
    assert.doesNotMatch(source, /randomBytes|previewAuthSecret\(\)/);
  });
});
