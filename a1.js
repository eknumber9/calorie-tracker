(function(){
const MEALS=['Breakfast','Lunch','Dinner','Snacks'];
const DEF={goal:2700,p:190,c:315,f:75,w:190};
const S={date:ymd(new Date()),days:{},settings:{...DEF},library:[],weights:{},key:'',meal:defaultMeal(),tab:'photo',editing:null,est:[],estNote:'',pendingCode:null};
const $=id=>document.getElementById(id);

/* ---------- utils ---------- */
function ymd(d){const z=n=>String(n).padStart(2,'0');return d.getFullYear()+'-'+z(d.getMonth()+1)+'-'+z(d.getDate())}
function parseD(s){const [y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d)}
function addDays(s,n){const d=parseD(s);d.setDate(d.getDate()+n);return ymd(d)}
function num(v){const n=parseFloat(String(v??'').replace(',','.'));return isFinite(n)&&n>0?n:0}
function rnd(n){return Math.round(n||0)}
function fmt(n){return rnd(n).toLocaleString()}
function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,7)}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function defaultMeal(){const h=new Date().getHours();return h<11?'Breakfast':h<15?'Lunch':h<21?'Dinner':'Snacks'}
function dateLabel(s){const t=ymd(new Date());if(s===t)return'Today';if(s===addDays(t,-1))return'Yesterday';if(s===addDays(t,1))return'Tomorrow';return parseD(s).toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'})}

/* ---------- storage (this device only) ---------- */
const P='ct:';
const LS={get(k){try{return JSON.parse(localStorage.getItem(P+k))}catch(e){return null}},set(k,v){try{localStorage.setItem(P+k,JSON.stringify(v))}catch(e){toast('Storage full. Back up and clear old data.')}}};
function dayKey(s){return'd-'+s}
function day(s){if(!S.days[s]){const l=LS.get(dayKey(s));S.days[s]=l&&Array.isArray(l.entries)?l:{entries:[]}}return S.days[s]}
function saveDay(s){LS.set(dayKey(s),day(s))}
function saveLib(){LS.set('library',{items:S.library})}
function saveSettings(){LS.set('settings',S.settings)}
function saveWeights(){LS.set('weights',{items:S.weights})}
function allDays(){const out={};for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&k.startsWith(P+'d-')){try{out[k.slice(P.length+2)]=JSON.parse(localStorage.getItem(k))}catch(e){}}}return out}

/* ---------- math ---------- */
function totals(s){return day(s).entries.reduce((a,e)=>({cal:a.cal+e.cal,p:a.p+e.p,c:a.c+e.c,f:a.f+e.f}),{cal:0,p:0,c:0,f:0})}

/* ---------- render ---------- */
function render(){
  const t=totals(S.date),g=S.settings.goal||1,rem=g-t.cal,over=rem<0;
  $('dateLabel').textContent=dateLabel(S.date);
  const C=2*Math.PI*56;$('ringArc').setAttribute('stroke-dashoffset',C*(1-Math.min(t.cal/g,1)));
  $('ringArc').setAttribute('stroke',over?'var(--over)':'var(--accent)');
  $('remain').textContent=fmt(Math.abs(rem));$('remainLbl').textContent=over?'over':'left';
  $('sGoal').textContent=fmt(g);$('sEaten').textContent=fmt(t.cal);$('sProt').textContent=fmt(Math.max((S.settings.p||0)-t.p,0))+'g';
  $('macros').innerHTML=[['Protein','p','--p'],['Carbs','c','--c'],['Fat','f','--f']].map(([n,k,col])=>{
    const goal=S.settings[k]||0,v=t[k],pct=goal?Math.min(v/goal,1)*100:0;
    return`<div class="macro"><div class="top">${n}<b>${fmt(v)}${goal?' / '+fmt(goal):''}g</b></div><div class="bar"><i style="width:${pct}%;background:var(${col})"></i></div></div>`}).join('');
  const es=day(S.date).entries;
  $('meals').innerHTML=MEALS.map(m=>{
    const list=es.filter(e=>e.meal===m),sum=list.reduce((a,e)=>a+e.cal,0);
    return`<section class="card meal"><h3><span>${m}${sum?`<small>${fmt(sum)} cal</small>`:''}</span><button class="add" data-addmeal="${m}" aria-label="Add to ${m}">+</button></h3>`+
      list.map(e=>`<button class="entry" data-edit="${e.id}"><div class="nm"><div>${esc(e.name)}</div><small>P ${fmt(e.p)} · C ${fmt(e.c)} · F ${fmt(e.f)}</small></div><div class="kc">${fmt(e.cal)}</div></button>`).join('')+
      `</section>`}).join('');
  renderWeek();renderWeight();
}
function renderWeek(){
  const g=S.settings.goal||1,days=[6,5,4,3,2,1,0].map(i=>addDays(S.date,-i)),vals=days.map(d=>totals(d).cal);
  const max=Math.max(g*1.25,...vals),logged=vals.filter(v=>v>0);
  const avg=logged.length?logged.reduce((a,b)=>a+b,0)/logged.length:0;
  $('weekSub').textContent=logged.length?`Avg ${fmt(avg)} cal on ${logged.length} logged day${logged.length>1?'s':''} · ${avg>g?fmt(avg-g)+' over':fmt(g-avg)+' under'} goal`:'Nothing logged this week yet';
  const H=100;
  $('bars').innerHTML=days.map((d,i)=>{const v=vals[i],h=v?Math.max(4,v/max*H):3;const cls=v===0?'zero':v>g?'over':'';
    return`<button class="col${d===S.date?' sel':''}" data-go="${d}"><div class="b ${cls}" style="height:${h}px"></div><div class="lab">${parseD(d).toLocaleDateString(undefined,{weekday:'narrow'})}</div></button>`}).join('')+
    `<div class="goalline" style="bottom:${20+g/max*H}px"></div>`;
}
function renderWeight(){
  const w=S.weights,cur=w[S.date],g=S.settings.w||190;
  $('wIn').placeholder=cur?`${cur} lb logged`:'Morning weight (lb)';$('wBtn').textContent=cur?'Update':'Log';
  const avg=(a,b)=>{const v=[];for(let i=a;i<b;i++){const x=w[addDays(S.date,-i)];if(x)v.push(x)}return v.length?v.reduce((s,y)=>s+y,0)/v.length:null};
  const a=avg(0,7),p=avg(7,14);let s;
  if(a){s=`7-day avg ${a.toFixed(1)} lb`;
    if(p){const d=a-p;s+=` · ${d>=0?'+':''}${d.toFixed(1)} vs last week`;if(d<-0.05&&a>g)s+=` · ~${Math.round((a-g)/-d)} wks to ${g}`}
