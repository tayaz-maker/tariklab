import { CHAINS } from "../next-wave/apartman-chains.js";

// Resolve legacy save identifiers for display; never rewrite persisted history.
const memories = new Map();
for (const chain of CHAINS) {
  for (const stage of chain.stages) {
    for (const choice of stage.choices || []) {
      for (const memory of choice.effects?.remember || []) {
        if (!memories.has(memory.type)) memories.set(memory.type, choice.label);
      }
    }
  }
}

export function memoryLabel(memory, localize, text) {
  const label = memories.get(memory?.type);
  if (label) return localize(label);
  return text("Geçmiş bir yönetim kararı", "An earlier management decision");
}

export function allianceLabel(id, text) {
  const labels = {
    eski: ["Eski sakinler", "Long-term residents"],
    yeni: ["Yeni sakinler", "New residents"],
    kiraci: ["Kiracılar", "Tenants"],
  };
  return text(...(labels[id] || ["Sakin grubu", "Resident group"]));
}

export function systemLabel(id, parts, localize, text) {
  const part = parts.find((item) => item.id === id);
  return part ? localize(part.name) : text("ortak alan", "common area");
}

const DISPLAY_LABELS = {
  'Aidat borcu': ['Arrears', 'Zaległości'],
  Bina: ['Building', 'Budynek'],
  Güven: ['Confidence', 'Zaufanie'],
  tahmini: ['estimate', 'szacunek'],
  'gecikme riski': ['delay risk', 'ryzyko zwłoki'],
  'ortak alan': ['common area', 'część wspólna'],
  '2. kat kolon sızıntısı': ['2nd-floor column leak', 'Przeciek w pionie na 2. piętrze'],
  bakım: ['maintenance', 'utrzymanie'],
  'Asansör kat arasında': ['Lift stuck between floors', 'Winda między piętrami'],
  "Sevim içeride kalmış, on dakika. Ses hâlâ var. Elif 'periyodik kontrol tarihi geçmiş olabilir' diyor.": ["Sevim has been stuck inside for ten minutes. You can still hear her. Elif says the periodic inspection may be overdue.", 'Sevim utknęła w środku, dziesięć minut. Wciąż ją słychać. Elif mówi: „termin przeglądu okresowego mógł minąć”.'],
  'apartman yönetimi': ['building management', 'zarządzanie budynkiem'],
  'site kurulu': ['estate board', 'rada osiedla'],
  'profesyonel tesis yönetimi': ['professional estate management', 'profesjonalne zarządzanie osiedlem'],
  'yıpranmış bina': ['worn building', 'zużyty budynek'],
  'yenileme baskısı': ['renovation pressure', 'presja remontowa'],
  'kanaat önderi': ['community voice', 'głos społeczności'],
  'bina kimliği': ['building identity', 'tożsamość budynku'],
  'sessiz defter': ['quiet record keeper', 'cichy kronikarz'],
  'merdiven temizliği': ['stairwell cleaning', 'czystość klatki schodowej'],
  itirazcı: ['dissenter', 'oponent'], 'kaliteli bakım': ['quality maintenance', 'solidna konserwacja'],
  'mühendis defteri': ['engineering mindset', 'inżynierskie podejście'],
  'ölçülen bakım': ['measured maintenance', 'konserwacja oparta na pomiarach'],
  'daire değeri': ['flat value', 'wartość mieszkania'],
  'sadık şikâyetçi': ['regular complainant', 'stały skarżący'],
  'çocuk bahçesi': ['playground', 'plac zabaw'], 'gece ustası': ['night handyman', 'nocny majster'],
  'tadilat özgürlüğü': ['renovation freedom', 'swoboda remontów'],
  temkinli: ['cautious', 'ostrożny'], sessizlik: ['quiet', 'cisza'],
  'geçici kiracı': ['temporary tenant', 'tymczasowy najemca'], otopark: ['parking', 'parking'],
  'seçim defteri': ['election records', 'rejestr wyborczy'], ocakçı: ['boiler attendant', 'palacz'],
  'baca ve koku': ['chimney and odours', 'komin i zapachy'],
  'taksit nefesi': ['instalment relief', 'ulga w ratach'],
  'geç saat': ['late hours', 'późne godziny'], 'misafir ve kargo': ['visitors and deliveries', 'goście i przesyłki'],
  'çatı ve yangın': ['roof and fire safety', 'dach i ochrona przeciwpożarowa'],
  'yenileme hayali': ['renovation hopes', 'plany remontowe'],
  'dükkân sözleşmesi': ['shop lease', 'umowa najmu sklepu'],
};
export function managementLabel(value, lang, localize = text => text) {
  if (lang === 'tr') return value;
  return DISPLAY_LABELS[value]?.[lang === 'pl' ? 1 : 0] || localize(value);
}
