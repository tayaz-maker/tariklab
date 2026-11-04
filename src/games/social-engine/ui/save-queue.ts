/** Manual requests wait for an active save. Background cadence may coalesce, but
 * can never consume a manual click. A changed world invalidates queued requests. */
export function createSaveQueue<T>(
  current: () => T | null,
  execute: (slot: string) => Promise<boolean>,
  busy: () => void = () => undefined,
) {
  let tail: Promise<boolean> | null = null,
    pending = 0;
  return (slot: string, background = false): Promise<boolean> => {
    if (background && tail) return Promise.resolve(false);
    if (pending >= 8) {
      busy();
      return Promise.resolve(false);
    }
    const session = current();
    if (!session) return Promise.resolve(false);
    pending++;
    const run = () => (current() === session ? execute(slot) : Promise.resolve(false));
    const task = (tail ?? Promise.resolve(true)).then(run, run);
    tail = task;
    const clear = () => {
      pending--;
      if (tail === task) tail = null;
    };
    void task.then(clear, clear);
    return task;
  };
}
