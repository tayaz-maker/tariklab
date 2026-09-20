import type { ErrorComponentProps } from "@tanstack/react-router";
import { TriangleAlert } from "lucide-react";

export function AppErrorComponent({ error }: ErrorComponentProps) {
  const message = error instanceof Error ? error.message : String(error || "");
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-bg px-6 text-center text-fg">
      <span className="text-danger" aria-hidden="true">
        <TriangleAlert className="size-10" strokeWidth={2} />
      </span>
      <h1 className="font-display text-lg font-semibold">Oyun kilitlendi</h1>
      <p className="max-w-md text-sm break-words text-muted">
        {message || "Beklenmeyen bir hata. Kayıt duruyor — devam et."}
      </p>
      <button
        type="button"
        className="mt-2 rounded-lg bg-elevated px-4 py-2 text-sm"
        onClick={() => window.location.reload()}
      >
        Yenile
      </button>
    </main>
  );
}

export function AppNotFound() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center px-5 py-16 text-center">
      <h1 className="font-display text-3xl font-semibold">Yok</h1>
      <p className="mt-3 text-sm text-muted">Bu sayfa durmuyor.</p>
      <a href="/" className="mt-8 text-sm text-accent underline-offset-4 hover:underline">
        Oyunlar
      </a>
    </main>
  );
}
