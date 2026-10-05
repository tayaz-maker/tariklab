import assert from "node:assert/strict";

// Paths/query strings may redirect; each host's proof must stay on that exact origin.
export function assertSameOrigin(actualUrl, expectedUrl, label) {
  const actual = new URL(actualUrl).origin;
  assert.equal(actual, new URL(expectedUrl).origin, `${label}: cross-origin proof redirect`);
  return actual;
}
