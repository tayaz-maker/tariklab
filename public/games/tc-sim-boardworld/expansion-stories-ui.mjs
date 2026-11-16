import { localizeUnderworldText } from "./expansion-underworld.mjs";
const words = {
  'Bu süre ajandandaki bir planla çakışıyor.':['This overlaps with a confirmed calendar plan.','To koliduje z potwierdzonym planem w kalendarzu.'],
  'Mesleki eğitime destek ol':['Fund vocational training','Sfinansuj szkolenie zawodowe'],
  '100 TL ve zaman ayır; komşunun mesleki becerisi gelişir.':['Spend 100 TL and time to improve your neighbour’s vocational skill.','Poświęć 100 TL i czas na rozwój umiejętności zawodowych sąsiada.'],
  'Taşınan komşunun borcuna destek ol':['Help your moved neighbour with debt','Pomóż spłacić dług sąsiada po przeprowadzce'],
  'Komşunun taşınma sonrası borcuna doğrudan ödeme yap.':['Pay directly toward your neighbour’s debt after their move.','Wpłać bezpośrednio na dług sąsiada po przeprowadzce.'],
  'Komşunun borcuna destek ol':['Help with your neighbour’s debt','Pomóż spłacić dług sąsiada'],
  'Borç sahibinin yükümlülüğüne doğrudan ödeme yap.':['Pay directly toward your neighbour’s debt.','Wpłać bezpośrednio na dług sąsiada.'],
  'Komşunun borcuna destek oldun.':['You helped pay your neighbour’s debt.','Pomogłeś spłacić dług sąsiada.'],
  'İş bilgisi iste':['Ask for career advice','Poproś o poradę zawodową'],
  'Güvenin sayesinde mesleki bilgi edin; bilgi becerin artar.':['Your trusted contact shares career knowledge, improving your knowledge skill.','Zaufany kontakt dzieli się wiedzą zawodową, rozwijając twoją wiedzę.'],
  'Komşunun mesleki eğitimine destek oldun.':['You supported your neighbour’s vocational training.','Wsparto szkolenie zawodowe sąsiada.'],
  'Taşınan komşunun borcuna destek oldun.':['You helped pay your neighbour’s debt after their move.','Pomogłeś spłacić dług sąsiada po przeprowadzce.'],
  'Komşunun iş bilgisi becerini geliştirdi.':['Your neighbour’s career advice improved your knowledge.','Porada zawodowa sąsiada rozwinęła twoją wiedzę.'],
  'Hikâye kararı tamamlanamadı.':['The story action could not be completed.','Nie udało się ukończyć działania.'],
  'Komşuya destek ol':['Help your neighbour','Pomóż sąsiadowi'],
  'Malzeme ve zaman ayır; bağ güçlenir.':['Give supplies and time; strengthen the relationship.','Poświęć materiały i czas; wzmocnij więź.'],
  'Komşuyu dinle':['Listen to your neighbour','Wysłuchaj sąsiada'],
  'Zaman ayır; bağ biraz güçlenir.':['Give your time; strengthen the relationship a little.','Poświęć czas; trochę wzmocnij więź.'],
  'Desteği reddet':['Decline to help','Odmów pomocy'],
  'Zaman kazan; bağ zayıflar.':['Save time; weaken the relationship.','Oszczędź czas; osłab więź.'],
  'Komşundan destek iste':['Ask your neighbour for support','Poproś sąsiada o wsparcie'],
  'Güçlü bağın sayesinde birlikte vakit geçir ve stresi azalt.':['Spend time together thanks to your strong bond and reduce stress.','Spędźcie razem czas dzięki silnej więzi i zmniejsz stres.'],
  'Komşuna destek oldun; bağınız güçlendi.':['You helped your neighbour; your bond grew stronger.','Pomogłeś sąsiadowi; wasza więź się wzmocniła.'],
  'Komşunu dinledin; bağınız güçlendi.':['You listened to your neighbour; your bond grew stronger.','Wysłuchałeś sąsiada; wasza więź się wzmocniła.'],
  'Desteği reddettin; bağınız zayıfladı.':['You declined to help; your bond weakened.','Odmówiłeś pomocy; wasza więź osłabła.'],
  'Komşunla vakit geçirmek stresini azalttı.':['Time with your neighbour reduced your stress.','Czas z sąsiadem zmniejszył twój stres.'],
};
export function localizeStoryText(text, language) { return language === 'tr' ? text : words[text]?.[language === 'pl' ? 1 : 0] || text; }
export function renderStories({view, actions, actionCard, esc, language}) {
  const tr = language === 'tr', pl = language === 'pl';
  const l = (a,b,c) => tr ? a : pl ? c : b;
  const arcs = (view.stories?.arcs || []).filter(a => a.owner === view.family.player.id).slice().reverse();
  const justice = (view.stories?.justice || []).filter(a => a.owner === view.family.player.id);
  if (!arcs.length && !justice.length) return '';
  const statuses = {
    open:l('Destek bekliyor','Needs support','Potrzebuje wsparcia'),
    helped:l('Destek verdin','You helped','Udzielono pomocy'),
    listened:l('Dinledin','You listened','Wysłuchano'),
    declined:l('Reddettin','You declined','Odmówiono'),
    expired:l('Fırsat geçti','Opportunity passed','Okazja minęła'),
  };
  const cards = arcs.map(a => {
    const character = view.society?.characters?.find(c => c.id === a.person && c.generation === a.generation);
    const goal = {stability:l('İstikrar','Stability','Stabilność'),advancement:l('İlerleme','Advancement','Awans'),connections:l('Bağlar','Connections','Kontakty'),security:l('Güvence','Security','Bezpieczeństwo')};
    const relevant = actions.filter(x => x.id.startsWith('story:') && x.id.endsWith(`:${a.person}`));
    return `<li><strong>${esc(a.name)}</strong> · ${esc(statuses[a.status])} · ${l('Gün','Day','Dzień')} ${Math.floor(a.startedAt/1440)+1}${a.status === 'open' ? `<p>${a.kind === 'ambition' ? l('İş arayan komşun eğitiminden söz etti. Üç gün içinde karar ver.', 'Your job-seeking neighbour spoke about training. Decide within three days.', 'Sąsiad szukający pracy mówił o szkoleniu. Wybierz w ciągu trzech dni.') : a.kind === 'migration' ? l('Yeni taşınan komşun borcundan söz etti. Üç gün içinde karar ver.', 'Your recently relocated neighbour spoke about debt. Decide within three days.', 'Niedawno przeprowadzony sąsiad mówił o długu. Wybierz w ciągu trzech dni.') : l('Görüştüğün komşu destek istiyor. Üç gün içinde karar ver.', 'A neighbour you met asks for support. Decide within three days.', 'Poznany sąsiad prosi o wsparcie. Podejmij decyzję w ciągu trzech dni.')}</p>` : ''}${character ? `<p>${l('Güven','Trust','Zaufanie')}: ${esc(character.trust)} · ${l('Hedef','Goal','Cel')}: ${esc(goal[character.goal] || character.goal)}</p>` : ''}${relevant.length ? `<div class="action-grid">${relevant.map(x => actionCard(x)).join('')}</div>` : a.status === 'open' ? `<p>${l('Bu semtteki komşuna ulaşınca seçenekler açılır.', 'Options appear when your neighbour is present in this district.', 'Opcje pojawią się, gdy sąsiad będzie obecny w tej dzielnicy.')}</p>` : ''}</li>`;
  }).join('');
  const cases = justice.map(a => {
    const c = view.underworld?.cases?.find(c=>c.id===a.id && c.scope==='personal');
    if (!c) return '';
    return `<li>${l('Bildirilmiş dosya','Reported case','Zgłoszona sprawa')} · ${esc(localizeUnderworldText(c.status,language))} · ${l('Öğrenilen kanıt','Disclosed evidence','Ujawnione dowody')}: ${esc(c.evidence.length)}<p>${l('İnceleme ve ödeme seçenekleri yerel örgütler bölümünde, bulunduğun yere göre görünür.','Review and payment options appear under local organizations when available at your location.','Opcje przeglądu i płatności są dostępne w lokalnych organizacjach, zależnie od miejsca.')}</p></li>`;
  }).join('');
  return `${arcs.length ? `<details class="reference"><summary>${l('İlişki hikâyeleri','Relationship stories','Historie relacji')}</summary><ul>${cards}</ul></details>` : ''}${cases ? `<details class="reference"><summary>${l('Hukuk hikâyeleri','Justice stories','Historie wymiaru sprawiedliwości')}</summary><ul>${cases}</ul></details>` : ''}`;
}

