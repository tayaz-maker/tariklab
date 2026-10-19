// Bounded authored game procedure, not a statutory criminal-law simulator.
import {addMemory, addNpcMemory, adjustHealth} from './state.js?v=10';
import {applyRelationshipDelta} from './social.js?v=10';
const now = state => state.time.absoluteWeek;
function history(state) {
  const src=state.flags.criminalJustice;
  const records=(src?.version===1&&Array.isArray(src.records)?src.records:[]).filter(r=>r?.final===true&&r.outcome==='convicted'&&typeof r.sourceCaseId==='string'&&Number.isInteger(r.decidedWeek)&&r.decidedWeek>=1&&r.decidedWeek<=now(state)).slice(-32);
  const c=src?.custody;
  const valid=c&&typeof c.sourceCaseId==='string'&&records.some(r=>r.sourceCaseId===c.sourceCaseId)&&Number.isInteger(c.startWeek)&&c.startWeek<=now(state)&&Number.isInteger(c.untilWeek)&&c.untilWeek>c.startWeek&&c.untilWeek<=c.startWeek+4;
  return state.flags.criminalJustice={version:1,records,...(valid?{custody:{sourceCaseId:c.sourceCaseId,startWeek:c.startWeek,untilWeek:c.untilWeek}}:{})};
}
export function isServingCriminalSentence(state) {
  if(!state?.flags?.criminalJustice?.custody)return false;
  const c=history(state).custody;
  return Boolean(c&&now(state)<c.untilWeek);
}
export function processCriminalSentenceWeek(state) {
  if(!state.flags.criminalJustice?.custody)return '';
  const book=history(state),c=book.custody;
  if(!c||now(state)<c.untilWeek)return '';
  const record=book.records.find(r=>r.sourceCaseId===c.sourceCaseId);
  record.servedWeek=now(state);delete book.custody;
  const text='İnfaz tamamlandı. İş ve haftalık kararlar yeniden açıldı; kesin karar kaydı ve borçlar duruyor.';
  addMemory(state,text,'important');return text;
}
export function criminalRecords(state) { return history(state).records; }
export function criminalJobDelay(state) {
  return criminalRecords(state).some(r=>!r.reentryWeek&&now(state)-r.decidedWeek<26)?1:0;
}
export function markCriminalReentry(state) {
  let changed=false;
  for(const record of criminalRecords(state)) if(!record.reentryWeek){record.reentryWeek=now(state);changed=true;}
  if(changed)addMemory(state,'Yeni işe başladın. Geçmiş karar kaydı duruyor; işe dönüş gecikmesi sona erdi.','important');
}
export function openCriminalHearing(state, source) {
  if(source?.type!=='risk-dosya'||source.payload?.kind!=='kavga'||source.payload.justice||source.payload.fineEnforced)return false;
  source.payload.justice={version:1,stage:'investigation',evidence:{sourceCaseId:source.id,confirmedFight:true,capturedWeek:now(state)}};
  state.openCases.push({id:`criminal-hearing-${source.id}`,type:'criminal-hearing',createdWeek:now(state),dueWeek:now(state)+4,eventId:'criminal_hearing',status:'pending',payload:{sourceCaseId:source.id}});
  return true;
}
function sourceFor(state, child) {
  const source=state.openCases.find(c=>c.id===child?.payload?.sourceCaseId&&c.type==='risk-dosya'&&c.payload?.kind==='kavga');
  return source?.payload.justice?.version===1?source:null;
}
export function criminalChoiceAvailability(state, definition, choice, child) {
  if(child?.type!=='criminal-hearing'||child.eventId!==definition.id||child.dueWeek>now(state)||!['pending','triggered'].includes(child.status))return {ok:false,reason:'Bu duruşma için açık kaynak dosyası yok.'};
  const source=sourceFor(state,child),j=source?.payload.justice;
  const allowed=definition.id==='criminal_hearing'?j?.stage==='investigation':j?.stage==='review';
  return allowed?{ok:true}:{ok:false,reason:'Bu duruşma için açık kaynak dosyası yok.'};
}
export function resolveCriminalChoice(state, definition, choiceId, child) {
  if(!['criminal_hearing','criminal_verdict'].includes(definition.id))return false;
  if(!criminalChoiceAvailability(state,definition,null,child).ok)return false;
  const source=sourceFor(state,child),j=source.payload.justice;
  if(definition.id==='criminal_hearing') {
    if(!['accept','review'].includes(choiceId))return false;
    j.stage='review';j.reviewRequested=choiceId==='review';j.heardWeek=now(state);
    adjustHealth(state,{stress:choiceId==='review'?3:1});
    state.openCases.push({id:`criminal-verdict-${source.id}`,type:'criminal-hearing',createdWeek:now(state),dueWeek:now(state)+(j.reviewRequested?2:1),eventId:'criminal_verdict',status:'pending',payload:{sourceCaseId:source.id}});
    return true;
  }
  if(choiceId!=='acknowledge')return false;
  const evidence=j.evidence;
  const proven=evidence?.sourceCaseId===source.id&&evidence.confirmedFight===true&&Number.isInteger(evidence.capturedWeek)&&evidence.capturedWeek>=source.createdWeek&&evidence.capturedWeek<=j.heardWeek;
  j.stage=proven?'convicted':'cleared';j.final=true;j.decidedWeek=now(state);
  if(!proven){source.status='resolved';addMemory(state,'Kaynak delil doğrulanamadı. Mahkûmiyet ve yeni ceza talebi oluşmadı.','important');return true;}
  const records=criminalRecords(state);
  if(!records.some(r=>r.sourceCaseId===source.id)) {
    records.push({sourceCaseId:source.id,outcome:'convicted',final:true,decidedWeek:now(state),offence:'fight'});
    state.flags.criminalJustice.records=records.slice(-32);
    // Authored balance policy: a repeated proven fight has two game weeks of
    // custody. This is separate from the pre-verdict detention record.
    if(records.length>1) {
      const untilWeek=now(state)+2;
      state.flags.criminalJustice.custody={sourceCaseId:source.id,startWeek:now(state),untilWeek};
      records.at(-1).sentenceUntil=untilWeek;
      const pending=state.career?.pendingJob;
      const jobCase=state.openCases.find(c=>c.id===pending?.caseId&&c.eventId==='job_start'&&c.status!=='resolved');
      if(pending&&jobCase&&pending.startWeek<untilWeek){
        pending.startWeek=untilWeek;jobCase.dueWeek=untilWeek;jobCase.status='pending';
        state.events.queue=state.events.queue.filter(e=>e.eventId!=='job_start'||e.sourceCaseId!==jobCase.id);
      }
      addMemory(state,'Tekrarlanan kesin kavga kararı: iki oyun haftası infaz. Gözaltıdan ayrı; mevcut iş ve SGK durdurma kuralları uygulanır.','important');
    }
    const mother=state.people?.find(p=>p.id==='anne'&&!p.deceased);
    if(mother){applyRelationshipDelta(state,'anne',{trust:-4,tension:4});addNpcMemory(state,'anne','Kavga dosyasında kesin karar çıktı. Gözaltı kaydıyla aynı şey değil.','criminal-verdict');}
    addMemory(state,'Kavga dosyasında kaynak delile dayalı kesin karar çıktı. Ceza tahsilatı mevcut icra akışında; yeni iş başlangıcı bir hafta gecikebilir.','important');
  }
  return true;
}
export const CRIMINAL_EVENTS=[
 {id:'criminal_hearing',repeat:'repeatable',title:'Kavga dosyasında duruşma',text:'Bu sınırlı oyun sürecinde kaynak kavga kaydı inceleniyor. Gözaltı mahkûmiyet değildir. Ek inceleme kararı iki hafta, normal karar bir hafta sonra gelir; doğrulanmış delil yoksa mahkûmiyet oluşmaz. Oyundaki tekrar politikası: ikinci kesin kavga kararından itibaren iki oyun haftası infaz uygulanır.',condition:()=>false,validateChoice:criminalChoiceAvailability,choices:[
  {id:'accept',label:'Kaynak kayıtla karar verilmesini iste',effects:{}},
  {id:'review',label:'İtiraz et ve bir ek inceleme iste',effects:{}},
 ]},
 {id:'criminal_verdict',repeat:'repeatable',title:'Kavga dosyasında kesin karar',text:'Kaynak olay ve varsa ek inceleme değerlendirildi. Doğrulanmış delile bağlı karar kayda geçecek. Bu, tam yasal yargılama modeli değildir; gözaltı veya borç incelemesi tek başına sabıka yaratmaz.',condition:()=>false,validateChoice:criminalChoiceAvailability,choices:[{id:'acknowledge',label:'Gerekçeli sonucu kayda geçir',effects:{}}]},
];
