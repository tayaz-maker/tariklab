import assert from 'node:assert/strict';
import {createNewGame} from '../public/games/tc-sim/js/state.js';
import {setRomanticInterest,becomePartner} from '../public/games/tc-sim/js/social.js';
export function marriageFixture(){
 const s=createNewGame({seed:29,eraId:'2017-04-18',name:'Marriage QA'});
 s.events.active=null;s.events.queue=[];s.finances.balance=150000;s.relationships.elif=90;
 const p=s.people.find(p=>p.id==='elif');p.social.trust=90;p.social.tension=0;
 assert.equal(setRomanticInterest(s,'elif'),true);assert.equal(becomePartner(s,'elif'),true);
 s.time.absoluteWeek=9;return s;
}
