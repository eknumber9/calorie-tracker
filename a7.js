/* ---------- food search UI ---------- */
function renderFoodResults(){
  const q=$('fq').value,box=$('fres');
  if(fSel){box.innerHTML='';return}
  const n=COMMON.length+(FND?FND.length:0)+(FDB?FDB.length:0),ready=FND&&FDB;
  if(!q.trim()){box.innerHTML='';$('fstat').textContent=ready?`Search ${fmt(n)} foods, plus My foods.`:'Type a food. Loading the full database (first time takes a few seconds)…';return}
  $('fstat').textContent=ready?'':'Still loading the full database…';
  const res=searchFoods(q,40);box._res=res;
  box.innerHTML=res.length?res.map((it,i)=>`<button class="food fpick" data-fi="${i}" style="width:100%;text-align:left;display:block;padding:10px 0"><div class="fn">${esc(it.name)}</div><small style="color:var(--muted)">${itemSub(it)}</small></button>`).join('')
    :`<p class="empty">No matches${ready?'':' yet'}. Try a simpler word, or use Manual.</p>`;
}
function unitOpt(l,g,sel){return`<option value="${esc(l)}"${l===sel?' selected':''}>${esc(l)}${g&&!['g','oz','lb'].includes(l)?` (${fmt(g)} g)`:''}</option>`}
function openFood(it){
  fSel=it;const us=unitsFor(it),[qty,unit]=defServing(it);
  $('fres').innerHTML='';$('fstat').textContent='';
  $('fdet').innerHTML=`<button class="btn ghost" id="fback" style="margin:0 0 10px;padding:9px">‹ Back to results</button>
    <div style="font-weight:700;font-size:17px">${esc(it.name)}</div>
    <div class="hint" style="margin-bottom:6px">${it.src==='mine'?'From My foods':srcLabel(it)+(it.units.length?'':' · no household servings listed, so weigh or estimate in oz')}</div>
    <div style="display:grid;grid-template-columns:88px 1fr;gap:10px"><div><label class="f">Amount</label><input id="fqty" inputmode="decimal" value="${qty}"></div>
    <div><label class="f">Unit</label><select id="funit" style="width:100%;font-size:16px;padding:11px 8px;border-radius:12px;background:var(--card2);color:var(--text);border:1px solid var(--line)">${us.map(([l,g])=>unitOpt(l,g,unit)).join('')}</select></div></div>
    <div id="ftot" style="margin-top:14px"></div>
    <button class="btn" id="fadd">Add</button>`;
  $('funit')._prev=unit;calcFood();
}
function curUnit(){const it=fSel;return unitsFor(it).find(x=>x[0]===$('funit').value)||unitsFor(it)[0]}
function foodTotal(){
  const it=fSel,q=num($('fqty').value),u=curUnit();
  if(it.src==='mine'){return{cal:it.k*q,p:it.p*q,c:it.c*q,f:it.f*q,label:`${+q.toFixed(2)} serving${q===1?'':'s'}`}}
  const g=q*u[1],k=g/100;
  return{cal:it.k*k,p:it.p*k,c:it.c*k,f:it.f*k,g,label:`${+q.toFixed(2)} ${u[0]}`};
}
function calcFood(){
  const t=foodTotal(),it=fSel;
  const per=it.src!=='mine'?`<div class="hint" style="margin-top:4px">Per 100 g: ${fmt(it.k)} cal · P ${fmt(it.p)} · C ${fmt(it.c)} · F ${fmt(it.f)}</div>`:'';
  $('ftot').innerHTML=`<div class="hint" style="margin:0">${esc(t.label)}${t.g!=null&&!/ g$/.test(t.label)?` · ${fmt(t.g)} g`:''}</div><div style="font-size:26px;font-weight:800">${fmt(t.cal)} cal</div><div style="font-size:15px;margin-top:2px"><b style="color:var(--p)">P ${fmt(t.p)}g</b> · <b style="color:var(--c)">C ${fmt(t.c)}g</b> · <b style="color:var(--f)">F ${fmt(t.f)}g</b></div>${per}`;
  $('fadd').textContent=`Add ${fmt(t.cal)} cal to ${S.meal}`;
}
// switching unit keeps the same amount of food where it makes sense
function unitChanged(){
  const it=fSel,sel=$('funit'),us=unitsFor(it),prev=us.find(x=>x[0]===sel._prev),nu=curUnit();
  if(it.src!=='mine'&&prev){const g=num($('fqty').value)*prev[1];
    if(nu[0]==='g')$('fqty').value=Math.round(g);
    else if(nu[0]==='oz')$('fqty').value=Math.round(g/28.35*4)/4;
    else if(nu[0]==='lb')$('fqty').value=Math.round(g/453.6*100)/100;
    else $('fqty').value=1}
  sel._prev=nu[0];calcFood();
}
function closeFood(){fSel=null;$('fdet').innerHTML='';renderFoodResults()}

