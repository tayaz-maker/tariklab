import { FOUNDATION } from './content.js';
import { validateFoundation } from './content-schema.js';
import { createAtlasState, reduceAtlasState, visibleStructures } from './view-model.js';
import { createAtlasView } from './svg-view.js';

const root = document.querySelector('#atlas-app');
const $ = (tag, attrs = {}, ...children) => {
  const element = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key.startsWith('on') && typeof value === 'function') element.addEventListener(key.slice(2), value);
    else if (value != null && value !== false) element.setAttribute(key, value === true ? '' : String(value));
  }
  for (const child of children.flat()) if (child != null) element.append(child instanceof Node ? child : document.createTextNode(String(child)));
  return element;
};
const L = (tr, en, pl) => ({ tr, en, pl });
const UI = {
  edition: L('İlk öğrenme sürümü', 'First learning edition', 'Pierwsza wersja edukacyjna'),
  subtitle: L('İnsan anatomisi · Katmanlı, kaynaklı bir öğrenme önizlemesi', 'Human anatomy · A layered, sourced learning preview', 'Anatomia człowieka · Podgląd edukacyjny z warstwami i źródłami'),
  sources: L('Kaynaklar ve kapsam', 'Sources and scope', 'Źródła i zakres'),
  language: L('Dil', 'Language', 'Język'),
  draft: L('Taslak · Uzman incelemesi bekliyor', 'Draft · Expert review pending', 'Wersja robocza · Oczekuje na recenzję'),
  controls: L('Görünümü keşfet', 'Explore the view', 'Poznaj widok'),
  adult: L('Yetişkin varyantı', 'Adult variant', 'Wariant osoby dorosłej'),
  female: L('Kadın', 'Female', 'Kobieta'), male: L('Erkek', 'Male', 'Mężczyzna'),
  direction: L('Bakış yönü', 'View direction', 'Kierunek widoku'),
  front: L('Ön', 'Front', 'Przód'), back: L('Arka', 'Back', 'Tył'),
  layers: L('Katmanlar', 'Layers', 'Warstwy'),
  search: L('Bir yapı bul', 'Find a structure', 'Znajdź strukturę'),
  placeholder: L('Kalp, kemik, böbrek…', 'Heart, bone, kidney…', 'Serce, kość, nerka…'),
  structures: L('yapı', 'structures', 'struktur'),
  noResults: L('Bu katmanlarda eşleşme yok. Başka bir katman açabilir veya aramayı temizleyebilirsin.', 'No matches in these layers. Enable another layer or clear the search.', 'Brak wyników w tych warstwach. Włącz inną warstwę lub wyczyść wyszukiwanie.'),
  diagram: L('Katmanlı beden görünümü', 'Layered body view', 'Warstwowy widok ciała'),
  caption: L('İç yapılar, saydam beden üzerinden yaklaşık konumlarında gösterilir. Bu bir kesit, ölçekli klinik model veya tüm anatomik ayrıntıların çizimi değildir.', 'Internal structures are projected through a transparent body at approximate locations. This is not a section, a scaled clinical model or a drawing of every anatomical detail.', 'Struktury wewnętrzne są rzutowane przez przezroczyste ciało w przybliżonych miejscach. To nie przekrój, model kliniczny w skali ani rysunek wszystkich szczegółów anatomicznych.'),
  zoomIn: L('Yakınlaştır', 'Zoom in', 'Powiększ'), zoomOut: L('Uzaklaştır', 'Zoom out', 'Pomniejsz'),
  reset: L('Sığdır', 'Fit', 'Dopasuj'),
  panLeft: L('Sola kaydır', 'Pan left', 'Przesuń w lewo'), panRight: L('Sağa kaydır', 'Pan right', 'Przesuń w prawo'),
  panUp: L('Yukarı kaydır', 'Pan up', 'Przesuń w górę'), panDown: L('Aşağı kaydır', 'Pan down', 'Przesuń w dół'),
  keyboard: L('Bu görünümde + / − ile yakınlaştır; yön tuşlarıyla kaydır. Yapıları aşağıdaki listeden de seçebilirsin.', 'In this view, use + / − to zoom and arrow keys to pan. Structures are also available in the list.', 'W tym widoku użyj + / − do powiększania i strzałek do przesuwania. Struktury można też wybrać z listy.'),
  function: L('Temel işlev', 'Main function', 'Główna funkcja'), location: L('Yaklaşık konum', 'Approximate location', 'Przybliżone położenie'),
  hidden: L('Seçili yapının katmanı kapalı.', 'The selected structure’s layer is hidden.', 'Warstwa wybranej struktury jest ukryta.'),
  reveal: L('Yapının katmanını göster', 'Show this structure’s layer', 'Pokaż warstwę tej struktury'),
  review: L('Bağımsız uzman incelemesi: yapılmadı.', 'Independent expert review: not performed.', 'Niezależna recenzja ekspercka: nie wykonano.'),
  owner: L('Taslak sorumlusu: Astra. Uzman atanmadı.', 'Draft owner: Astra. No expert assigned.', 'Odpowiedzialność za wersję roboczą: Astra. Ekspert nieprzypisany.'),
  sourceCount: L('Bu yapının kaynakları', 'Sources for this structure', 'Źródła dla tej struktury'),
  lesson: L('Üç duraklı keşif', 'A three-stop exploration', 'Poznawanie w trzech krokach'),
  lesson0: L('Kalbi seç. Göğüs kafesiyle ilişkisini görmek için iskelet katmanını açıp kapat; işlev ve konum açıklamalarını karşılaştır.', 'Select the heart. Toggle the skeleton to explore its relation to the thoracic cage, then compare the function and location notes.', 'Wybierz serce. Przełącz szkielet, aby poznać jego położenie względem klatki piersiowej. Porównaj opis funkcji i położenia.'),
  lesson1: L('Akciğerleri seç. İki yandaki yerleşimi incele. Ön ve arka görünüm aynı yapı için farklı bakış yönleridir.', 'Select the lungs. Explore their placement on both sides. Front and back are different views of the same structure.', 'Wybierz płuca. Przyjrzyj się ich położeniu po obu stronach. Przód i tył to różne widoki tej samej struktury.'),
  lesson2: L('Böbrekleri seç ve arka görünüme geç. Saydam izdüşümü, kaynaklı konum notuyla birlikte oku; görünen konturlar yaklaşık çizimdir.', 'Select the kidneys and switch to the back view. Read the transparent projection alongside the sourced location note; contours are approximate.', 'Wybierz nerki i przejdź do widoku z tyłu. Czytaj przezroczysty rzut razem z opisem położenia opartym na źródłach; kontury są przybliżone.'),
  previous: L('Önceki', 'Previous', 'Poprzedni'), next: L('Sonraki', 'Next', 'Następny'),
  close: L('Kapat', 'Close', 'Zamknij'), later: L('Sonraki içerik dalgaları', 'Later content waves', 'Późniejsze etapy treści'),
  sourceDate: L('Kaynak tarihi', 'Source date', 'Data źródła'), accessed: L('Kontrol tarihi', 'Accessed', 'Data dostępu'),
  unknownDate: L('Kaynakta belirtilmemiş', 'Not stated by the source', 'Nie podano w źródle'),
  sourced: L('Kaynaklar yalnız olgusal doğrulama içindir; kurum onayı veya görsel lisansı iddiası yoktur.', 'Sources support factual checks only; no institutional endorsement or artwork licence is implied.', 'Źródła służą wyłącznie sprawdzeniu faktów; nie oznaczają poparcia instytucji ani licencji na ilustracje.'),
  offlineInstalling: L('Offline paket doğrulanıyor…', 'Verifying the offline package…', 'Weryfikowanie pakietu offline…'),
  offlineReady: L('Bu ilk sürüm offline hazır', 'This first edition is ready offline', 'Ta pierwsza wersja jest gotowa offline'),
  offlineUnavailable: L('Bu tarayıcıda offline kurulum kullanılamıyor. Online görünüm açık.', 'Offline installation is unavailable in this browser. The online view remains available.', 'Instalacja offline jest niedostępna w tej przeglądarce. Widok online jest dostępny.'),
  offlineError: L('Offline paket henüz hazır değil. Bağlantı açıkken yeniden dene.', 'The offline package is not ready yet. Try again while connected.', 'Pakiet offline nie jest jeszcze gotowy. Spróbuj ponownie z połączeniem.'),
  retry: L('Yeniden dene', 'Retry', 'Spróbuj ponownie'),
  privacy: L('Sessiz · Dış asset yok · Sağlık verisi toplanmaz', 'Silent · No external assets · No health data collected', 'Bez dźwięku · Bez zasobów zewnętrznych · Bez zbierania danych zdrowotnych'),
  productError: L('Öğrenme içeriği doğrulanamadı. Sayfayı yenileyebilirsin; oyun kayıtların değiştirilmedi.', 'The learning content could not be validated. You can reload the page; game saves were not changed.', 'Nie udało się zweryfikować treści edukacyjnej. Możesz odświeżyć stronę; zapisy gier nie zostały zmienione.'),
};

