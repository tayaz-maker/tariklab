import {createNewGame} from '../public/games/tc-sim/js/state.js';
export function cityFixture(){const s=createNewGame({seed:41,eraId:'2017-04-18',name:'City QA'});s.events.active=null;s.events.queue=[];s.finances.balance=100000;return s;}
