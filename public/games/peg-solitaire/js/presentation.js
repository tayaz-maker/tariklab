// Translate canonical result values only at the presentation boundary.
const copy = {
  Usta: ['Master', 'Mistrz'], Kusursuz: ['Perfect', 'Doskonale'],
  'Çok iyi': ['Very good', 'Bardzo dobrze'], İyi: ['Good', 'Dobrze'],
  Geçer: ['Fair', 'Zadowalająco'], Deneme: ['Keep trying', 'Próbuj dalej'],
  'Tek taş, tam merkezde. Klasik çözüm.': ['One peg, right in the centre. The classic solution.', 'Jeden pionek dokładnie pośrodku. Klasyczne rozwiązanie.'],
  'Tek taş kaldı.': ['One peg remains.', 'Pozostał jeden pionek.'],
  'Kıl payı.': ['So close.', 'Tak blisko.'],
  'Sağlam bir tahta okuması.': ['A strong reading of the board.', 'Dobre odczytanie planszy.'],
  'Fena değil.': ['Not bad.', 'Nieźle.'],
  'Taşlar erken sıkıştı.': ['The pegs got stuck early.', 'Pionki zablokowały się zbyt wcześnie.'],
};
export function resultLabel(value, lang) { return lang === 'tr' ? value : copy[value]?.[lang === 'pl' ? 1 : 0] || value; }
export function scoreCopy(kind, values, lang) {
  const {remaining, moves, center, grade, note, better} = values;
  if (kind === 'best') return lang === 'pl' ? `Twój rekord: pozostało ${remaining} pionków · ${moves} ruchów${center ? ' · w środku' : ''}` : lang === 'en' ? `Your best: ${remaining} pegs left · ${moves} moves${center ? ' · in the centre' : ''}` : `En iyin: ${remaining} taş kaldı · ${moves} hamle${center ? ' · merkezde' : ''}`;
  if (kind === 'note') return `${resultLabel(note, lang)}${better ? lang === 'pl' ? ' Nowy rekord osobisty.' : lang === 'en' ? ' New personal best.' : ' Yeni kişisel rekor.' : ''}`;
  return lang === 'pl' ? `Brak ruchów — ${remaining} pionków, ${resultLabel(grade, lang)}.` : lang === 'en' ? `No moves left — ${remaining} pegs, ${resultLabel(grade, lang)}.` : `Hamle kalmadı — ${remaining} taş, ${grade}.`;
}
