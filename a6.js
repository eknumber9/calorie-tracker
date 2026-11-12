/* ---------- food search: common foods + USDA database, with portions ---------- */
const FOOD_CSV='https://cdn.jsdelivr.net/npm/tempo-food-db@1.0.0/data/tempolife-foods.csv';
const UNITS_STD=[['g',1],['oz',28.35],['lb',453.6]];
let FDB=null,fdbLoading=null,fSel=null;
function words(s){return s.toLowerCase().split(/[^a-z0-9%]+/).filter(Boolean)}
function mkItem(o){o.hay=words(o.name+' '+(o.alias||''));o.lname=o.name.toLowerCase();return o}
const COMMON=(typeof COMMON_FOODS!=='undefined'?COMMON_FOODS:[]).map(r=>mkItem({name:r[0],k:r[1],p:r[2],c:r[3],f:r[4],units:(r[5]?r[5].split('|').map(u=>{const i=u.lastIndexOf(':');return[u.slice(0,i),+u.slice(i+1)]}):[]),alias:r[6],src:'common'}));
function parseCSV(t){
  const rows=[];let row=[],cur='',q=false;
  for(let i=0;i<t.length;i++){const ch=t[i];
    if(q){if(ch==='"'){if(t[i+1]==='"'){cur+='"';i++}else q=false}else cur+=ch}
    else if(ch==='"')q=true;else if(ch===','){row.push(cur);cur=''}else if(ch==='\n'){row.push(cur);rows.push(row);row=[];cur=''}else if(ch!=='\r')cur+=ch}
  if(cur||row.length){row.push(cur);rows.push(row)}return rows;
}
function loadFDB(){
  if(FDB)return Promise.resolve(FDB);if(fdbLoading)return fdbLoading;
  fdbLoading=fetch(FOOD_CSV).then(r=>{if(!r.ok)throw 0;return r.text()}).then(t=>{
    const rows=parseCSV(t),h=rows.shift(),ix=n=>h.indexOf(n),seen=new Set();
    const iN=ix('name'),iB=ix('brand'),iK=ix('calories'),iP=ix('protein'),iC=ix('carbs'),iF=ix('fat');
    FDB=[];
    rows.forEach(r=>{const k=parseFloat(r[iK]);if(!r[iN]||!isFinite(k))return;
      const name=r[iB]?`${r[iN]} (${r[iB]})`:r[iN];const key=name+'|'+k;if(seen.has(key))return;seen.add(key);
      FDB.push(mkItem({name,k,p:parseFloat(r[iP])||0,c:parseFloat(r[iC])||0,f:parseFloat(r[iF])||0,units:[],src:'usda'}))});
    return FDB;
  }).catch(()=>{fdbLoading=null;return null});
  return fdbLoading;
}
function libItems(){return S.library.map(f=>mkItem({name:f.name,k:f.cal,p:f.p,c:f.c,f:f.f,serving:f.serving,src:'mine'}))}
function searchFoods(q,limit){
  const toks=words(q);if(!toks.length)return[];
  const ql=q.trim().toLowerCase(),out=[];
  const test=(it,base)=>{
    for(const t of toks){if(!it.hay.some(w=>w.startsWith(t)))return}
    let s=base-it.name.length*0.4;
    if(it.lname.startsWith(ql))s+=120;else if(it.hay[0]&&it.hay[0].startsWith(toks[0]))s+=60;
    if(toks.every(t=>it.hay.includes(t)))s+=25;
    if(it.src==='usda'&&/[A-Z]{4,}/.test(it.name))s-=60;
    out.push([s,it]);
  };
  libItems().forEach(it=>test(it,400));COMMON.forEach(it=>test(it,300));(FDB||[]).forEach(it=>test(it,0));
  out.sort((a,b)=>b[0]-a[0]);
  const res=[],names=new Set();
  for(const [,it] of out){const k=it.src+it.lname;if(names.has(k))continue;names.add(k);res.push(it);if(res.length>=limit)break}
  return res;
}
function unitsFor(it){return it.src==='mine'?[['serving',null]]:[...it.units,...UNITS_STD]}
function itemSub(it){
  if(it.src==='mine')return`My food · ${it.serving?esc(it.serving)+' · ':''}${fmt(it.k)} cal`;
  if(it.units.length){const [l,g]=it.units[0];return`${it.src==='common'?'Common':'Database'} · 1 ${esc(l)} = ${fmt(g)} g · ${fmt(it.k*g/100)} cal`}
  return`${it.src==='common'?'Common':'Database'} · per 100 g: ${fmt(it.k)} cal · P ${fmt(it.p)} C ${fmt(it.c)} F ${fmt(it.f)}`;
}
function renderFoodResults(){
  const q=$('fq').value,box=$('fres');
  if(fSel){box.innerHTML='';return}
  if(!q.trim()){box.innerHTML='';$('fstat').textContent=FDB?`Search ${fmt(COMMON.length+FDB.length)} foods, plus My foods.`:'Type a food. Loading the full database…';return}
  const res=searchFoods(q,30);box._res=res;
  box.innerHTML=res.length?res.map((it,i)=>`<button class="food fpick" data-fi="${i}" style="width:100%;text-align:left;display:block;padding:10px 0"><div class="fn">${esc(it.name)}</div><small style="color:var(--muted)">${itemSub(it)}</small></button>`).join('')
    :`<p class="empty">No matches${FDB?'':' yet (still loading the full database)'}. Try a simpler word, or use Manual.</p>`;
}
function openFood(it){
  fSel=it;const us=unitsFor(it),u0=us[0],noPortion=it.src!=='mine'&&!it.units.length;
  const qty=it.src==='usda'&&noPortion?100:(it.src==='common'&&noPortion?4:1),unit=it.src==='usda'&&noPortion?'g':(noPortion?'oz':u0[0]);
  $('fres').innerHTML='';
  $('fdet').innerHTML=`<button class="btn ghost" id="fback" style="margin:0 0 10px;padding:9px">‹ Back to results</button>
    <div style="font-weight:700;font-size:17px">${esc(it.name)}</div>
    <div class="hint" style="margin-bottom:6px">${it.src==='mine'?'From My foods':`Per 100 g: ${fmt(it.k)} cal · P ${fmt(it.p)} · C ${fmt(it.c)} · F ${fmt(it.f)}`}</div>
    <div class="row2"><div><label class="f">Amount</label><input id="fqty" inputmode="decimal" value="${qty}"></div>
    <div><label class="f">Unit</label><select id="funit" style="width:100%;font-size:16px;padding:11px 8px;border-radius:12px;background:var(--card2);color:var(--text);border:1px solid var(--line)">${us.map(([l,g])=>`<option value="${esc(l)}"${l===unit?' selected':''}>${esc(l)}${g&&!['g','oz','lb'].includes(l)?` (${fmt(g)} g)`:''}</option>`).join('')}</select></div></div>
    <div id="ftot" style="margin-top:14px"></div>
    <button class="btn" id="fadd">Add</button>`;
  calcFood();
}
function foodTotal(){
  const it=fSel,q=num($('fqty').value),u=unitsFor(it).find(x=>x[0]===$('funit').value)||unitsFor(it)[0];
  if(it.src==='mine'){return{cal:it.k*q,p:it.p*q,c:it.c*q,f:it.f*q,label:`${+q.toFixed(2)} serving${q===1?'':'s'}`}}
  const g=q*u[1],k=g/100;
  return{cal:it.k*k,p:it.p*k,c:it.c*k,f:it.f*k,g,label:`${+q.toFixed(2)} ${u[0]}`};
}
function calcFood(){
  const t=foodTotal();
  $('ftot').innerHTML=`<div style="font-size:26px;font-weight:800">${fmt(t.cal)} cal</div><div class="hint">P ${fmt(t.p)}g · C ${fmt(t.c)}g · F ${fmt(t.f)}g${t.g!=null&&!/ g$/.test(t.label)?` · ${fmt(t.g)} g`:''}</div>`;
  $('fadd').textContent=`Add ${fmt(t.cal)} cal to ${S.meal}`;
}
function closeFood(){fSel=null;$('fdet').innerHTML='';renderFoodResults()}

