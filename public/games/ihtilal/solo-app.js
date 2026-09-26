import {
  REGIONS, MOVES, applyMove, createSolo, deserializeSolo, legalMoves, previewMove,
  selectRegion, serializeSolo, SOLO_KEY, chooseRoute, setConnection, periodForecast,
} from "./solo.js";
import {neighbours, targetFor, FIELDS, spillRisk, basinReady} from "./basin-network.js";
import {createBasinMap, basinRenderModel} from "./basin-map.js";

const root = document.querySelector("#app");
const reader = () => {
  try { return localStorage.getItem("tariklab.language") || "tr"; }
  catch { return "tr"; }
};
// Content language: Polish readers get the Polish interface below and English
// everywhere else, never Turkish.
const lang = () => (reader() === "en" || reader() === "pl" ? "en" : "tr");

const COPY = {
  tr: {
    kicker: "Tek masa",
    title: "İHTİLÂL",
    pitch: "Tek kişilik masa. Havzaların yükü, güven, bilgi ve gerilim birbirine bağlıdır. Rakip koltuk yoktur.",
    note: "Bu çalışma haritası idari havzadır. Resmî sınır, gerçek kişi veya kurum kaydı değildir.",
    open: "Dosyayı aç",
    period: "Dönem",
    cap: "Kapasite",
    trust: "Güven",
    intel: "Bilgi",
    tension: "Gerilim",
    map: "Havza haritası",
    moves: "Karar",
    tut: "Tut",
    ac: "Aç",
    sustur: "Sustur",
    devret: "Devret",
    kapat: "Dönemi kapat",
    sert: "Sert tut",
    acik: "Açık tut",
    break: "Kırılma. Bu dönem ya baskıyı sıkarsın ya da kaydı açarsın. İkisi de bedelsiz değildir.",
    outcome: "Sonuç",
    delayed: "Sonraki döneme taşınır",
    now: "şimdi",
    file: "Neden bu masa",
    fileBody: "Eski iki kalemli dosya masası bu sayfanın oyunu değildir. Karar tek kişidedir: kısa rahatlama ile gecikmiş yük arasında.",
    again: "Yeni dosya",
    endings: {
      tutanak: "Tutanak kaldı. Güven ve gerilim aynı anda taşınabildi.",
      yorgun: "Yorgun düzen. Masa kapandı; ne güven ne gerilim çözüldü.",
      kirilma: "Kırılma. Gerilim havzayı taşıdı.",
      bosluk: "Boşluk. Masa duruyor, güven kalmadı.",
    },
    hints: {
      tut: "Seçili havzanın yükünü şimdi indirir. Yüksek yük ertesi dönem gerilim olarak döner.",
      ac: "Bilgi artar, güven düşer. Açılan kayıt ertesi dönem gerilimi büyütür.",
      sustur: "Gerilim iner, bilgi eksilir. İki dönem sonra bilgi açığı gelir.",
      devret: "Seçili komşuya kapasite gönder. Burada yük artar; oradaki rahatlama yol bitince gelir.",
      kapat: "Bekleyen etkiler işler, kapasite yenilenir. Kullanılmayan masa kararları devretmez.",
      sert: "Gerilim düşer, güven de düşer.",
      acik: "Güven ve bilgi artar, gerilim de artar.",
    },
  },
  en: {
    kicker: "One desk",
    title: "İHTİLÂL",
    pitch: "A one-seat desk. Basin load, trust, information and tension are tied together. There is no opposing chair.",
    note: "This working map is an administrative basin chart. It is not an official border, a real person, or an institutional record.",
    open: "Open the file",
    period: "Period",
    cap: "Capacity",
    trust: "Trust",
    intel: "Information",
    tension: "Tension",
    map: "Basin map",
    moves: "Decision",
    tut: "Hold",
    ac: "Open",
    sustur: "Quiet",
    devret: "Shift",
    kapat: "Close the period",
    sert: "Hold hard",
    acik: "Hold open",
    break: "Fracture. This period you either tighten pressure or open the record. Neither is free.",
    outcome: "Outcome",
    delayed: "Carries into a later period",
    now: "now",
    file: "Why this desk",
    fileBody: "The old two-pen file board is not this page. The decision sits with one person: short relief against a delayed load.",
    again: "New file",
    endings: {
      tutanak: "The record held. Trust and tension were carried together.",
      yorgun: "A tired order. The desk closed with neither trust nor tension settled.",
      kirilma: "Fracture. Tension carried the basin.",
      bosluk: "A hollow desk. It still stands, and trust is gone.",
    },
    hints: {
      tut: "Lowers the selected basin now. A high load returns next period as tension.",
      ac: "Information rises, trust falls. The opened record grows tension next period.",
      sustur: "Tension falls, information thins. An information gap arrives two periods later.",
      devret: "Send capacity to the chosen neighbour. Load rises here; relief arrives there after travel.",
      kapat: "Waiting effects resolve and capacity refills. Unused desk decisions are forfeited.",
      sert: "Tension falls, and so does trust.",
      acik: "Trust and information rise, and so does tension.",
    },
  },
};

