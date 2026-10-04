// Bound diagnostic waits without changing the operation's result or rejection.
export async function withDeadline(label, operation, timeoutMs = 15000) {
  let timer;
  const pending = Promise.resolve().then(() =>
    typeof operation === 'function' ? operation() : operation,
  );
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error(`${label} exceeded diagnostic deadline of ${timeoutMs} ms`);
      error.name = 'DiagnosticTimeoutError';
      error.stage = label;
      error.timeoutMs = timeoutMs;
      reject(error);
    }, timeoutMs);
  });
  try {
    // The race observes late rejections too; timing out does not cancel the work.
    return await Promise.race([pending, deadline]);
  } finally {
    clearTimeout(timer);
  }
}
