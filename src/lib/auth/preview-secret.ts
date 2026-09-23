import { randomBytes } from "node:crypto";

/**
 * Preview secret must outlive module reloads: PGLite (and its session rows) is
 * stored on `globalThis`, so an HMR re-eval of the auth module must NOT mint a
 * new signing secret or every existing session becomes invalid mid-dev.
 * Process restart clears both the secret and PGLite together.
 *
 * Minted on first call, never at import: Workers forbid random values in
 * global scope, so `vite preview` (workerd) would crash on startup.
 */
const globalAuthRef = globalThis as typeof globalThis & {
  __grokAuthPreviewSecret__?: string;
};
export function previewAuthSecret(): string {
  globalAuthRef.__grokAuthPreviewSecret__ ??= randomBytes(32).toString("hex");
  return globalAuthRef.__grokAuthPreviewSecret__;
}

/** The configured secret wins; otherwise the process-stable preview secret. */
export function resolveAuthSecret(configured: string | undefined): string {
  return configured ?? previewAuthSecret();
}