// Polish interface labels; hints, endings and region names stay English.
const PL = {
  kicker: "Jedno biurko",
  pitch: "Biurko dla jednej osoby. Obciążenie dorzeczy, zaufanie, informacja i napięcie są ze sobą powiązane. Nie ma przeciwnego krzesła.",
  note: "Ta robocza mapa to schemat dorzeczy administracyjnych. Nie jest oficjalną granicą, prawdziwą osobą ani zapisem instytucji.",
  open: "Otwórz akta",
  period: "Okres",
  cap: "Zdolność",
  trust: "Zaufanie",
  intel: "Informacja",
  tension: "Napięcie",
  map: "Mapa dorzeczy",
  moves: "Decyzja",
  tut: "Trzymaj",
  ac: "Otwórz",
  sustur: "Wycisz",
  devret: "Przenieś",
  kapat: "Zamknij okres",
  sert: "Trzymaj twardo",
  acik: "Trzymaj otwarcie",
  outcome: "Wynik",
  delayed: "Przechodzi na późniejszy okres",
  now: "teraz",
  file: "Dlaczego to biurko",
  again: "Nowe akta",
};
const t = () => (reader() === "pl" ? { ...COPY.en, ...PL } : COPY[lang()] || COPY.tr);
const UI={
  tr:{objective:'6. dönem hedefi: güven ≥46, bilgi ≥25, gerilim <48 ve en az 5 dayanabilen havza.',ready:'Dayanabilen havza',load:'Yük',localCap:'Havza kapasitesi',orders:'Masa kararı',local:'Seçili havza',plan:'Plan izi',
    mapHint:'Havza seç · sayı seçili katmanı gösterir. ! taşma eşiği. Hat rozeti: etki sayısı · ilk varış dönemi; boş hat: yol süresi.',
    route:'Komşu hattı',open:'Açık hat',buffered:'Süzülen hat',filter:'Hattı süz',unfilter:'Hattı aç',
    routeHint:'Açık hat hızlı ve güçlüdür. Süzme gerilimi azaltır; bilgiyi yarılar, yolu 1 dönem uzatır. Yola çıkmış etkiler değişmez.',
    cost:'1 masa kararı',close:'Son karar dönemi de kapatır.',arrivals:'Yoldaki etkiler',none:'Şimdilik yolda etki yok.',
    forecast:'Kapanış provası',forecastHint:'Başka hamle yapmadan kapatırsan. Sonraki kararlar ve alıcı havzanın durumu sonucu değiştirebilir.',
    due:'varış',period:'D',legacy:'Eski kararın yankısı',closeAt:'kapanışı',
    rule:'Yük en az 55 ve gerilim en az 38 ya da kapasite 35’in altındaysa, kapanış komşulara yeni baskı yollar.',
    risk:'Taşma eşiğinde',calm:'Şimdilik taşma yok',now:'Yerel etki',later:'Komşulara',next:'İkinci halkaya güç kaybederek yayılabilir; kapasite çoğalmaz.',
    breakAhead:'4. dönem eşiği: önce gelen etkiler işlenecek, sonra ortak yaklaşımı seçeceksin.',
    breakNow:'Eşik kararı: süzerek tutmak gelen bilgi ve gerilimi azaltır; açık tutmak ikisini de güçlendirir.',
    saved:'Kaydedildi',saveFail:'Kalıcı kayıt yapılamadı. Oyun bu sekmede sürüyor; kapatmadan yeniden kaydet.',save:'Yeniden kaydet',
    recovered:'Son sağlam yedek açıldı.',invalid:'Kayıt okunamadı; önceki dosya bu ekranda otomatik silinmez.',
    back:'Dosya menüsü',original:'Tamamen kurgusal, tek kişilik yedi havza. Ses ve çevrimiçi rakip yok.',
    svg:'Hafif harita',current:'Bu dönem gelenler',endChains:'Sonucu kuran bağlantılar',unresolved:'Dosya kapandığında hâlâ yolda',
    noArrival:'Henüz bağlantı üzerinden varan etki yok.', capacityShort:'Bu hamle için havza kapasitesi yetersiz.',
    after:'Dönem kapanışı dahil',riskLabel:'Baskı',doctrine:'Ortak yaklaşım',balanced:'Dengeli',buffer:'Süzerek tut',listen:'Açık tut',
  },
  en:{objective:'Period 6 goal: trust ≥46, information ≥25, tension <48 and at least 5 resilient basins.',ready:'Resilient basins',load:'Load',localCap:'Basin capacity',orders:'Desk decisions',local:'Selected basin',plan:'Plan trace',
    mapHint:'Select a basin · number shows this layer. ! spill threshold. Route badge: effect count · first arrival period; empty route: travel time.',
    route:'Neighbour route',open:'Open route',buffered:'Filtered route',filter:'Filter route',unfilter:'Open route',
    routeHint:'Open routes are fast and strong. Filtering reduces tension, halves information and adds 1 period. Effects already dispatched keep their route.',
    cost:'1 desk decision',close:'The final decision also closes the period.',arrivals:'Effects in transit',none:'No effects in transit yet.',
    forecast:'Closing rehearsal',forecastHint:'If you close without another decision. Further choices and the receiving basin can change the outcome.',
    due:'arrival',period:'P',legacy:'Earlier decision echo',closeAt:'closing',
    rule:'At load 55 or more, combined with tension 38 or more or capacity below 35, closing sends new pressure to neighbours.',
    risk:'At spill threshold',calm:'Below spill threshold',now:'Local change',later:'To neighbours',next:'Can spread to a second ring at reduced strength; capacity never duplicates.',
    breakAhead:'Period 4 threshold: incoming effects resolve before you choose a shared approach.',
    breakNow:'Threshold choice: filtering reduces incoming information and tension; openness strengthens both.',
    saved:'Saved',saveFail:'Could not persist the save. Play continues in this tab; retry saving before closing.',save:'Retry save',
    recovered:'Last valid backup restored.',invalid:'Save could not be read; this screen does not automatically erase the earlier file.',
    back:'File menu',original:'Seven entirely fictional basins, one player. No sound or online opponent.',
    svg:'Lightweight map',current:'Arrivals this period',endChains:'Connections behind the outcome',unresolved:'Still in transit when the file closed',
    noArrival:'No effects have arrived through a route yet.',capacityShort:'Insufficient basin capacity for this move.',
    after:'Includes period closing',riskLabel:'Pressure',doctrine:'Shared approach',balanced:'Balanced',buffer:'Hold filtered',listen:'Hold open',
  },
};
const u=()=>UI[lang()];
let screen='menu', state=null, last=null, map=null, layer='strain', planned='tut', saveError=false, notice='';
const $=(tag,attrs={},...kids)=>{
  const el=document.createElement(tag);
  for(const [k,v] of Object.entries(attrs)) {
    if(k==='class')el.className=v;
    else if(k.startsWith('on')&&typeof v==='function')el.addEventListener(k.slice(2),v);
    else if(v!=null&&v!==false)el.setAttribute(k,v===true?'':String(v));
  }
  for(const kid of kids.flat())if(kid!=null)el.append(kid instanceof Node?kid:document.createTextNode(String(kid)));
  return el;
};
const name=id=>REGIONS.find(r=>r.id===id)?.[lang()]||id;
const sign=n=>n>0?`+${n}`:String(n);
const labels=()=>({strain:u().load,capacity:u().localCap,intel:t().intel,trust:t().trust,tension:t().tension});
const changes=d=>FIELDS.filter(k=>d[k]).map(k=>`${labels()[k]} ${sign(d[k])}`).join(' · ')||'—';
const BACKUP=SOLO_KEY+'.backup';
const folds=new Map();
function readSaved() {
  try {
    const raw=localStorage.getItem(SOLO_KEY),saved=deserializeSolo(raw);
    if(saved)return saved;
    const backup=deserializeSolo(localStorage.getItem(BACKUP));
    if(backup){notice=u().recovered;return backup;}
    if(raw)notice=u().invalid;
  } catch {saveError=true;}
  return null;
}
function persist() {
  if(!state)return false;
  try {
    const previous=localStorage.getItem(SOLO_KEY),raw=serializeSolo(state);
    if(previous!==raw&&deserializeSolo(previous))localStorage.setItem(BACKUP,previous);
    localStorage.setItem(SOLO_KEY,raw);saveError=false;return true;
  } catch {saveError=true;return false;}
}
function play(id) {
  const preview=previewMove(state,id);
  if(!preview.ok)return;
  const from=state.selected;
  state=applyMove(state,id);last={id,preview,from};
  if(state.phase==='end')screen='report';
  persist();render();
}
function updateMap() {
  if(!map||!state)return;
  map.update(basinRenderModel(state,{layer,lang:lang(),plan:previewMove(state,planned)}));
  const caption=document.querySelector('#map-plan-label');if(caption)caption.textContent=`${u().plan}: ${t()[planned]||t().moves}`;
}
function select(id,{keyboard=false}={}) {state=selectRegion(state,id);persist();render();if(!keyboard&&window.matchMedia('(max-width:899px)').matches)root.querySelector('.basin-inspector')?.scrollIntoView({block:'start'});}
function meters() {
  const c=t(),q=u();
  return $('div',{class:'solo-meters'},...[[c.period,`${Math.min(state.period,6)} / 6`],[q.orders,state.capacity],[c.trust,state.trust],[c.intel,state.intel],[c.tension,state.tension]]
    .map(([key,value])=>$('div',{},$('span',{},key),$('b',{},value))));
}
function wavesList(pulses) {
  const rows=new Map();
  for(const p of pulses) {
    const key=`${p.from}:${p.to}:${p.due}:${p.kind}`;
    if(!rows.has(key))rows.set(key,{...p,delta:{},count:0});
    const row=rows.get(key);row.count++;
    for(const field of FIELDS)row.delta[field]=(row.delta[field]||0)+(p.delivered?.[field]??p.delta[field]??0);
  }
  return $('ul',{class:'wave-list'},...[...rows.values()].slice(0,12).map(p=>$('li',{},
    $('strong',{},`${name(p.from)} → ${name(p.to)}`),
    $('span',{},`${u().period}${p.arrived||p.due} · ${p.kind==='pressure'?u().riskLabel:t()[p.kind]}${p.count>1?` ×${p.count}`:''}`),
    $('small',{},changes(p.delta))
  )),rows.size>12?$('li',{},`+${rows.size-12}`):null);
}
function networkPanel() {
  const q=u(),here=state.regions.find(r=>r.id===state.selected),target=targetFor(state),routes=neighbours(state,state.selected);
  const chosen=routes.find(r=>r.other===target),mode=chosen.mode,nextMode=mode==='open'?'buffered':'open';
  return $('section',{class:'basin-inspector','aria-label':q.local},
    $('div',{class:'basin-heading'},$('div',{},$('span',{class:'solo-kicker'},q.local),$('h2',{tabindex:-1,'data-focus-key':'basin-heading'},name(here.id))),
      $('span',{class:`risk-tag${spillRisk(here)?' warning':''}`},spillRisk(here)?`! ${q.risk}`:q.calm)),
    $('dl',{class:'basin-stats'},...FIELDS.map(k=>$('div',{},$('dt',{},labels()[k]),$('dd',{},here[k])))),
    $('details',{class:'route-fold','data-fold':'route'},$('summary',{},`${q.route}: ${name(target)} · ${chosen.travel} ${q.period}`),
      $('label',{},q.route,$('select',{'data-focus-key':'route-target','aria-label':q.route,onchange:ev=>{state=chooseRoute(state,ev.target.value);persist();render();}},
        ...routes.map(r=>$('option',{value:r.other,selected:r.other===target},`${name(r.other)} · ${r.travel} ${q.period}`)))),
      $('p',{class:'muted'},q.routeHint),
      $('button',{class:'route-control',type:'button','data-connection':nextMode,'data-focus-key':'route-mode',disabled:state.phase!=='play'||state.capacity<1,
        onclick:()=>{const before=state;state=setConnection(state,nextMode);if(state===before)return;last={route:true,id:nextMode};persist();render();}},
        mode==='open'?q.filter:q.unfilter,` · ${q.cost}${state.capacity===1?` · ${q.close}`:''}`)),
    $('details',{class:'rule-fold','data-fold':'rule'},$('summary',{},q.riskLabel),$('p',{},q.rule),$('p',{class:'muted'},lang()==='tr'?'Bilgi her kapanışta 2 azalır; yük 60 ve üzerindeyse 3. Haber akışı kesilen havza zamanla körleşir.':'Information fades by 2 each closing, or 3 at load 60+. A basin cut off from reports gradually loses sight.'),$('p',{},lang()==='tr'?'Dayanabilen havza: yük ve gerilim 65 altı; kapasite en az 20, güven 30, bilgi 25.':'Resilient basin: load and tension below 65; capacity at least 20, trust 30 and information 25.')),
  );
}
function moveButton(id) {
  const c=t(),q=u(),preview=previewMove(state,id),local=preview.regional?.find(r=>r.id===state.selected)?.delta;
  return $('button',{class:'act',type:'button','data-move':id,'data-focus-key':`move-${id}`,onclick:()=>play(id),
    onfocus:()=>{planned=id;updateMap();},onpointerenter:()=>{planned=id;updateMap();}},
    $('span',{class:'move-heading'},$('b',{},c[id]),$('small',{},['kapat','sert','acik'].includes(id)?'':q.cost)),
    $('span',{},c.hints[id]),
    local?$('span',{class:'local-change'},`${q.now}: ${changes(local)}`):null,
    $('span',{class:'cost-line'},`${c.trust} ${sign(preview.trust)} · ${c.tension} ${sign(preview.tension)} · ${c.intel} ${sign(preview.intel)}`),
    preview.waves?.length?$('small',{class:'move-wave'},`${q.later}: ${[...new Set(preview.waves.filter(p=>p.hop===1).map(p=>`${name(p.to)} ${q.period}${p.due}`))].join(' · ')}`):null,
    preview.autoClose?$('strong',{class:'closing-note'},q.after):null,
  );
}
function forecastPanel() {
  const f=periodForecast(state),c=t(),q=u();
  if(!f)return null;
  const local=f.regions.find(r=>r.id===state.selected),here=state.regions.find(r=>r.id===state.selected);
  return $('details',{class:'forecast','data-fold':'forecast',open:window.matchMedia('(min-width:900px)').matches},$('summary',{},`${q.forecast} · ${q.period}${Math.min(f.period,6)}${f.phase==='end'?` · ${c.outcome}`:''}`),
    $('p',{class:'forecast-values'},`${c.trust} ${sign(f.trust-state.trust)} · ${c.intel} ${sign(f.intel-state.intel)} · ${c.tension} ${sign(f.tension-state.tension)}`),
    $('p',{},`${name(state.selected)}: ${changes(Object.fromEntries(FIELDS.map(k=>[k,local[k]-here[k]])))}`),
    f.phase==='break'?$('p',{class:'threshold-note'},q.breakAhead):null,
    f.ending?$('p',{class:'threshold-note'},c.endings[f.ending]):null,
    $('small',{},q.forecastHint),
  );
}
function transitPanel() {
  const q=u();
  return $('section',{class:'transit'},$('h2',{},`${q.arrivals} · ${state.network.pulses.length}`),
    state.network.pulses.length?wavesList([...state.network.pulses].sort((a,b)=>a.due-b.due||a.id-b.id)): $('p',{class:'muted'},q.none),
    state.network.pulses.length?$('p',{class:'muted'},q.next):null,
    state.pending.length?$('details',{},$('summary',{},`${q.legacy} · ${state.pending.length}`),
      $('ul',{},...state.pending.map(p=>$('li',{},`${q.period}${p.due} ${q.closeAt}: ${changes({...p,strain:p.strain||0})}`)))):null,
    state.network.last.length?$('details',{},$('summary',{},`${q.current} · ${state.network.last.length}`),wavesList(state.network.last)):null,
  );
}
function feedback() {
  const q=u(),c=t();
  return $('p',{class:'outcome inline-outcome',role:'status'},last.route?`${q.route}: ${q[last.id]}. ${q.cost}.`:
    `${c[last.id]} · ${name(last.from)}. ${c.outcome}: ${c.trust} ${state.trust}, ${c.tension} ${state.tension}, ${c.intel} ${state.intel}.${last.preview.autoClose?' '+q.after:''}`);
}
function render() {
  const focusKey=document.activeElement?.getAttribute?.('data-focus-key'),scroll=window.scrollY;
  document.documentElement.lang=reader()==='pl'?'pl':lang();
  const c=t(),q=u();
  for(const detail of root.querySelectorAll('details[data-fold]'))folds.set(detail.dataset.fold,detail.open);
  root.replaceChildren();
  const bar=$('header',{class:'solo-bar'},$('span',{class:'solo-kicker'},'İHTİLÂL · '+c.kicker),
    $('button',{class:'link',type:'button','aria-label':q.back,'data-focus-key':'menu',onclick:()=>{screen='menu';map?.destroy();map=null;render();window.scrollTo(0,0);}},'←'));
  if(screen==='menu') {
    map?.destroy();map=null;
    root.append($('div',{class:'solo'},bar,$('main',{class:'solo-main'},$('p',{class:'solo-kicker'},c.kicker),$('h1',{},c.title),
      $('p',{class:'pitch'},c.pitch),$('p',{class:'menu-brief'},c.note),
      $('button',{class:'primary',type:'button','data-focus-key':'open',onclick:()=>{
        state=state||readSaved()||createSolo(Date.now()%100000);screen=state.phase==='end'?'report':'play';last=null;persist();render();window.scrollTo(0,0);
      }},c.open),$('p',{class:'muted'},q.original))));return;
  }
  const body=[meters(),$('p',{class:'objective'},q.objective),$('p',{class:'save-status',role:'status'},saveError?q.saveFail:notice||q.saved)];
  if(saveError)body.push($('button',{class:'route-control',onclick:()=>{persist();render();}},q.save));
  if(state.phase!=='end') {
    if(!map)map=createBasinMap(select);
    updateMap();
    const surface=$('section',{class:'map-column','aria-label':c.map},
      $('div',{class:'map-title'},$('h2',{},c.map),$('button',{class:'link',type:'button','data-focus-key':'svg',onclick:()=>map.useSVG()},q.svg)),
      $('div',{class:'map-layers','aria-label':c.map},...FIELDS.map(k=>$('button',{type:'button','data-layer':k,'aria-pressed':layer===k,'data-focus-key':`layer-${k}`,onclick:()=>{layer=k;render();}},k==='capacity'?c.cap:labels()[k]))),
      map.element,$('p',{id:'map-plan-label',class:'plan-label'},`${q.plan}: ${c[planned]||c.moves}`),$('p',{class:'map-caption'},q.mapHint),forecastPanel());
    const moves=$('section',{class:'moves','aria-label':c.moves},$('h2',{tabindex:-1,'data-focus-key':'moves'},state.phase==='break'?c.break:c.moves),
      state.phase==='break'?$('p',{class:'threshold-note'},q.breakNow):null,
      ...legalMoves(state).map(moveButton),
      ...(state.phase==='play'?MOVES.filter(id=>!legalMoves(state).includes(id)).map(id=>$('button',{class:'act',disabled:true,type:'button'},
        $('b',{},c[id]),$('span',{},`${q.capacityShort} (${q.localCap}: ${state.regions.find(r=>r.id===state.selected).capacity} / ${{tut:6,ac:4,sustur:0,devret:12}[id]})`))):[]));
    body.push($('div',{class:'solo-play'},surface,$('div',{class:'decision-column'},networkPanel(),last?feedback():null,moves)));
    body.push(transitPanel());
  }
  if(state.phase==='end') {
    body.push($('section',{class:'report'},$('h2',{class:'report-verdict'},c.endings[state.ending]),
      $('p',{},`${c.period} ${Math.min(state.period,6)} · ${c.trust} ${state.trust} · ${c.tension} ${state.tension}`),
      $('p',{},`${q.ready}: ${state.regions.filter(basinReady).length} / 7 · ${c.intel}: ${state.intel}`),$('p',{class:'muted'},q.objective),
      $('h3',{},q.endChains),state.network.history.length?wavesList(state.network.history.slice(-10)):$('p',{},q.noArrival),
      $('p',{},`${q.unresolved}: ${state.network.pulses.length+state.pending.length} · ${q.doctrine}: ${q[state.network.doctrine]}`),
      $('button',{class:'primary',type:'button','data-focus-key':'new',onclick:()=>{state=createSolo((state.seed+1)>>>0);screen='play';last=null;notice='';planned='tut';persist();render();window.scrollTo(0,0);}},c.again)));
    map?.destroy();map=null;
  }
  body.push($('details',{class:'file-fold','data-fold':'file'},$('summary',{},c.file),$('p',{},q.original),$('p',{},c.fileBody)));
  root.append($('div',{class:'solo'},bar,$('main',{class:'solo-main'},...body)));
  for(const detail of root.querySelectorAll('details[data-fold]'))if(folds.has(detail.dataset.fold))detail.open=folds.get(detail.dataset.fold);
  if(focusKey) {
    const target=root.querySelector(`[data-focus-key="${focusKey}"]`)||root.querySelector('[data-focus-key="moves"]');
    target?.focus({preventScroll:true});
  }
  window.scrollTo(0,scroll);
}
window.addEventListener('pagehide',()=>{if(state)persist();map?.destroy();map=null;});
window.addEventListener('pageshow',event=>{if(event.persisted)render();});
window.addEventListener('storage',event=>{if(event.key==='tariklab.language')render();});
render();
