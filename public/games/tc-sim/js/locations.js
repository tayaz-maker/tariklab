// Pure geography modifiers. Existing life/social/business engines own all mutations.
import {getHomeById,getJobById,getCommuteLoad} from './catalog.js?v=10';
export const CITIES={istanbul:'İstanbul',ankara:'Ankara',izmir:'İzmir'};
// Gameplay coefficients, not measured rents, journey times or a social-class index.
export const DISTRICTS=[
 {id:'sisli',city:'istanbul',name:'Şişli · Mecidiyeköy',kind:'Merkez ve iş aksı',rent:1.45,living:1.15,travel:45,education:0,social:1.15,sectors:['ofis','ticaret','medya'],rail:'2000-09-16',railName:'M2',x:43,y:30},
 {id:'kadikoy',city:'istanbul',name:'Kadıköy',kind:'Eğitim, kültür ve hizmet',rent:1.3,living:1.1,travel:45,education:0,social:1.2,sectors:['egitim','yemeicme','medya'],rail:'2012-08-17',railName:'M4',x:73,y:62},
 {id:'uskudar',city:'istanbul',name:'Üsküdar',kind:'Yerleşim ve aktarma',rent:1.1,living:1,travel:50,education:0,social:1,sectors:['hizmet','saglik'],rail:'2017-12-15',railName:'M5',x:71,y:29},
 {id:'bayrampasa',city:'istanbul',name:'Bayrampaşa',kind:'Üretim ve ticaret bağlantısı',rent:.9,living:.95,travel:55,education:1,social:.95,sectors:['uretim','lojistik','ticaret'],rail:'1989-03-11',railName:'M1',x:27,y:53},
 {id:'avcilar',city:'istanbul',name:'Avcılar',kind:'Batı çeperi ve üniversite çevresi',rent:.8,living:.9,travel:80,education:0,social:1,sectors:['uretim','egitim'],rail:null,railName:null,x:18,y:80},
 {id:'cankaya',city:'ankara',name:'Çankaya · Kızılay',kind:'Kamu, eğitim ve hizmet',rent:1.05,living:.98,travel:40,education:0,social:1.1,sectors:['kamu','egitim','ofis'],rail:'1996-08-30',railName:'ANKARAY',x:62,y:65},
 {id:'batikent',city:'ankara',name:'Yenimahalle · Batıkent',kind:'Yerleşim ve üretim bağlantısı',rent:.8,living:.9,travel:55,education:1,social:.9,sectors:['uretim','lojistik'],rail:'1997-12-27',railName:'M1',x:29,y:29},
 {id:'konak',city:'izmir',name:'Konak',kind:'Merkez, ticaret ve hizmet',rent:1,living:1,travel:40,education:0,social:1.15,sectors:['ticaret','yemeicme','hizmet'],rail:'2000-05-22',railName:'Metro',x:32,y:68},
 {id:'bornova',city:'izmir',name:'Bornova',kind:'Üniversite ve üretim çevresi',rent:.9,living:.95,travel:50,education:0,social:1.1,sectors:['egitim','uretim','hizmet'],rail:'2000-05-22',railName:'Metro',x:69,y:31},
];
export const getDistrict=id=>DISTRICTS.find(d=>d.id===id)||null;
export const currentDistrict=state=>getDistrict(state.household?.location?.districtId);
export function normalizeLocation(state){
 const raw=state.household?.location;if(!raw)return;const d=getDistrict(raw.districtId);
 if(!d||state.household.homeId==='family'){delete state.household.location;state.player.city='İstanbul';return;}
 state.household.location={districtId:d.id,lastMoveWeek:Number.isInteger(raw.lastMoveWeek)?Math.max(0,Math.min(state.time.absoluteWeek,raw.lastMoveWeek)):0};
 state.player.city=CITIES[d.city];
}
export function districtProfile(state,id=currentDistrict(state)?.id){
 const d=getDistrict(id);if(!d)return {rent:1,living:1,education:0,social:1,travel:0,rail:false};
 const date=state.time.date||`${state.time.year}-01-01`,year=+date.slice(0,4);
 const era=year<1990?.85:year<2010?.94:year<2020?1:1.12;
 const rail=Boolean(d.rail&&date>=d.rail);
 return {...d,rent:1+(d.rent-1)*era+(year>=2020?.08:0),living:1+(d.living-1)*era,rail,travel:Math.max(15,d.travel-(rail?10:0)+(year<1990?10:0))};
}
export function locationCommute(state,homeId=state.household?.homeId,jobId=state.career?.jobId){
 const d=currentDistrict(state),job=getJobById(jobId);
 if(!d){const raw=getCommuteLoad(homeId,jobId);return state.wealth?.vehicle?Math.max(0,raw-1):raw;}
 if(!job||job.id==='freelance_any')return 0;
 const p=districtProfile(state);const minutes=Math.max(15,p.travel-(d.sectors.includes(job.family)?15:0)-(state.wealth?.vehicle?10:0));
 return Math.min(3,Math.floor(minutes/25));
}
export function locationCosts(state){
 const p=districtProfile(state);return {rent:p.rent,living:p.living,transport:currentDistrict(state)&&state.career.jobId&&state.career.jobId!=='freelance_any'?250+locationCommute(state)*180:0};
}
export function locationJobDelay(state,job){
 const d=currentDistrict(state);return d&&job&&job.id!=='freelance_any'&&!d.sectors.includes(job.family)?1:0;
}
export function locationEducationLoad(state){return state.education?.active?districtProfile(state).education:0;}
export function socialTravel(state,personId){
 const d=currentDistrict(state);if(!d)return {cost:0,slots:0};
 if(state.social.currentPartnerNpcId===personId&&state.household.union?.cohabitingSince&&!state.household.union?.separatedSince)return {cost:0,slots:0};
 // Existing named circle remains in Istanbul. Moving never silently teleports NPCs.
 return d.city==='istanbul'?{cost:d.id==='avcilar'?180:80,slots:0}:{cost:1200,slots:1};
}
export function businessLocation(state,business=state.flags.business){
 const id=business?.locationId ?? currentDistrict(state)?.id;
 const p=districtProfile(state,id);if(!p.id)return {rent:1,demand:1};
 const match=business?.id==='repair'?p.sectors.includes('uretim'):business?.id==='internet'?p.sectors.includes('egitim'):business?.id==='digital'?false:p.sectors.includes('hizmet')||p.sectors.includes('ticaret');
 return {rent:p.rent,demand:match?1.12:.96};
}
export function locationMoveQuote(state,id,homeId){
 const d=getDistrict(id),home=getHomeById(homeId);if(!d||!home)return null;
 const from=currentDistrict(state),intercity=(from?.city||'istanbul')!==d.city;
 const cost=Math.round(home.moveCost*districtProfile(state,id).rent)+(intercity?6500:1400);
 return {district:d,home,intercity,cost,slots:intercity?3:2};
}
