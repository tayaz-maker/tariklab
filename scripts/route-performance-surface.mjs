// Serialized by Playwright into the game document; keep this closure-free.
// An attached iframe can still be parsing its head before a body exists.
export function hasReadableBody() {
  return Boolean(document.body && document.body.innerText.trim().length > 20);
}