// build the Search tab
(function(){
  const st=document.createElement('style');
  st.textContent='.fpick .fn{white-space:normal}#fres{max-height:52vh;overflow:auto}#manSug .fpick{padding:8px 0}';
  document.head.appendChild(st);
  const b=document.createElement('button');b.dataset.tab='search';b.textContent='Search';$('tabs').prepend(b);
  const pane=document.createElement('div');pane.className='pane';pane.id='pane-search';
  pane.innerHTML='<input id="fq" type="search" placeholder="Search foods, e.g. chicken breast, banana, rice" autocomplete="off" autocorrect="off"><p class="hint" id="fstat"></p><div id="fres"></div><div id="fdet"></div>';
  $('tabsWrap').after(pane);
  const sug=document.createElement('div');sug.id='manSug';$('mName').after(sug);
  const attr=document.createElement('p');attr.className='hint';
  attr.textContent='Food data: USDA FoodData Central (SR Legacy) via the TempoLife food dataset (tempolife.app), CC-BY-4.0. Portion weights from USDA household measures.';
  $('setSheet').appendChild(attr);
})();
let fT;
$('fq').oninput=()=>{if(fSel){fSel=null;$('fdet').innerHTML=''}clearTimeout(fT);fT=setTimeout(renderFoodResults,120)};
$('fres').onclick=e=>{const b=e.target.closest('[data-fi]');if(b)openFood($('fres')._res[+b.dataset.fi])};
$('fdet').oninput=e=>{if(e.target.id==='fqty')calcFood()};
$('fdet').onchange=e=>{if(e.target.id==='funit')calcFood()};
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
setTab=function(t){_setTab(t);$('pane-search').classList.toggle('on',t==='search');document.querySelectorAll('#tabs button').forEach(b=>b.classList.toggle('on',b.dataset.tab===t));if(t==='search'){renderFoodResults();loadFDB().then(renderFoodResults)}if(t!=='man')$('manSug').innerHTML=''};
const _openAdd=openAdd;
openAdd=function(meal){_openAdd(meal);fSel=null;$('fdet').innerHTML='';$('fq').value='';setTab('search')};
const _openEdit=openEdit;
openEdit=function(id){_openEdit(id);$('pane-search').classList.remove('on');$('manSug').innerHTML=''};
setTimeout(()=>{loadFDB()},1500);
})();
