import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useGame } from "@/game/store";
import { type Lang, useLang } from "@/lib/i18n";
import {
  parseSlotEnvelope,
  readActiveSlot,
  readSlotRaw,
  type SlotIndex,
} from "@/lib/save-slots";

function slotSummary(slot: SlotIndex, lang: Lang) {
  const empty = lang === "en" ? "Empty slot" : "Boş slot";
  const corrupt = lang === "en" ? "Corrupt save" : "Bozuk kayıt";
  const unread = lang === "en" ? "Save unreadable" : "Kayıt okunamıyor";
  const vacant = lang === "en" ? "Empty" : "Boş";
  if (typeof window === "undefined") return { empty: true, label: vacant };
  let raw: string | null;
  try { raw = readSlotRaw(window.localStorage, "cete", slot); } catch { return { empty: false, label: unread }; }
  const parsed = parseSlotEnvelope(raw);
  const state = (parsed?.state ?? parsed) as
    | { player?: { name?: string; neighborhood?: string; cash?: number }; savedAt?: number }
    | null;
  if (raw && (!parsed || !state || typeof state !== "object" || !("player" in state))) return { empty: false, label: corrupt };
  if (!state?.player?.name) return { empty: !raw || state?.player === null, label: raw && state?.player !== null ? corrupt : empty };
  const when = typeof state.savedAt === "number" && state.savedAt
    ? new Date(state.savedAt).toLocaleString(lang === "en" ? "en-GB" : lang === "pl" ? "pl-PL" : "tr-TR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
    : "";
  return {
    empty: false,
    label: `${state.player.name}${when ? ` · ${when}` : ""}`,
  };
}

export function SaveSlotsPanel() {
  const { lang, t } = useLang();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState<null | { slot: SlotIndex; mode: "load" | "save" | "clear" }>(null);
  const activeSlot = useGame((s) => s.activeSlot) || (typeof window === "undefined" ? 1 : readActiveSlot(window.localStorage, "cete"));
  const loadSlot = useGame((s) => s.loadSlot);
  const saveToSlot = useGame((s) => s.saveToSlot);
  const clearPlaySlot = useGame((s) => s.clearPlaySlot);
  const [message, setMessage] = useState("");
  const slots = ([1, 2, 3] as SlotIndex[]).map((slot) => ({ slot, ...slotSummary(slot, lang) }));
  function act(slot: SlotIndex, mode: "load" | "save" | "clear") {
    const ok = mode === "load" ? loadSlot(slot) : mode === "save" ? saveToSlot(slot) : clearPlaySlot(slot);
    setMessage(ok
      ? (mode === "clear" ? t("cete.saveDeleted", "Kayıt silindi.") : t("cete.saveDone", "Kayıt tamamlandı."))
      : t("cete.saveFail", "İşlem tamamlanamadı. Kayıt bozuk olabilir veya cihaz kayıt erişimini engelliyor."));
    if (ok && mode === "load") setOpen(false);
  }

  return (
    <>
      <Button variant="ghost" className="px-3 text-xs md:px-4 md:text-sm" onClick={() => setOpen(true)}>
        {t("common.slot", "Kayıt")} {activeSlot}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("cete.slotsTitle", "Üç kayıt yeri")}</DialogTitle>
            <DialogDescription>
              {t("cete.slotsBody", "Hesap gerekmez. Her slot bu cihazda ayrı durur. Dolu slota kayıt sormadan yazılmaz.")}
            </DialogDescription>
          </DialogHeader>
          <ul className="mt-4 space-y-2">
            {slots.map((item) => (
              <li key={item.slot} className="rounded-xl bg-elevated px-3 py-3">
                <p className="text-sm text-fg">
                  {t("common.slot", "Slot")} {item.slot}
                  {item.slot === activeSlot ? ` · ${t("common.active", "açık")}` : ""}
                </p>
                <p className="text-xs text-muted">{item.label}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      if (!item.empty && item.slot !== activeSlot) setConfirm({ slot: item.slot, mode: "load" });
                      else act(item.slot, "load");
                    }}
                  >
                    {lang === "en" ? "Open" : "Aç"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      if (!item.empty && item.slot !== activeSlot) setConfirm({ slot: item.slot, mode: "save" });
                      else act(item.slot, "save");
                    }}
                  >
                    {t("common.save", "Kaydet")}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={item.empty}
                    onClick={() => setConfirm({ slot: item.slot, mode: "clear" })}
                  >
                    {t("common.delete", "Sil")}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          <p role="status" className="mt-3 text-xs text-muted">{message || (lang === "en" ? "A leftover single save is moved to Slot 1." : "Eski tek kayıt varsa Slot 1’e taşınır.")}</p>
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(confirm)} onOpenChange={(next) => !next && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirm?.mode === "clear"
                ? (lang === "en" ? "Delete slot" : "Slotu sil")
                : confirm?.mode === "save"
                  ? (lang === "en" ? "Overwrite" : "Üzerine yaz")
                  : (lang === "en" ? "Open slot" : "Slotu aç")}
            </DialogTitle>
            <DialogDescription>
              {confirm?.mode === "clear"
                ? (lang === "en" ? `Slot ${confirm.slot} will be deleted. Other slots stay.` : `Slot ${confirm.slot} silinir. Diğer slotlar durur.`)
                : confirm?.mode === "save"
                  ? (lang === "en" ? `Slot ${confirm?.slot} is full. Overwrite it with the current game?` : `Slot ${confirm?.slot} dolu. Şu anki oyunu bunun üzerine yazmak istiyor musun?`)
                  : (lang === "en" ? `Opening slot ${confirm?.slot} replaces the game on screen. Unsaved progress is lost.` : `Slot ${confirm?.slot} açılınca ekrandaki oyun değişir. Kaydetmediysen kaybolur.`)}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirm(null)}>{lang === "en" ? "Never mind" : "Vazgeç"}</Button>
            <Button
              variant={confirm?.mode === "clear" ? "danger" : "default"}
              onClick={() => {
                if (!confirm) return;
                act(confirm.slot, confirm.mode);
                setConfirm(null);
              }}
            >
              {t("common.confirm", "Onayla")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
