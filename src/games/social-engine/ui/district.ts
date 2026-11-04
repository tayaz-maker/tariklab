// Translate historical narrative at display time; do not rewrite signed saves or journal records.
export function districtText(text: string): string {
  return text.replace(/k[ıi]y[ıi]yaka(?:[’'](dan|nın|ya|da|yı))?/giu, (_, suffix?: string) => {
    const endings: Record<string, string> = {
      ya: "’a",
      da: "’ta",
      dan: "’tan",
      nın: "’ın",
      yı: "’ı",
    };
    return "DARAMCIK" + (endings[suffix?.toLocaleLowerCase("tr") ?? ""] ?? "");
  });
}