// build the Search tab
(function(){
  const st=document.createElement('style');
  st.textContent='.fpick .fn{white-space:normal}#fres{max-height:52vh;overflow:auto}#manSug .fpick{padding:8px 0}';
  document.head.appendChild(st);
  const b=document.createElement('button');b.dataset.tab='search';b.textContent='Search';$('tabs').prepend(b);
  const pane=document.createElement('div');pane.className='pane';pane.id='pane-search';
  pane.innerHTML='<input id="fq" type="search" placeholder="Search foods, e.g. chicken breast, burrito, pizza" autocomplete="off" autocorrect="off"><p class="hint" id="fstat"></p><div id="fres"></div><div id="fdet"></div>';
  $('tabsWrap').after(pane);
  const sug=document.createElement('div');sug.id='manSug';$('mName').after(sug);
  const attr=document.createElement('p');attr.className='hint';
  attr.textContent='Food data: USDA Food and Nutrient Database for Dietary Studies (FNDDS 2017-2018, public domain) with USDA serving weights, plus USDA SR Legacy via the TempoLife dataset (CC-BY-4.0).';
  $('setSheet').appendChild(attr);
})();
let fT;
$('fq').oninput=()=>{if(fSel){fSel=null;$('fdet').innerHTML=''}clearTimeout(fT);fT=setTimeout(renderFoodResults,120)};
$('fres').onclick=e=>{const b=e.target.closest('[data-fi]');if(b)openFood($('fres')._res[+b.dataset.fi])};
$('fdet').oninput=e=>{if(e.target.id==='fqty')calcFood()};
$('fdet').onchange=e=>{if(e.target.id==='funit')unitChanged()};
$('fdet').onclick=e=>{
  if(e.target.id==='fback')return closeFood();
  if(e.target.id==='fadd'){const it=fSel,t=foodTotal();if(!(t.cal>0||t.p>0))return;
    const name=it.src==='mine'?it.name:`${it.name} · ${t.label}`;
    close();addEntries([{name,cal:t.cal,p:t.p,c:t.c,f:t.f,qty:1,serving:t.label}],S.meal);
    fSel=null;$('fdet').innerHTML='';$('fq').value='';}
};
$('mealSeg').addEventListener('click',()=>{if(fSel)calcFood()});
// Manual tab: suggestions while typing a name
let mT;
$('mName').addEventListener('input',()=>{clearTimeout(mT);mT=setTimeout(()=>{
  const q=$('mName').value,box=$('manSug');if(S.editing||q.trim().length<2){box.innerHTML='';return}
  const res=searchFoods(q,5);box._res=res;
  box.innerHTML=res.length?'<p class="hint" style="margin-top:8px">Tap a match to fill it in:</p>'+res.map((it,i)=>`<button class="food fpick" data-mi="${i}" style="width:100%;text-align:left;display:block"><div class="fn">${esc(it.name)}</div><small style="color:var(--muted)">${itemSub(it)}</small></button>`).join(''):'';
},150)});
$('manSug').onclick=e=>{const b=e.target.closest('[data-mi]');if(!b)return;const it=$('manSug')._res[+b.dataset.mi];$('manSug').innerHTML='';setTab('search');$('fq').value=it.name;openFood(it)};

// route tabs to include Search; open the sheet on Search by default
const _setTab=setTab;
setTab=function(t){_setTab(t);$('pane-search').classList.toggle('on',t==='search');document.querySelectorAll('#tabs button').forEach(b=>b.classList.toggle('on',b.dataset.tab===t));if(t==='search'){renderFoodResults();loadAll().then(renderFoodResults)}if(t!=='man')$('manSug').innerHTML=''};
const _openAdd=openAdd;
openAdd=function(meal){_openAdd(meal);fSel=null;$('fdet').innerHTML='';$('fq').value='';setTab('search')};
const _openEdit=openEdit;
openEdit=function(id){_openEdit(id);$('pane-search').classList.remove('on');$('manSug').innerHTML=''};
setTimeout(()=>{loadAll()},1500);
