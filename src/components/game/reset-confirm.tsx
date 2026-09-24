import { useLang } from "@/lib/i18n";
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
import { cn, unlockUi } from "@/lib/utils";

export function ResetConfirm({
  className,
  label = "Dosyayı yak",
}: {
  className?: string;
  label?: string;
}) {
  const { lang } = useLang();
  const en = lang !== "tr";
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        className={className}
        onClick={() => setOpen(true)}
      >
        {en && label === "Dosyayı yak" ? "Delete game" : label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{en ? "Delete game" : "Dosyayı yak"}</DialogTitle>
            <DialogDescription>
              {en ? "This deletes the active game, money, district, crew and home. This cannot be undone. Continue?" : "Kayıt, kasa, semt, çete, ev — hepsi gider. Bu mahalle seni unutur. Emin misin?"}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {en ? "Cancel" : "Vazgeç"}
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setOpen(false);
                unlockUi();
                window.setTimeout(() => {
                  unlockUi();
                  useGame.getState().resetGame();
                }, 0);
              }}
            >
              {en ? "Delete" : "Yak"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function ResetLink({ className }: { className?: string }) {
  const { lang } = useLang();
  const en = lang !== "tr";
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className={cn(
          "inline-flex min-h-11 items-center text-xs tracking-wide text-subtle uppercase hover:text-muted",
          className,
        )}
        onClick={() => setOpen(true)}
      >
        {en ? "Delete game and start over" : "Dosyayı yak, baştan başla"}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{en ? "Delete game" : "Dosyayı yak"}</DialogTitle>
            <DialogDescription>
              {en ? "The save will be deleted. This cannot be undone." : "Kayıt silinir. Geri dönüş yok."}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {en ? "Cancel" : "Vazgeç"}
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setOpen(false);
                unlockUi();
                window.setTimeout(() => {
                  unlockUi();
                  useGame.getState().resetGame();
                }, 0);
              }}
            >
              {en ? "Delete" : "Yak"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
