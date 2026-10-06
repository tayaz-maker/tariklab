import assert from "node:assert/strict";

// Read-only DOM evidence; no styles, game state, focus or scroll are changed.
export async function captureDashboardLayout(page) {
  return page.evaluate(() => {
    const grid=document.querySelector(".management-workspace > .dashboard-grid, .workspace > .dashboard-grid");
    if(!grid)return null;
    const rect=el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};};
    const gridStyle=getComputedStyle(grid),right=grid.querySelector(":scope > .right-column");
    const rightStyle=right&&getComputedStyle(right);
    const layoutVersion=grid.closest(".management-workspace")?1:2;
    const rows=right?[...right.querySelectorAll(layoutVersion===1?":scope > .desk-row":":scope > .panel")]:[];
    return {layoutVersion,viewport:{width:innerWidth,height:innerHeight},grid:{...rect(grid),columns:gridStyle.gridTemplateColumns,areas:gridStyle.gridTemplateAreas},right:right&&{...rect(right),row:rightStyle.gridRow,column:rightStyle.gridColumn},titles:rows.map(row=>{
      const title=row.querySelector(layoutVersion===1?".desk-row-title":".panel-head h2"),style=title&&getComputedStyle(title);
      if(!title)return {row:rect(row),missing:true};
      const r=rect(title),lineHeight=style.lineHeight==="normal"?parseFloat(style.fontSize)*1.2:parseFloat(style.lineHeight);
      return {text:title.textContent.trim(),...r,row:rect(row),fontSize:parseFloat(style.fontSize),lineHeight,lineCount:r.height/lineHeight,overflowWrap:style.overflowWrap};
    })};
  });
}

export function assertReadableDashboardLayout(value) {
  assert.ok(value?.grid && value.right,"dashboard and inbox/people column must exist");
  if(value.layoutVersion===2){
    assert.ok(value.right.width>=Math.min(220,value.grid.width-2),"inbox/people column is too narrow");
    assert.equal(value.titles.length,2,"both inbox and key-people panels must be measured");
    for(const title of value.titles){
      assert.ok(title.text && !title.missing,"panel needs its visible title");
      assert.ok(title.width>=Math.min(110,title.row.width-48),`title is too narrow: ${title.text}`);
      assert.ok(Number.isFinite(title.lineHeight)&&title.lineHeight>0,"actual line height required");
      assert.ok(title.lineCount<=2.1,`title wraps into an unreadable column: ${title.text}`);
    }
    return value;
  }
  assert.equal(value.grid.areas,"none","dashboard must not retain the moved panels' named areas");
  assert.equal(value.right.row,"auto","right-column must not retain named row placement");
  assert.ok(value.grid.width>0 && value.right.width>=value.grid.width-2,"inbox/people column must use the dashboard width");
  assert.equal(value.titles.length,2,"both inbox and key-people rows must be measured");
  for(const title of value.titles){
    assert.ok(title.text && !title.missing,"row needs its accessible visible title");
    assert.ok(title.row.width>=value.right.width-2,`row is squeezed: ${title.text}`);
    assert.ok(Number.isFinite(title.lineHeight)&&title.lineHeight>0,"actual line height required");
    assert.ok(title.width>=Math.min(120,title.row.width-56),`title is too narrow: ${title.text}`);
    assert.ok(title.width>=title.fontSize*6,`title cannot hold a readable word: ${title.text}`);
    assert.ok(title.lineCount<=2.1,`title wraps into an unreadable column: ${title.text}`);
  }
  return value;
}

// ResourceTiming entries are an observed local sample, not a network-wide
// request census or a speed guarantee. Both servers use the same no-store helper.
export function summarizeLayoutEntryCost(cold) {
  assert.ok(cold && Array.isArray(cold.navigation) && Array.isArray(cold.resources));
  const entries=[...cold.navigation,...cold.resources];
  for(const entry of entries) for(const key of ["transferSize","encodedBodySize"]) assert.ok(Number.isFinite(entry[key]) && entry[key]>=0, `missing or invalid ResourceTiming ${key}`);
  return { recordedRequestEntries:entries.length,transferBytes:entries.reduce((n,e)=>n+e.transferSize,0),encodedBodyBytes:entries.reduce((n,e)=>n+e.encodedBodySize,0) };
}