export function renderSociety({view, esc, language}) {
  const l = (tr,en,pl) => language === 'tr' ? tr : language === 'pl' ? pl : en;
  const district = view.districts?.place?.districtId;
  const districtName = id => view.districts?.districts?.find(d=>d.id===id)?.name || l('Yerel semt','Local district','Lokalna dzielnica');
  const organizations = (view.society?.organizations || []).filter(o => o.territories?.some(t => t.districtId === district));
  if (!organizations.length) return '';
  const strategy = {security:l('Güvenlik','Security','Bezpieczeństwo'),trade:l('Ticaret','Trade','Handel'),expansion:l('Genişleme','Expansion','Ekspansja')};
  const roles = {leader:l('Lider','Leader','Lider'),organizer:l('Organizatör','Organizer','Organizator'),member:l('Üye','Member','Członek')};
  const kinds = {dissolution:l('Dağılma','Dissolution','Rozwiązanie'),succession:l('Lider değişimi','Leadership change','Zmiana lidera'),betrayal:l('İç anlaşmazlık','Internal conflict','Konflikt wewnętrzny'),reorganization:l('Yeniden yapılanma','Reorganization','Reorganizacja'),pressure:l('Baskı','Pressure','Presja'),withdrawal:l('Geri çekilme','Withdrawal','Wycofanie'),outreach:l('Yerel temas','Outreach','Kontakty lokalne'),reinforcement:l('Destek','Reinforcement','Wzmocnienie'),contested:l('Çekişme','Contested','Spór'),...strategy};
  return `<details class="reference"><summary>${l('Yerel örgüt yapısı','Local organization structure','Struktura lokalnych organizacji')}</summary><ul>${organizations.map(o => {
    const known = Boolean(view.underworld?.chapters?.find(c => c.id === o.id)?.leader);
    const territories=o.territories.filter(t=>t.districtId===district).map(t=>`<li><strong>${esc(districtName(t.districtId))}</strong> · ${l('Etki','Influence','Wpływy')} ${esc(t.influence)} · ${l('Destek','Sentiment','Nastroje')} ${esc(t.sentiment)}<br>${l('Bakım maliyeti','Upkeep','Koszt utrzymania')} ${esc(t.cost)} TL · ${l('Ekonomik bağlar','Economic connections','Powiązania gospodarcze')} ${esc(t.connections)} · ${l('Üye alımı','Recruitment','Rekrutacja')} ${esc(t.recruitment)} · ${l('Polis ilgisi','Police attention','Uwaga policji')} ${esc(t.attention)} · ${l('Rakip baskısı','Rival pressure','Presja rywali')} ${esc(t.rivalry)}</li>`).join('');
    const factions=known ? (o.factions || []).map(f=>`<li>${esc(strategy[f.id] || f.id)} · ${l('Destek','Support','Poparcie')} ${esc(f.support)}<ul>${(f.members || []).map(m=>`<li>${esc(m.name || l('Bilinmiyor','Unknown','Nieznany'))} · ${esc(roles[m.role] || m.role)} · ${l('Sadakat','Loyalty','Lojalność')} ${esc(m.loyalty)} · ${l('Hırs','Ambition','Ambicja')} ${esc(m.ambition)}</li>`).join('')}</ul></li>`).join('') : '';
    const history=(o.history || []).filter(h=>known || h.districtId===district).slice(-8).reverse().map(h=>`<li>${l('Gün','Day','Dzień')} ${esc(h.day)} · ${esc(kinds[h.kind] || h.kind)}${h.actor ? ` · ${esc(h.actor)}` : ''}${h.districtId ? ` · ${esc(districtName(h.districtId))}` : ''}${h.cost ? ` · ${esc(h.cost)} TL` : ''}</li>`).join('');
    return `<li><strong>${esc(o.name)}</strong>${o.dissolved ? ` · ${l('Dağıldı','Dissolved','Rozwiązana')}` : ''} · ${l('Lider','Leader','Lider')}: ${esc(known ? o.leader : '—')} · ${l('Meşruiyet','Legitimacy','Legitymacja')}: ${esc(o.legitimacy)} · ${l('Strateji','Strategy','Strategia')}: ${esc(strategy[o.strategy] || o.strategy)}<details><summary>${l('Bölge ve örgüt ayrıntıları','Territory and organization details','Szczegóły terytorium i organizacji')}</summary><ul>${territories}</ul>${factions ? `<h4>${l('Gruplar','Factions','Frakcje')}</h4><ul>${factions}</ul>` : ''}${history ? `<h4>${l('Geçmiş','History','Historia')}</h4><ul>${history}</ul>` : ''}</details></li>`;
  }).join('')}</ul></details>`;
}

