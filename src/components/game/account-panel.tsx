import { useState } from "react";
import { useLang } from "@/lib/i18n";
import { polishAccountError, polishAccountText } from "@/game/cete-pl-account";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { reconcileOnce } from "@/game/save-sync";
import { track } from "@/lib/analytics";
import { mapSbError, supabase } from "@/lib/supabase";
import { useSupabaseUser } from "@/lib/supabase-session";
import { cn } from "@/lib/utils";

function origin() {
  return typeof window === "undefined" ? "" : window.location.origin;
}

async function resolveEmail(login: string): Promise<string> {
  const v = login.trim();
  if (v.includes("@")) return v.toLowerCase();
  const { data, error } = await supabase.rpc("email_for_username", { u: v });
  if (error) throw new Error(mapSbError(error.message));
  if (!data || typeof data !== "string") {
    throw new Error("Kullanıcı adı ya da şifre yanlış.");
  }
  return data;
}

export function AccountPanel({ className }: { className?: string }) {
  const { lang } = useLang();
  const pl = lang === "pl";
  const { user, pending, verified, username } = useSupabaseUser();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  if (pending) return null;

  if (user) {
    const label = username ?? (pl ? "Konto" : "Hesap");
    return (
      <div className={cn("flex flex-wrap items-center gap-2", className)}>
        <span className="text-xs text-muted">
          {pl ? "Konto" : "Hesap"}: <span className="text-fg">{label}</span>
          {!verified ? (
            <span className="ml-1 text-warn">· {pl ? "e-mail niepotwierdzony" : "e-posta doğrulanmadı"}</span>
          ) : null}
        </span>
        <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
          {pl ? "Konto" : "Hesap"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={signingOut}
          onClick={() => {
            setSigningOut(true);
            void supabase.auth.signOut().finally(() => setSigningOut(false));
          }}
        >
          {pl ? (signingOut ? "Wylogowywanie…" : "Wyloguj się") : (signingOut ? "Çıkılıyor…" : "Çıkış yap")}
        </Button>
        <AccountDialog open={open} onOpenChange={setOpen} signedIn />
      </div>
    );
  }

  return (
    <>
      <Button
        variant="ghost"
        className={cn("px-3 text-xs md:px-4 md:text-sm", className)}
        onClick={() => setOpen(true)}
      >
        {pl ? "Utwórz konto / Zaloguj się" : "Hesap oluştur / Giriş yap"}
      </Button>
      <AccountDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

function AccountDialog({
  open,
  onOpenChange,
  signedIn = false,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  signedIn?: boolean;
}) {
  const { lang } = useLang();
  const pl = lang === "pl";
  const local = (text: string) => pl ? polishAccountText(text) : text;
  const { user, verified } = useSupabaseUser();
  const [mode, setMode] = useState<"in" | "up" | "forgot" | "pw">("in");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [current, setCurrent] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const reset = () => {
    setUsername("");
    setEmail("");
    setPassword("");
    setPassword2("");
    setCurrent("");
    setError(null);
    setOk(null);
    setBusy(false);
    setMode(signedIn ? "pw" : "in");
  };

  const resend = async () => {
    const em = user?.email || email.trim();
    if (!em || !em.includes("@")) {
      setError("Gerçek bir e-posta yok.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { error: err } = await supabase.auth.resend({
        type: "signup",
        email: em,
        options: { emailRedirectTo: `${origin()}/auth/callback` },
      });
      if (err) {
        setError(mapSbError(err.message));
        return;
      }
      setOk("Doğrulama maili tekrar gitti.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Mail gitmedi.");
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    setError(null);
    setOk(null);
    const uname = username.trim();
    const em = email.trim().toLowerCase();
    setBusy(true);
    try {
      if (mode === "up") {
        if (uname.length < 3) {
          setError("Kullanıcı adı en az 3 karakter olmalı.");
          return;
        }
        if (uname.length > 24) {
          setError("Kullanıcı adı en fazla 24 karakter.");
          return;
        }
        if (!em.includes("@")) {
          setError("Gerçek bir e-posta yaz.");
          return;
        }
        if (password.length < 8) {
          setError("Şifre en az 8 karakter olmalı.");
          return;
        }
        if (password !== password2) {
          setError("Şifreler eşleşmiyor.");
          return;
        }
        const { data: taken, error: takenErr } = await supabase.rpc(
          "username_taken",
          { u: uname },
        );
        if (takenErr) {
          setError(mapSbError(takenErr.message));
          return;
        }
        if (taken) {
          setError("Bu kullanıcı adı alınmış. Başka bir tane dene.");
          return;
        }
        const { data, error: err } = await supabase.auth.signUp({
          email: em,
          password,
          options: {
            data: {
              username: uname.toLowerCase(),
              display_username: uname,
            },
            emailRedirectTo: `${origin()}/auth/callback`,
          },
        });
        if (err) {
          setError(mapSbError(err.message));
          return;
        }
        if (data.user && !data.session) {
          track("hesap_acildi");
          setOk("Kayıt oldu. Doğrulama maili gitti — kutuyu kontrol et.");
          return;
        }
        track("hesap_acildi");
        setOk("Kayıt oldu. Mail doğrulanmadan bulut kayıt yazılmaz.");
        await reconcileOnce();
        return;
      }

      if (mode === "in") {
        const login = uname || em;
        if (!login || password.length < 8) {
          setError("Lakap veya e-posta ve şifre lazım.");
          return;
        }
        const resolved = await resolveEmail(login);
        const { error: err } = await supabase.auth.signInWithPassword({
          email: resolved,
          password,
        });
        if (err) {
          setError(mapSbError(err.message));
          return;
        }
        await reconcileOnce();
        reset();
        onOpenChange(false);
        return;
      }

      if (mode === "forgot") {
        const login = em || uname;
        if (!login) {
          setError("E-posta yaz.");
          return;
        }
        const target = login.includes("@")
          ? login.toLowerCase()
          : await resolveEmail(login);
        const { error: err } = await supabase.auth.resetPasswordForEmail(
          target,
          { redirectTo: `${origin()}/reset-password` },
        );
        if (err) {
          setError(mapSbError(err.message));
          return;
        }
        setOk("Reset linki mailde.");
        return;
      }

      if (mode === "pw") {
        if (!user?.email) {
          setError("Oturum yok.");
          return;
        }
        if (current.length < 1) {
          setError("Eski şifreyi yaz.");
          return;
        }
        if (password.length < 8) {
          setError("Yeni şifre en az 8 karakter.");
          return;
        }
        if (password !== password2) {
          setError("Şifreler uyuşmuyor.");
          return;
        }
        const { error: check } = await supabase.auth.signInWithPassword({
          email: user.email,
          password: current,
        });
        if (check) {
          setError("Eski şifre yanlış.");
          return;
        }
        const { error: err } = await supabase.auth.updateUser({
          password,
        });
        if (err) {
          setError(mapSbError(err.message));
          return;
        }
        setOk("Şifre değişti.");
        setCurrent("");
        setPassword("");
        setPassword2("");
      }
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      setError(detail);
    } finally {
      setBusy(false);
    }
  };

  const title = signedIn
    ? "Hesap"
    : mode === "up"
      ? "Hesap oluştur"
      : mode === "forgot"
        ? "Şifremi unuttum"
        : "Giriş yap";

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
        else if (signedIn) setMode("pw");
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{local(title)}</DialogTitle>
          <DialogDescription>
            {local(signedIn
              ? "Şifre değiştir, e-postanı doğrula. Bulut kayıt doğrulanmış hesaba yazar."
              : mode === "up"
                ? "Kullanıcı adı, e-posta ve şifre. Misafir olarak da oynarsın."
                : mode === "forgot"
                  ? "E-postana reset linki gider."
                  : "Lakap veya e-posta + şifre. Hesapsız da oynanır.")}
          </DialogDescription>
        </DialogHeader>

        {user && !verified ? (
          <div className="mt-3 rounded-xl bg-elevated p-3 text-sm">
            <p className="text-warn">{local("E-postan doğrulanmadı. Bulut kayıt kapalı.")}</p>
            <Button className="mt-2" variant="ghost" disabled={busy} onClick={() => void resend()}>
              {local("Doğrulama maili tekrar gönder")}
            </Button>
          </div>
        ) : null}

        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          {!signedIn && mode !== "forgot" ? (
            <div>
              <label className="block text-xs font-medium tracking-wide text-muted uppercase">
                {local(mode === "in" ? "Lakap veya e-posta" : "Kullanıcı adı")}
              </label>
              <Input
                className="mt-1.5"
                value={username}
                maxLength={mode === "in" ? 64 : 24}
                autoComplete="username"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                placeholder={pl ? (mode === "in" ? "Troy lub ty@mail.com" : "np. Troy") : mode === "in" ? "Troy veya sen@mail.com" : "ör. Troy"}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
          ) : null}

          {mode === "up" || mode === "forgot" ? (
            <div>
              <label className="block text-xs font-medium tracking-wide text-muted uppercase">
                {pl ? "E-mail" : "E-posta"}
              </label>
              <Input
                className="mt-1.5"
                type="email"
                value={email}
                autoComplete="email"
                placeholder={pl ? "ty@mail.com" : "sen@mail.com"}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          ) : null}

          {mode === "pw" ? (
            <div>
              <label className="block text-xs font-medium tracking-wide text-muted uppercase">
                {local("Eski şifre")}
              </label>
              <Input
                className="mt-1.5"
                type="password"
                value={current}
                autoComplete="current-password"
                onChange={(e) => setCurrent(e.target.value)}
              />
            </div>
          ) : null}

          {mode !== "forgot" ? (
            <div>
              <label className="block text-xs font-medium tracking-wide text-muted uppercase">
                {local(mode === "pw" ? "Yeni şifre" : "Şifre")}
              </label>
              <Input
                className="mt-1.5"
                type="password"
                value={password}
                autoComplete={mode === "in" ? "current-password" : "new-password"}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          ) : null}

          {mode === "up" || mode === "pw" ? (
            <div>
              <label className="block text-xs font-medium tracking-wide text-muted uppercase">
                {local("Şifre (tekrar)")}
              </label>
              <Input
                className="mt-1.5"
                type="password"
                value={password2}
                autoComplete="new-password"
                onChange={(e) => setPassword2(e.target.value)}
              />
            </div>
          ) : null}

          {mode === "up" ? (
            <p className="text-xs text-warn">
              {local("E-posta yoksa şifreyi unutursan hesap ve kayıt gider.")}
            </p>
          ) : null}

          {error ? <p className="text-sm text-danger">{pl ? polishAccountError(error) : error}</p> : null}
          {ok ? <p className="text-sm text-accent">{local(ok)}</p> : null}

          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            {!signedIn ? (
              <button
                type="button"
                className="text-xs text-muted underline-offset-4 hover:text-fg hover:underline"
                onClick={() => {
                  setMode((m) =>
                    m === "up" ? "in" : m === "forgot" ? "in" : "up",
                  );
                  setError(null);
                  setOk(null);
                }}
              >
                {local(mode === "up"
                  ? "Zaten hesabım var, giriş yapayım"
                  : mode === "forgot"
                    ? "Girişe dön"
                    : "Hesabım yok, oluşturayım")}
              </button>
            ) : (
              <span />
            )}
            <Button type="submit" disabled={busy}>
              {local(busy
                ? "Bekle…"
                : mode === "up"
                  ? "Hesap oluştur"
                  : mode === "forgot"
                    ? "Reset linki gönder"
                    : mode === "pw"
                      ? "Şifre değiştir"
                      : "Giriş yap")}
            </Button>
          </div>
          {!signedIn && mode === "in" ? (
            <button
              type="button"
              className="text-xs text-accent underline-offset-4 hover:underline"
              onClick={() => {
                setMode("forgot");
                setError(null);
                setOk(null);
              }}
            >
              {local("Şifremi unuttum")}
            </button>
          ) : null}
        </form>
      </DialogContent>
    </Dialog>
  );
}
