/** STOP invalidates the duplicate-motion cache as well as the held keys. */
export function resetMotionInput(keys: Set<string>, stop: () => void): string {
  keys.clear();
  stop();
  return "";
}
