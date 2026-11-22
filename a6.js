
/* ---------- food data: common foods + USDA FNDDS (prepared foods, real portions) + USDA SR ---------- */
const FOOD_CSV='https://cdn.jsdelivr.net/npm/tempo-food-db@1.0.0/data/tempolife-foods.csv';
const FNDDS_BASE='https://cdn.jsdelivr.net/gh/jmitterh/group_project_2@57e0efc814769455d5b9e0a628d9a74595353d13/data/formatted_data/';
const UNITS_STD=[['oz',28.35],['g',1],['lb',453.6]];
let FDB=null,FND=null,fdbLoading=null,fndLoading=null,fSel=null;
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
function getText(u){return fetch(u).then(r=>{if(!r.ok)throw 0;return r.text()})}
function loadFDB(){
  if(FDB)return Promise.resolve(FDB);if(fdbLoading)return fdbLoading;
  fdbLoading=getText(FOOD_CSV).then(t=>{
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
// FNDDS portion labels: "1 medium breast" -> "medium breast"; pick a sensible default serving
const BAD_PORTION=/with bone|cubic inch|surface inch|yield after|^guideline|^amount|crabapple/i;
function fixPortions(list){
  let ps=list.filter(p=>p[2]>0).sort((a,b)=>a[0]-b[0]).map(p=>{let l=p[1].trim();
    if(/^quantity not specified/i.test(l))l='typical serving';else l=l.replace(/^1 (?!\/)/,'');return[l,p[2]]});
  const seen=new Set();ps=ps.filter(p=>{const k=p[0].toLowerCase();if(seen.has(k))return false;seen.add(k);return true});
  const good=ps.filter(p=>!BAD_PORTION.test(p[0])&&p[0]!=='typical serving');
  const med=good.filter(p=>/\bmedium\b/i.test(p[0])&&!/pizza \(/i.test(p[0]));
  const def=med.find(p=>!/slice|piece|fillet|strip/i.test(p[0]))||good.find(p=>/^oz\b.*cooked/i.test(p[0]))||med[0]||good.find(p=>/^(cup|piece|slice|sandwich|tablespoon|large egg|egg|bar|can|bottle|container|patty|link|serving|item|order|packet|taco|burrito|roll|bun|cookie|muffin|bagel)\b/i.test(p[0]))||good[0]||ps[0];
  const rest=ps.filter(p=>p!==def).sort((a,b)=>BAD_PORTION.test(a[0])-BAD_PORTION.test(b[0]));
  return def?[def,...rest]:[];
}
function loadFND(){
  if(FND)return Promise.resolve(FND);if(fndLoading)return fndLoading;
  fndLoading=Promise.all([getText(FNDDS_BASE+'NutrientValues.csv'),getText(FNDDS_BASE+'PortionsAndWeights.csv')]).then(([nt,pt])=>{
    const pr=parseCSV(pt),ph=pr.shift(),jc=ph.indexOf('food_code'),js=ph.indexOf('seq_num'),jd=ph.indexOf('portion_description'),jw=ph.indexOf('portion_weight_g'),por={};
    pr.forEach(r=>{const c=r[jc];if(!c)return;(por[c]=por[c]||[]).push([+r[js],r[jd]||'',parseFloat(r[jw])||0])});
    const nr=parseCSV(nt),h=nr.shift(),ix=n=>h.indexOf(n);
    const iC=ix('food_code'),iN=ix('main_food_description'),iK=ix('energy_kcal'),iP=ix('protein_g'),iCa=ix('carbohydrate_g'),iF=ix('total_fat_g');
    FND=[];
    nr.forEach(r=>{const k=parseFloat(r[iK]);if(!r[iN]||!isFinite(k))return;
      FND.push(mkItem({name:r[iN],k,p:parseFloat(r[iP])||0,c:parseFloat(r[iCa])||0,f:parseFloat(r[iF])||0,units:fixPortions(por[r[iC]]||[]),src:'fndds'}))});
    return FND;
  }).catch(()=>{fndLoading=null;return null});
  return fndLoading;
}
function loadAll(){return Promise.all([loadFND(),loadFDB()])}
function libItems(){return S.library.map(f=>mkItem({name:f.name,k:f.cal,p:f.p,c:f.c,f:f.f,serving:f.serving,units:[],src:'mine'}))}
function searchFoods(q,limit){
  const toks=words(q).map(t=>t.length>3&&/[^se]s$/.test(t)?t.slice(0,-1):t);if(!toks.length)return[];
  const ql=q.trim().toLowerCase(),out=[];
  const test=(it,base)=>{
    for(const t of toks){if(!it.hay.some(w=>w.startsWith(t)))return}
    let s=base-it.name.length*(it.src==='fndds'?0.25:0.4);
    if(it.lname.startsWith(ql))s+=120;else if(it.hay[0]&&it.hay[0].startsWith(toks[0]))s+=60;
    if(toks.every(t=>it.hay.includes(t)))s+=25;
    if(it.src==='fndds'&&/\b(nfs|ns as to)\b/.test(it.lname))s+=15;
    if(it.src==='usda'&&/[A-Z]{4,}/.test(it.name))s-=60;
    out.push([s,it]);
  };
  libItems().forEach(it=>test(it,400));COMMON.forEach(it=>test(it,300));(FND||[]).forEach(it=>test(it,150));(FDB||[]).forEach(it=>test(it,0));
  out.sort((a,b)=>b[0]-a[0]);
  const res=[],names=new Set();
  for(const [,it] of out){const k=it.src+it.lname;if(names.has(k))continue;names.add(k);res.push(it);if(res.length>=limit)break}
  return res;
}
function unitsFor(it){if(it.src==='mine')return[['serving',null]];const own=it.units.map(u=>u[0].toLowerCase());return[...it.units,...UNITS_STD.filter(u=>!own.includes(u[0]))]}
// default amount: one of the food's own serving; meats without a portion default to 4 oz
function defServing(it){
  if(it.src==='mine')return[1,'serving'];
  const u=it.units[0];if(u)return[/^oz\b/.test(u[0])?4:1,u[0]];
  return[it.src==='common'?4:1,'oz'];
}
function srcLabel(it){return{common:'Common',fndds:'USDA',usda:'USDA SR'}[it.src]||''}
function itemSub(it){
  if(it.src==='mine')return`My food · ${it.serving?esc(it.serving)+' · ':''}${fmt(it.k)} cal`;
  const [q,l]=defServing(it),u=unitsFor(it).find(x=>x[0]===l),g=q*u[1];
  return`${srcLabel(it)} · ${+q.toFixed(2)} ${esc(l)} (${fmt(g)} g) · ${fmt(it.k*g/100)} cal · P ${fmt(it.p*g/100)}`;
}
