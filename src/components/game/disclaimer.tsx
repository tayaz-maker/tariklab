import { useLang } from "@/lib/i18n";

export function Disclaimer() {
  const { lang } = useLang();
  return (
    <p className="px-4 py-3 text-center text-[0.65rem] leading-relaxed text-subtle">
      {lang === "pl" ? "Fikcja. Gra nie zachęca do hazardu, narkotyków ani przemocy w prawdziwym życiu. 18+." : "Kurgusal içerik. Gerçek kumar, uyuşturucu veya şiddet teşviki değil. 18+."}
    </p>
  );
}
