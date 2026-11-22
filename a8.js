/* ---------- weight graph ---------- */
const WR=[['2W',14],['1M',30],['3M',91],['6M',182],['1Y',365],['All',0]];
let wRange=30;try{wRange=+localStorage.getItem(P+'wrange')||30}catch(e){}
(function(){
  const sec=$('wIn').closest('section'),h=sec.querySelector('h3');
  h.style.cssText='display:flex;justify-content:space-between;align-items:center';
  h.insertAdjacentHTML('beforeend','<button id="wGraphBtn" style="font-size:14px;font-weight:600;color:var(--accent)">Graph ›</button>');
  const sh=document.createElement('div');sh.className='sheet';sh.id='wSheet';
  sh.innerHTML='<div class="grab"></div><div class="shead"><h2>Bodyweight</h2><button class="x" id="wClose">✕</button></div><div class="seg" id="wSeg"></div><div id="wRead" style="min-height:44px"></div><div id="wChart" style="touch-action:none"></div><div id="wStats" style="margin-top:10px;display:grid;grid-template-columns:repeat(4,1fr);gap:8px"></div><div id="wList" style="margin-top:12px"></div>';
  document.body.appendChild(sh);
  const st=document.createElement('style');
  st.textContent='#wStats>div{background:var(--card2);border-radius:12px;padding:8px}#wStats small{color:var(--muted);display:block;font-size:11px}#wStats b{font-size:15px}#wList .wr{display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid var(--line);font-size:15px}#wList .wr button{color:var(--muted);padding:0 4px}';
  document.head.appendChild(st);
})();
function wSeries(){
  const keys=Object.keys(S.weights).filter(k=>S.weights[k]>0).sort();if(!keys.length)return{pts:[],start:null};
  const today=ymd(new Date()),start=wRange?addDays(today,-(wRange-1)):keys[0];
  const avg7=d=>{let s=0,n=0;for(let i=0;i<7;i++){const v=S.weights[addDays(d,-i)];if(v>0){s+=v;n++}}return n?s/n:null};
  const pts=keys.filter(k=>k>=start&&k<=today).map(k=>({d:k,w:S.weights[k],a:avg7(k)}));
  return{pts,start,end:today};
}
function dayIdx(a,b){return Math.round((parseD(b)-parseD(a))/864e5)}
function shortD(s,yr){return parseD(s).toLocaleDateString(undefined,yr?{month:'short',day:'numeric',year:'2-digit'}:{month:'short',day:'numeric'})}
function readout(p){
  $('wRead').innerHTML=p?`<div style="font-size:26px;font-weight:800">${p.w.toFixed(1)} lb</div><div class="hint" style="margin:0">${parseD(p.d).toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'})} · 7-day avg ${p.a.toFixed(1)}</div>`:'<p class="empty">No weigh-ins in this range yet.</p>';
}
function renderWChart(){
  $('wSeg').innerHTML=WR.map(([l,n])=>`<button data-wr="${n}" class="${n===wRange?'on':''}">${l}</button>`).join('');
  const {pts,start,end}=wSeries(),g=S.settings.w||190;
  if(!pts.length){readout(null);$('wChart').innerHTML='';$('wStats').innerHTML='';$('wList').innerHTML='';return}
  const W=340,H=200,L=36,R=8,T=10,B=24,span=Math.max(1,dayIdx(start,end));
  let lo=Math.min(...pts.map(p=>Math.min(p.w,p.a))),hi=Math.max(...pts.map(p=>Math.max(p.w,p.a)));
  if(g>=lo-3&&g<=hi+3){lo=Math.min(lo,g);hi=Math.max(hi,g)}
  lo=Math.floor(lo-1);hi=Math.ceil(hi+1);
  const X=d=>L+(W-L-R)*dayIdx(start,d)/span,Y=v=>T+(H-T-B)*(hi-v)/(hi-lo);
  const step=(hi-lo)>20?5:(hi-lo)>8?2:1;let grid='';
  for(let v=Math.ceil(lo/step)*step;v<=hi;v+=step)grid+=`<line x1="${L}" x2="${W-R}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--line)" stroke-width="1"/><text x="${L-5}" y="${Y(v)+4}" text-anchor="end" font-size="10" fill="var(--muted)">${v}</text>`;
  const yr=parseD(start).getFullYear()!==parseD(end).getFullYear();
  const xl=[start,addDays(start,Math.round(span/2)),end].map((d,i)=>`<text x="${X(d)}" y="${H-6}" text-anchor="${['start','middle','end'][i]}" font-size="10" fill="var(--muted)">${shortD(d,yr)}</text>`).join('');
  const gl=g>=lo&&g<=hi?`<line x1="${L}" x2="${W-R}" y1="${Y(g)}" y2="${Y(g)}" stroke="var(--accent)" stroke-dasharray="4 4" stroke-width="1"/><text x="${W-R}" y="${Y(g)-4}" text-anchor="end" font-size="10" fill="var(--accent)">goal ${g}</text>`:'';
  const raw=pts.map((p,i)=>(i?'L':'M')+X(p.d).toFixed(1)+' '+Y(p.w).toFixed(1)).join(' ');
  const av=pts.map((p,i)=>(i?'L':'M')+X(p.d).toFixed(1)+' '+Y(p.a).toFixed(1)).join(' ');
  const r=pts.length>90?1.6:2.6;
  $('wChart').innerHTML=`<svg id="wSvg" viewBox="0 0 ${W} ${H}" width="100%" style="display:block">${grid}${xl}${gl}
    <path d="${raw}" fill="none" stroke="var(--muted)" stroke-width="1" opacity=".6"/>${pts.map(p=>`<circle cx="${X(p.d).toFixed(1)}" cy="${Y(p.w).toFixed(1)}" r="${r}" fill="var(--text)" opacity=".75"/>`).join('')}
    <path d="${av}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round"/>
    <line id="wCur" x1="0" x2="0" y1="${T}" y2="${H-B}" stroke="var(--text)" stroke-width="1" opacity="0"/></svg>
    <div class="hint" style="margin:4px 0 0">Dots: daily weigh-ins · Green line: 7-day average${gl?' · Dashed: goal':''}</div>`;
  const svg=$('wSvg'),cur=$('wCur');
  const pick=e=>{const bx=svg.getBoundingClientRect(),x=(e.clientX-bx.left)/bx.width*W;let best=pts[0];for(const p of pts)if(Math.abs(X(p.d)-x)<Math.abs(X(best.d)-x))best=p;
    cur.setAttribute('x1',X(best.d));cur.setAttribute('x2',X(best.d));cur.setAttribute('opacity','.4');readout(best)};
  svg.onpointerdown=e=>{svg.setPointerCapture(e.pointerId);pick(e)};svg.onpointermove=e=>{if(e.buttons||e.pointerType==='touch')pick(e)};
  readout(pts[pts.length-1]);
  // stats: change on the 7-day average; rate from a straight-line fit
  const n=pts.length,first=pts[0],last=pts[n-1];let rate=null;
  if(n>=3&&span>=6){const xs=pts.map(p=>dayIdx(start,p.d)),mx=xs.reduce((a,b)=>a+b)/n,my=pts.reduce((a,p)=>a+p.w,0)/n;let sxy=0,sxx=0;pts.forEach((p,i)=>{sxy+=(xs[i]-mx)*(p.w-my);sxx+=(xs[i]-mx)**2});if(sxx)rate=sxy/sxx*7}
  const ch=last.a-first.a,sg=v=>(v>0?'+':'')+v.toFixed(1);
  $('wStats').innerHTML=`<div><small>Change</small><b>${n>1?sg(ch):'–'}</b></div><div><small>Per week</small><b>${rate==null?'–':sg(rate)}</b></div><div><small>Low</small><b>${Math.min(...pts.map(p=>p.w)).toFixed(1)}</b></div><div><small>High</small><b>${Math.max(...pts.map(p=>p.w)).toFixed(1)}</b></div>`;
  $('wList').innerHTML='<label class="f">Weigh-ins</label>'+pts.slice().reverse().slice(0,60).map(p=>`<div class="wr"><span>${parseD(p.d).toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'})}</span><span><b>${p.w.toFixed(1)}</b> lb <button data-wdel="${p.d}" aria-label="Delete">✕</button></span></div>`).join('');
}
$('wGraphBtn').onclick=()=>{renderWChart();open('wSheet')};
$('wClose').onclick=close;
$('wSeg').onclick=e=>{const b=e.target.closest('[data-wr]');if(!b)return;wRange=+b.dataset.wr;try{localStorage.setItem(P+'wrange',wRange)}catch(x){}renderWChart()};
$('wList').onclick=e=>{const b=e.target.closest('[data-wdel]');if(!b)return;const d=b.dataset.wdel,v=S.weights[d];delete S.weights[d];saveWeights();renderWChart();renderWeight();
  toast(`Deleted ${v} lb on ${shortD(d)}`,()=>{S.weights[d]=v;saveWeights();renderWChart();renderWeight()})};
})();
