import test from "node:test";
import assert from "node:assert/strict";
import { assertReadableDashboardLayout, summarizeLayoutEntryCost } from "./tc-sim-job-start-layout.mjs";
const rows=width=>["Gelen kutusu","Önemli kişiler"].map(text=>({text,width:width-50,height:18.2,row:{width,height:60},fontSize:14,lineHeight:18.2,lineCount:1}));
const snapshot=width=>({grid:{width,areas:"none",columns:`${width}px`},right:{width,row:"auto",column:"auto"},titles:rows(width)});
test("readability guard rejects the measured production one-letter columns even with zero page overflow",()=>{
 const production={grid:{width:737.609375,areas:'"week right" "history cases"',columns:"57.6094px 672px"},right:{width:57.609375,row:"right"},titles:rows(57.609375).map((t,i)=>({...t,width:7.609375,height:i?236.4375:200.0625,lineCount:(i?236.4375:200.0625)/18.2}))};
 assert.throws(()=>assertReadableDashboardLayout(production));
 // No accidental pass if one symptom is fixed while title geometry stays broken.
 assert.throws(()=>assertReadableDashboardLayout({...production,grid:{...production.grid,areas:"none"},right:{width:737.609375,row:"auto"}}),/squeezed|narrow|word|column/);
});
test("guard accepts readable row geometry at desktop and both mobile content widths; catches missing or tall titles",()=>{
 for(const width of [804,370,300])assert.equal(assertReadableDashboardLayout(snapshot(width)).titles.length,2);
 const missing=snapshot(300);missing.titles.pop();assert.throws(()=>assertReadableDashboardLayout(missing));
 const tall=snapshot(300);tall.titles[0].lineCount=11;assert.throws(()=>assertReadableDashboardLayout(tall),/unreadable column/);
});
test("CSS-only cold-entry cost sums actual ResourceTiming observations without inventing missing response bytes",()=>{
 const observed={navigation:[{transferSize:550,encodedBodySize:250}],resources:[{transferSize:624,encodedBodySize:324},{transferSize:0,encodedBodySize:40}]};
 assert.deepEqual(summarizeLayoutEntryCost(observed),{recordedRequestEntries:3,transferBytes:1174,encodedBodyBytes:614});
 assert.throws(()=>summarizeLayoutEntryCost(null));
 for(const invalid of [undefined,NaN,-1]) {
  assert.throws(()=>summarizeLayoutEntryCost({navigation:[{transferSize:550,encodedBodySize:invalid}],resources:[]}),/encodedBodySize/);
  assert.throws(()=>summarizeLayoutEntryCost({navigation:[{transferSize:invalid,encodedBodySize:250}],resources:[]}),/transferSize/);
 }
});
