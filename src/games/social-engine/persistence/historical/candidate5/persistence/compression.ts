/** Bound both the stored transport and the expanded record graph before JSON parsing. */
export const MAX_RECORD_BYTES = 48 * 1024 * 1024;
export async function gzipText(
  text: string,
): Promise<{ payload: string; decodedByteLength: number }> {
  const raw = new TextEncoder().encode(text);
  if (raw.byteLength > MAX_RECORD_BYTES) throw Error("Expanded snapshot exceeds48MiB");
  const bytes = new Uint8Array(
    await new Response(
      new Blob([raw]).stream().pipeThrough(new CompressionStream("gzip")),
    ).arrayBuffer(),
  );
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192)
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return { payload: btoa(binary), decodedByteLength: raw.byteLength };
}
export async function gunzipText(payload: string, expectedBytes: number): Promise<string> {
  if (!Number.isSafeInteger(expectedBytes) || expectedBytes < 2 || expectedBytes > MAX_RECORD_BYTES)
    throw Error("Expanded snapshot length is invalid");
  if (payload.length % 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(payload))
    throw Error("Invalid base64 payload");
  const binary = atob(payload),
    bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const reader = new Blob([bytes])
    .stream()
    .pipeThrough(new DecompressionStream("gzip"))
    .getReader();
  const parts: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      length += next.value.byteLength;
      if (length > expectedBytes || length > MAX_RECORD_BYTES)
        throw Error("Expanded snapshot exceeds declared bound");
      parts.push(next.value);
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
  if (length !== expectedBytes) throw Error("Expanded snapshot length mismatch");
  const joined = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    joined.set(part, offset);
    offset += part.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(joined);
}