function initialLocale() {
  const query = new URL(location.href).searchParams.get('lang');
  if (['tr', 'en', 'pl'].includes(query)) return query;
  try { return ['tr', 'en', 'pl'].includes(localStorage.getItem('tariklab.language')) ? localStorage.getItem('tariklab.language') : 'tr'; }
  catch { return 'tr'; }
}
function hashSelection() { return new URLSearchParams(location.hash.slice(1)).get('structure'); }
let state = createAtlasState({ locale: initialLocale(), selectedId: hashSelection() || 'heart', sourceOpen: location.hash === '#sources' });
let atlasView;
let offlineState = { state: 'installing', version: '' };
let offlineBusy = false;
let sourceOpener = null;
const refs = {};
const text = value => value?.[state.locale] ?? value?.tr ?? '';
const copy = key => text(UI[key]);
const notice = key => text(FOUNDATION.notices[key]);

function dispatch(action) {
  const next = reduceAtlasState(state, action);
  if (next === state) return;
  state = next;
  sync();
}
function selectStructure(id, announce = true) {
  if (!FOUNDATION.structures.some(s => s.id === id)) return;
  state = reduceAtlasState(state, { type: 'set-selection', id });
  history.replaceState(null, '', `${location.pathname}${location.search}#structure=${encodeURIComponent(id)}`);
  sync();
  if (announce) refs.announcement.textContent = text(FOUNDATION.structures.find(s => s.id === id).label);
}
function setSources(open, focus = false) {
  if (open && !state.sourceOpen) sourceOpener = document.activeElement;
  dispatch({ type: 'sources', open });
  if (focus) (open ? refs.sourcesHeading : sourceOpener?.isConnected && sourceOpener?.matches('button') ? sourceOpener : refs.sourceToggle).focus({ preventScroll: !open });
}
const button = (label, attrs, handler) => $('button', { type: 'button', ...attrs, onclick: handler }, label);
const uiTextNodes = [];
function localized(tag, key, attrs = {}) { const node = $(tag, attrs, copy(key)); uiTextNodes.push([node, key]); return node; }

