import { useEffect } from "react";
import { registerOfflineWorker } from "@/lib/offline-worker";

export function OfflineWorkerRegistration() {
  useEffect(() => {
    void registerOfflineWorker()?.catch(() => {});
  }, []);
  return null;
}
