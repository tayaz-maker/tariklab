/** Reuse the existing root worker without mounting game-specific install UI. */
export function registerOfflineWorker(): Promise<ServiceWorkerRegistration> | null {
  if (!import.meta.env.PROD || typeof window === "undefined") return null;
  const host = window.location.hostname;
  if (host.endsWith(".grok-sandbox.com") || host.endsWith(".grok.me")) return null;
  if (!("serviceWorker" in navigator)) return null;
  return navigator.serviceWorker.register("/sw.js");
}