function buildShell() {
  root.replaceChildren();
  const sourceToggle = localized('button', 'sources', { type: 'button', id: 'source-toggle', 'aria-controls': 'sources-panel', 'aria-expanded': 'false', onclick: () => setSources(!state.sourceOpen, true) });
  refs.sourceToggle = sourceToggle;
  const languages = $('div', { class: 'language-controls', role: 'group', 'aria-label': copy('language') }, ['tr', 'en', 'pl'].map(locale => button(locale.toUpperCase(), { 'data-locale': locale, lang: locale }, () => {
    dispatch({ type: 'set-locale', value: locale });
  })));
  refs.languages = languages;
  refs.title = $('h1'); refs.subtitle = localized('p', 'subtitle', { class: 'subtitle' });
  const header = $('header', { class: 'atlas-header' }, $('div', {}, $('div', { class: 'brand-line' }, $('a', { href: '/' }, 'TARIKLAB'), localized('span', 'edition', { class: 'edition' })), refs.title, refs.subtitle), $('div', { class: 'header-tools' }, languages, sourceToggle));
  refs.education = $('p', { id: 'education-note' }); refs.draft = $('p', { id: 'draft-note', 'data-review': 'NOT_REVIEWED' });
  const educational = $('aside', { class: 'education-strip' }, $('div', {}, refs.education, refs.draft), localized('span', 'draft', { class: 'draft-badge' }));
  const segmented = (field, values) => $('div', { class: 'segmented', role: 'group' }, values.map(value => localized('button', value, { type: 'button', [`data-${field}`]: value, onclick: () => dispatch({ type: field === 'variant' ? 'set-variant' : 'set-view', value }) })));
  refs.layers = $('div', { class: 'layers' }, FOUNDATION.systems.map((system, index) => $('label', {}, $('input', { type: 'checkbox', 'data-layer': system.id, onchange: () => dispatch({ type: 'toggle-layer', layer: system.id }) }), $('span', { 'data-layer-label': system.id }), $('small', { class: 'layer-number', 'aria-hidden': 'true' }, `0${index + 1}`))));
  const controls = $('section', { class: 'panel controls-panel', id: 'atlas-controls', 'aria-labelledby': 'controls-title' }, localized('h2', 'controls', { id: 'controls-title', class: 'panel-heading' }), $('div', { class: 'control-group' }, localized('p', 'adult'), segmented('variant', ['female', 'male'])), $('div', { class: 'control-group' }, localized('p', 'direction'), segmented('view', ['front', 'back'])), $('div', { class: 'control-group layer-group' }, localized('p', 'layers'), refs.layers));
  refs.search = $('input', { type: 'search', id: 'structure-search', maxlength: '200', autocomplete: 'off', oninput: e => dispatch({ type: 'search', query: e.target.value }) });
  refs.count = $('p', { class: 'structure-count', role: 'status', 'aria-live': 'polite' });
  refs.list = $('div', { id: 'structure-list', class: 'structure-list' });
  refs.empty = localized('p', 'noResults', { class: 'empty-state', hidden: true });
  const library = $('section', { class: 'panel structure-library' }, localized('label', 'search', { for: 'structure-search' }), refs.search, refs.count, refs.list, refs.empty);
  refs.diagramTitle = localized('strong', 'diagram'); refs.viewCaption = $('span'); refs.viewIndex = $('span', { class: 'view-indicator' });
  refs.mount = $('div', { class: 'diagram-mount', tabindex: '0', role: 'group', 'aria-describedby': 'diagram-keyboard', onkeydown: event => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const actions = { '+': { type: 'zoom', delta: .25 }, '=': { type: 'zoom', delta: .25 }, '-': { type: 'zoom', delta: -.25 }, ArrowLeft: { type: 'pan', dx: -30 }, ArrowRight: { type: 'pan', dx: 30 }, ArrowUp: { type: 'pan', dy: -30 }, ArrowDown: { type: 'pan', dy: 30 } };
    if (actions[event.key]) { event.preventDefault(); dispatch(actions[event.key]); }
  } });
  atlasView = createAtlasView({ onSelect: id => selectStructure(id) });
  atlasView.element.id = 'anatomy-diagram';
  refs.mount.append(atlasView.element);
  refs.zoomOutput = $('output', { class: 'zoom-output', 'aria-live': 'off' });
  const cameraButton = (symbol, action, titleKey, reducerAction) => button(symbol, { 'data-action': action, 'data-title-key': titleKey }, () => dispatch(reducerAction));
  const zoomTools = $('div', { class: 'zoom-tools' }, cameraButton('−', 'zoom-out', 'zoomOut', { type: 'zoom', delta: -.25 }), refs.zoomOutput, cameraButton('+', 'zoom-in', 'zoomIn', { type: 'zoom', delta: .25 }), localized('button', 'reset', { type: 'button', 'data-action': 'reset-view', onclick: () => dispatch({ type: 'reset-view' }) }));
  const panTools = $('div', { class: 'pan-tools' }, cameraButton('←', 'pan-left', 'panLeft', { type: 'pan', dx: -30 }), cameraButton('↑', 'pan-up', 'panUp', { type: 'pan', dy: -30 }), cameraButton('↓', 'pan-down', 'panDown', { type: 'pan', dy: 30 }), cameraButton('→', 'pan-right', 'panRight', { type: 'pan', dx: 30 }));
  const viewer = $('section', { class: 'viewer-panel', 'aria-label': copy('diagram') }, $('div', { class: 'viewer-heading' }, $('div', {}, refs.diagramTitle, refs.viewCaption), refs.viewIndex), refs.mount, localized('p', 'keyboard', { class: 'sr-only', id: 'diagram-keyboard' }), localized('p', 'caption', { class: 'viewer-caption' }), $('div', { class: 'view-tools' }, zoomTools, panTools));
  refs.viewer = viewer;
  refs.detail = $('section', { class: 'panel detail-panel', id: 'structure-detail', 'aria-labelledby': 'structure-name' });
  refs.detailIndex = $('p', { class: 'structure-index' }); refs.detailTitle = $('h2', { id: 'structure-name' }); refs.detailIntro = $('p', { class: 'detail-intro' });
  refs.function = $('dd'); refs.location = $('dd'); refs.uncertainty = $('p');
  refs.reveal = localized('button', 'reveal', { type: 'button', hidden: true, onclick: () => {
    const current = FOUNDATION.structures.find(s => s.id === state.selectedId);
    for (const layer of current?.systems || []) if (!state.layers[layer]) state = reduceAtlasState(state, { type: 'toggle-layer', layer });
    sync();
  } });
  refs.structureSources = $('ul', { class: 'section-source-list' });
  refs.lessonText = $('p'); refs.lessonStatus = $('output', { id: 'lesson-status' });
  const lessonMove = delta => {
    state = reduceAtlasState(state, { type: delta > 0 ? 'lesson-next' : 'lesson-prev' });
    if (!state.layers.organs) state = reduceAtlasState(state, { type: 'toggle-layer', layer: 'organs' });
    state = reduceAtlasState(state, { type: 'search', query: '' });
    state = reduceAtlasState(state, { type: 'reset-view' });
    if (state.lessonIndex === 2) state = reduceAtlasState(state, { type: 'set-view', value: 'back' });
    selectStructure(['heart', 'lungs', 'kidneys'][state.lessonIndex]);
  };
  const lesson = $('div', { class: 'lesson' }, localized('h3', 'lesson', { class: 'panel-heading' }), refs.lessonText, $('div', { class: 'lesson-nav' }, localized('button', 'previous', { type: 'button', id: 'lesson-prev', onclick: () => lessonMove(-1) }), refs.lessonStatus, localized('button', 'next', { type: 'button', id: 'lesson-next', onclick: () => lessonMove(1) })));
  refs.detail.append(refs.detailIndex, refs.detailTitle, refs.detailIntro, refs.reveal, $('dl', {}, $('div', {}, localized('dt', 'function'), refs.function), $('div', {}, localized('dt', 'location'), refs.location)), $('div', { class: 'review-note', 'data-review': 'NOT_REVIEWED' }, localized('p', 'review'), refs.uncertainty), localized('button', 'sourceCount', { type: 'button', class: 'source-link-button', onclick: () => setSources(true, true) }), refs.structureSources, lesson);
  refs.sourcesHeading = localized('h2', 'sources', { tabindex: '-1' });
  refs.sourceNotices = $('div', { class: 'source-notices', 'data-review': 'NOT_REVIEWED' });
  refs.sourceList = $('ul', { class: 'sources-list' }); refs.laterList = $('ul', { class: 'later-list' });
  refs.sources = $('section', { class: 'sources-panel', id: 'sources-panel', hidden: true, onkeydown: event => { if (event.key === 'Escape') { event.preventDefault(); setSources(false, true); } } }, $('div', { class: 'sources-head' }, refs.sourcesHeading, localized('button', 'close', { type: 'button', id: 'sources-close', onclick: () => setSources(false, true) })), refs.sourceNotices, localized('p', 'sourced', { class: 'quiet-description' }), refs.sourceList, localized('h3', 'later'), refs.laterList);
  refs.offline = $('span', { id: 'offline-status', class: 'offline-status', role: 'status', 'aria-live': 'polite', 'data-state': 'installing' });
  refs.offlineRetry = localized('button', 'retry', { type: 'button', hidden: true, onclick: () => setupOffline() });
  refs.scope = $('p', { id: 'scope-note', class: 'quiet-description' });
  refs.announcement = $('p', { class: 'sr-only', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' });
  root.append(header, educational, $('div', { class: 'atlas-grid' }, controls, viewer, refs.detail, library), refs.scope, refs.sources, $('footer', { class: 'atlas-footer' }, $('p', {}, refs.offline, refs.offlineRetry), localized('p', 'privacy')), refs.announcement);
}

let sourcesLocale = '';
let detailId = '';
function sync() {
  document.documentElement.lang = state.locale;
  document.title = `${text(FOUNDATION.title)} · ${copy('edition')}`;
  Object.assign(root.dataset, { locale: state.locale, selected: state.selectedId || '', zoom: String(state.zoom), variant: state.variant, view: state.view });
  for (const [node, key] of uiTextNodes) node.textContent = copy(key);
  refs.title.textContent = text(FOUNDATION.title).replace(/^TarikLab\s+/, '');
  refs.education.textContent = notice('education'); refs.draft.textContent = notice('draft'); refs.scope.textContent = notice('scope');
  for (const field of ['locale', 'variant', 'view']) for (const node of root.querySelectorAll(`button[data-${field}]`)) node.setAttribute('aria-pressed', String(node.dataset[field] === state[field]));
  for (const system of FOUNDATION.systems) {
    root.querySelector(`[data-layer="${system.id}"]`).checked = state.layers[system.id];
    root.querySelector(`[data-layer-label="${system.id}"]`).textContent = text(system.label);
  }
  refs.search.placeholder = copy('placeholder');
  if (refs.search.value !== state.query) refs.search.value = state.query;
  const visible = visibleStructures(state, FOUNDATION.structures);
  refs.count.textContent = `${visible.length} / ${FOUNDATION.structures.length} ${copy('structures')}`;
  const activeId = document.activeElement?.dataset?.structure;
  refs.list.replaceChildren(...visible.map(structure => button(text(structure.label), { 'data-structure': structure.id, 'aria-pressed': String(structure.id === state.selectedId) }, () => selectStructure(structure.id))));
  if (activeId) refs.list.querySelector(`[data-structure="${activeId}"]`)?.focus({ preventScroll: true });
  refs.empty.hidden = visible.length !== 0;
  refs.viewCaption.textContent = `${copy(state.variant)} · ${copy(state.view)}`;
  refs.viewIndex.textContent = `${state.view === 'front' ? '01' : '02'} / 02`;
  refs.mount.setAttribute('aria-label', copy('diagram'));
  refs.viewer.setAttribute('aria-label', copy('diagram'));
  refs.languages.setAttribute('aria-label', copy('language'));
  refs.zoomOutput.textContent = `${Math.round(state.zoom * 100)}%`;
  for (const node of root.querySelectorAll('[data-title-key]')) { node.title = copy(node.dataset.titleKey); node.setAttribute('aria-label', node.title); }
  root.querySelector('[data-action="zoom-in"]').disabled = state.zoom >= 3;
  root.querySelector('[data-action="zoom-out"]').disabled = state.zoom <= 1;
  for (const node of root.querySelectorAll('[data-action^="pan-"]')) node.disabled = state.zoom <= 1;
  atlasView.update(state);
  const structure = FOUNDATION.structures.find(s => s.id === state.selectedId) || FOUNDATION.structures[0];
  refs.detailIndex.textContent = `${String(FOUNDATION.structures.indexOf(structure) + 1).padStart(2, '0')} / ${String(FOUNDATION.structures.length).padStart(2, '0')}`;
  refs.detailTitle.textContent = text(structure.label); refs.detailIntro.textContent = text(structure.description);
  refs.function.textContent = text(structure.function); refs.location.textContent = text(structure.location); refs.uncertainty.textContent = text(structure.uncertainty);
  refs.reveal.hidden = structure.systems.some(layer => state.layers[layer]);
  if (detailId !== `${structure.id}:${state.locale}`) {
    detailId = `${structure.id}:${state.locale}`;
    refs.structureSources.replaceChildren(...structure.sourceRefs.map(id => {
      const source = FOUNDATION.sources.find(s => s.id === id);
      return $('li', {}, $('a', { href: source.url, target: '_blank', rel: 'noopener noreferrer' }, source.title));
    }));
  }
  refs.lessonText.textContent = copy(`lesson${state.lessonIndex}`); refs.lessonStatus.textContent = `${state.lessonIndex + 1} / 3`;
  root.querySelector('#lesson-prev').disabled = state.lessonIndex === 0; root.querySelector('#lesson-next').disabled = state.lessonIndex === 2;
  refs.sourceToggle.setAttribute('aria-expanded', String(state.sourceOpen)); refs.sources.hidden = !state.sourceOpen;
  if (sourcesLocale !== state.locale) {
    sourcesLocale = state.locale;
    refs.sourceNotices.replaceChildren(...['education', 'draft', 'accuracy', 'variation', 'scope', 'polishReview'].map(key => $('p', {}, notice(key))), $('p', {}, copy('owner')));
    refs.sourceList.replaceChildren(...FOUNDATION.sources.map(source => $('li', { 'data-source-id': source.id }, $('a', { href: source.url, target: '_blank', rel: 'noopener noreferrer' }, source.title), $('p', {}, text(source.claim)), $('p', {}, `${copy('sourceDate')}: ${source.sourceDate || copy('unknownDate')} · ${copy('accessed')}: ${source.accessedAt}`), $('p', {}, copy('review')))));
    refs.laterList.replaceChildren(...FOUNDATION.later.map(item => $('li', {}, text(item.label))));
  }
  refs.offline.dataset.state = offlineState.state; refs.offline.dataset.version = offlineState.version;
  refs.offline.textContent = copy({ installing: 'offlineInstalling', ready: 'offlineReady', unavailable: 'offlineUnavailable', error: 'offlineError' }[offlineState.state]);
  refs.offlineRetry.hidden = offlineState.state !== 'error';
  root.dataset.ready = 'true';
}

function activated(registration) {
  if (registration.active?.state === 'activated') return Promise.resolve(registration.active);
  const worker = registration.installing || registration.waiting || registration.active;
  if (!worker) return Promise.reject(new Error('No atlas worker'));
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { cleanup(); reject(new Error('Atlas installation incomplete')); }, 25000);
    const cleanup = () => { clearTimeout(timeout); worker.removeEventListener('statechange', changed); };
    const changed = () => { if (worker.state === 'activated') { cleanup(); resolve(worker); } else if (worker.state === 'redundant') { cleanup(); reject(new Error('Atlas installation failed')); } };
    worker.addEventListener('statechange', changed); changed();
  });
}
async function setupOffline() {
  if (offlineBusy) return;
  if (!('serviceWorker' in navigator)) { offlineState = { state: 'unavailable', version: '' }; sync(); return; }
  offlineBusy = true; offlineState = { state: 'installing', version: '' }; sync();
  try {
    const registration = await navigator.serviceWorker.register('./sw.js', { scope: './', updateViaCache: 'none' });
    const worker = await activated(registration);
    // ready can refer to the portal's root worker. Only our scoped controller
    // makes a future Atlas navigation eligible for this verified package.
    const ownsPage = () => navigator.serviceWorker.controller && new URL(navigator.serviceWorker.controller.scriptURL).pathname === '/atlas/yapi/sw.js';
    if (!ownsPage()) await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => { cleanup(); reject(new Error('Atlas controller unavailable')); }, 5000);
      const cleanup = () => { clearTimeout(timeout); navigator.serviceWorker.removeEventListener('controllerchange', changed); };
      const changed = () => { if (ownsPage()) { cleanup(); resolve(); } };
      navigator.serviceWorker.addEventListener('controllerchange', changed); changed();
    });
    const status = await new Promise((resolve, reject) => {
      const channel = new MessageChannel();
      const timeout = setTimeout(() => { channel.port1.close(); reject(new Error('Atlas package status unavailable')); }, 5000);
      channel.port1.onmessage = event => { clearTimeout(timeout); channel.port1.close(); resolve(event.data); };
      worker.postMessage({ type: 'GET_ATLAS_STATUS' }, [channel.port2]);
    });
    if (status.type !== 'ATLAS_OFFLINE_STATUS' || !status.ready || !status.version || !status.files?.length) throw new Error('Atlas package incomplete');
    offlineState = { state: 'ready', version: status.version };
  } catch { offlineState = { state: 'error', version: '' }; }
  finally { offlineBusy = false; sync(); }
}

try {
  const validation = validateFoundation(FOUNDATION);
  if (!validation.valid) throw new Error('Invalid learning content');
  buildShell(); sync();
  requestAnimationFrame(() => setupOffline());
  window.addEventListener('hashchange', () => { const id = hashSelection(); if (id) selectStructure(id, false); else if (location.hash === '#sources') setSources(true, true); });
  window.addEventListener('pagehide', event => { if (!event.persisted) atlasView.destroy(); });
} catch {
  root.replaceChildren($('section', { class: 'error-note', role: 'alert' }, $('h1', {}, 'TarikLab'), $('p', {}, copy('productError')), $('a', { href: '/' }, 'TarikLab')));
  root.dataset.ready = 'error';
}
