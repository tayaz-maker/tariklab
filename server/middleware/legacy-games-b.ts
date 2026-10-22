// Fixed same-origin retirement redirect; never consumes a destination parameter.
import { archivedPath } from "../../scripts/legacy-game-inventory.mjs";
interface ArchiveEvent { url: URL; req: Request }
export default function legacyGamesArchive(event: ArchiveEvent, next: () => unknown): unknown {
  if (!archivedPath(event.url.pathname)) return next();
  const document = event.url.pathname.startsWith("/oyna/") || /\/(?:index\.html)?$/.test(event.url.pathname) || /^\/games\/[^/]+$/.test(event.url.pathname);
  return document
    ? new Response(null, { status: 302, headers: { Location: "/", "Cache-Control": "no-store" } })
    : new Response("Bu oyun arşivlendi", { status: 410 });
}