export function renderFamilyStories({view, actions, actionCard, esc, language}) {
  const l = (tr,en,pl) => language === 'tr' ? tr : language === 'pl' ? pl : en;
  const rows = (view.stories?.family || []).filter(a => a.owner === view.family.player.id).slice().reverse();
  if (!rows.length) return '';
  const status = {open:l('Bir seçim zamanı','A choice awaits','Czas na wybór'),care:l('Birlikte zaman geçirdiniz','You spent time together','Spędziliście razem czas'),study:l('Eğitime zaman ayırdınız','You chose study','Wybrano naukę'),expired:l('Fırsat geçti','Opportunity passed','Okazja minęła')};
  return `<details class="reference"><summary>${l('Aile hikâyeleri','Family stories','Historie rodzinne')}</summary><ul>${rows.map(a => {
    const choices = a.status === 'open' ? actions.filter(x => x.id === `family:care:${a.person}` || x.id.startsWith(`family:focus:${a.person}:`)) : [];
    return `<li><strong>${esc(a.name)}</strong> · ${esc(status[a.status])}${a.status === 'open' ? `<p>${l('Bakım bağınızı, eğitim ise öğrenmeyi geliştirir. Yedi gün içinde birini seç.', 'Care builds your bond; study improves learning. Choose within seven days.', 'Opieka wzmacnia więź, nauka rozwija wiedzę. Wybierz w ciągu siedmiu dni.')}</p><div class="action-grid">${choices.map(x => actionCard(x)).join('')}</div>` : ''}</li>`;
  }).join('')}</ul></details>`;
}

