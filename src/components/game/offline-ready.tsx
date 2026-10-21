import { useEffect, useState } from "react";
import { registerOfflineWorker } from "@/lib/offline-worker";
import { useLang } from "@/lib/i18n";
import { Button } from "@/components/ui/button";

const DISMISS_KEY = "cete-install-dismissed";

function isIos() {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && Boolean((navigator as { standalone?: boolean }).standalone))
  );
}

export function OfflineReady() {
  const { t } = useLang();
  const [ready, setReady] = useState(false);
  const [offline, setOffline] = useState(
    typeof navigator !== "undefined" ? !navigator.onLine : false,
  );
  const [installEvent, setInstallEvent] = useState<{
    prompt: () => Promise<void>;
  } | null>(null);
  const [hint, setHint] = useState(false);

  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  useEffect(() => {
    void registerOfflineWorker()
      ?.then((reg) => {
        setReady(Boolean(reg.active || reg.waiting || reg.installing));
        void prefetchGameChunks();
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(DISMISS_KEY)) return;
    if (isStandalone()) return;
    const onPrompt = (e: Event) => {
      e.preventDefault();
      const ev = e as Event & { prompt: () => Promise<void> };
      setInstallEvent(ev);
      setHint(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    if (isIos()) setHint(true);
    const t = window.setTimeout(() => {
      if (!localStorage.getItem(DISMISS_KEY) && !isStandalone()) setHint(true);
    }, 4000);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.clearTimeout(t);
    };
  }, []);

  if (offline) {
    return (
      <p className="pointer-events-none fixed top-3 left-1/2 z-40 -translate-x-1/2 rounded-full bg-elevated px-3 py-1 text-[0.7rem] tracking-wide text-accent">
        {t("cete.offline.badge", "Çevrimdışı · kayıt yerelde")}
      </p>
    );
  }

  if (!hint || isStandalone()) {
    return ready ? <p className="sr-only">{t("cete.offline.ready", "Çevrimdışı kopya hazır.")}</p> : null;
  }

  return (
    <div className="fixed right-3 bottom-20 z-40 max-w-[16rem] rounded-xl bg-surface p-3 text-xs text-fg shadow-[0_0_0_1px_rgba(239,232,222,0.12)] md:bottom-4">
      <p className="font-medium">{t("cete.offline.installTitle", "Ana ekrana ekle")}</p>
      <p className="mt-1 text-muted">
        {isIos()
          ? t("cete.offline.iosHint", "Paylaş → Ana Ekrana Ekle. Sonra netsiz açılır.")
          : t("cete.offline.installHint", "Kur, bir kez online aç, sonra uçak modunda oyna.")}
      </p>
      <div className="mt-2 flex gap-2">
        {installEvent ? (
          <Button
            size="sm"
            onClick={() => {
              void installEvent.prompt();
              setHint(false);
            }}
          >
            {t("cete.offline.install", "Kur")}
          </Button>
        ) : null}
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            localStorage.setItem(DISMISS_KEY, "1");
            setHint(false);
          }}
        >
          {t("cete.offline.dismiss", "Tamam")}
        </Button>
      </div>
    </div>
  );
}

function prefetchGameChunks() {
  void Promise.allSettled([
    import("@/components/game/game-shell"),
    import("@/components/game/me-panel"),
    import("@/components/game/shop-panel"),
    import("@/components/game/estate-panel"),
    import("@/components/game/street-panel"),
    import("@/components/game/life-panel"),
    import("@/components/game/clinic-panel"),
    import("@/components/game/jobs-panel"),
  ]);
}