export function renderBusinessStories({view, actions, actionCard, esc, language}) {
  const l = (tr,en,pl) => language === 'tr' ? tr : language === 'pl' ? pl : en;
  const rows=(view.stories?.business || []).filter(a=>a.owner===view.family.player.id).slice().reverse();
  if (!rows.length) return '';
  const status={open:l('Nakit baskısı','Cash pressure','Presja gotówkowa'),funded:l('Sermaye aktarıldı','Capital added','Dodano kapitał'),paused:l('İşletme duraklatıldı','Business paused','Wstrzymano działalność'),expired:l('Fırsat geçti','Opportunity passed','Okazja minęła')};
  return `<details class="reference"><summary>${l('İşletme hikâyeleri','Business stories','Historie biznesowe')}</summary><ul>${rows.map(a=>`<li>${esc(status[a.status])}${a.status==='open' ? `<p>${l('İşletme kasası azaldı. Kişisel sermaye aktarabilir veya faaliyeti duraklatabilirsin.','The business has little cash. Add personal capital or pause operations.','W kasie firmy jest mało pieniędzy. Dodaj kapitał osobisty lub wstrzymaj działalność.')}</p><div class="action-grid">${actions.filter(x=>/^business:(fund:|pause$)/.test(x.id)).map(x=>actionCard(x)).join('')}</div>` : ''}</li>`).join('')}</ul></details>`;
}
