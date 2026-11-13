    else if(a>g)s+=` · ${(a-g).toFixed(1)} lb to ${g}`;
  }else s='Weigh in most mornings. The weekly average tells you when to adjust calories.';
  $('wSub').textContent=s;
}
$('wBtn').onclick=()=>{const v=num($('wIn').value);if(v<50){$('wIn').focus();return}S.weights[S.date]=Math.round(v*10)/10;saveWeights();$('wIn').value='';$('wIn').blur();renderWeight();toast('Weight logged')};

/* ---------- navigation ---------- */
function go(s){S.date=s;render()}
$('prev').onclick=()=>go(addDays(S.date,-1));
$('next').onclick=()=>go(addDays(S.date,1));
$('dateLabel').onclick=()=>go(ymd(new Date()));
$('bars').onclick=e=>{const b=e.target.closest('[data-go]');if(b)go(b.dataset.go)};
document.addEventListener('visibilitychange',()=>{if(!document.hidden)render()});

/* ---------- sheets ---------- */
let openSheet=null;
function open(id){openSheet=$(id);$('scrim').classList.add('show');openSheet.classList.add('show')}
function close(){if(openSheet)openSheet.classList.remove('show');$('scrim').classList.remove('show');openSheet=null}
$('scrim').onclick=close;document.querySelectorAll('[data-close]').forEach(b=>b.onclick=close);

function setMeal(m){S.meal=m;$('mealSeg').innerHTML=MEALS.map(x=>`<button data-meal="${x}" class="${x===m?'on':''}">${x}</button>`).join('')}
$('mealSeg').onclick=e=>{const b=e.target.closest('[data-meal]');if(b){setMeal(b.dataset.meal);if(S.est.length)renderEst()}};
function setTab(t){S.tab=t;document.querySelectorAll('#tabs button').forEach(b=>b.classList.toggle('on',b.dataset.tab===t));['photo','est','man','lib'].forEach(x=>$('pane-'+x).classList.toggle('on',x===t));$('estOut').style.display=(t==='photo'||t==='est')?'':'none';if(t==='lib')renderLib();if(t==='man')setManCode()}
$('tabs').onclick=e=>{const b=e.target.closest('[data-tab]');if(b)setTab(b.dataset.tab)};

function openAdd(meal){
  S.editing=null;setMeal(meal||defaultMeal());$('addTitle').textContent='Add food';$('tabsWrap').style.display='';
  ['mName','mCal','mP','mC','mF'].forEach(i=>$(i).value='');$('mSrv').value='1';$('manBtn').textContent='Add';$('delBtn').style.display='none';
  const hasKey=!!S.key;$('tabEst').style.display=hasKey?'':'none';$('shootLbl').style.display='';
  setShoot();setTab('photo');open('addSheet');
}
function openEdit(id){
  const e=day(S.date).entries.find(x=>x.id===id);if(!e)return;S.editing=id;setMeal(e.meal);
  $('addTitle').textContent='Edit entry';$('tabsWrap').style.display='none';
  $('mName').value=e.name;$('mCal').value=e.cal;$('mP').value=e.p;$('mC').value=e.c;$('mF').value=e.f;$('mSrv').value='1';
  $('manBtn').textContent='Save';$('delBtn').style.display='block';setTab('man');$('manCode').textContent='';$('estOut').style.display='none';open('addSheet');
}
$('fab').onclick=()=>openAdd();
$('meals').onclick=e=>{const a=e.target.closest('[data-addmeal]');if(a)return openAdd(a.dataset.addmeal);const ed=e.target.closest('[data-edit]');if(ed)openEdit(ed.dataset.edit)};

/* ---------- adding ---------- */
function normCode(c){return String(c||'').replace(/\D/g,'').replace(/^0+/,'')}
function findLib(code){const n=normCode(code);return n?S.library.find(f=>f.barcode&&normCode(f.barcode)===n):null}
function remember(x){
  const key=(x.name||'').trim().toLowerCase();if(!key)return;
  let i=x.barcode?S.library.findIndex(f=>f.barcode&&normCode(f.barcode)===normCode(x.barcode)):-1;
  if(i<0)i=S.library.findIndex(f=>f.name.trim().toLowerCase()===key);
  const prev=i>=0?S.library[i]:null;
  const item={name:x.name.trim(),cal:rnd(x.cal),p:rnd(x.p),c:rnd(x.c),f:rnd(x.f),serving:x.serving||(prev&&prev.serving)||'',barcode:x.barcode||(prev&&prev.barcode)||'',t:Date.now(),n:prev?(prev.n||1)+1:1};
  if(i>=0)S.library.splice(i,1);S.library.unshift(item);S.library=S.library.slice(0,300);
}
// items carry per-serving values plus qty (servings)
function addEntries(list,meal,{rememberFoods=true}={}){
  const d=day(S.date),ids=[];let sum=0;
  list.forEach(x=>{const q=x.qty>0?x.qty:1,nm=(x.name||'Food').trim();
    const e={id:uid(),name:q!==1?`${nm} ×${+q.toFixed(2)}`:nm,cal:rnd(x.cal*q),p:rnd(x.p*q),c:rnd(x.c*q),f:rnd(x.f*q),meal,t:Date.now()};
    sum+=e.cal;d.entries.push(e);ids.push(e.id);if(rememberFoods)remember(x)});
  saveDay(S.date);if(rememberFoods)saveLib();render();
  const date=S.date;
  toast(`Added ${list.length>1?list.length+' items':'"'+list[0].name+'"'} · ${fmt(sum)} cal`,()=>{const dd=day(date);dd.entries=dd.entries.filter(e=>!ids.includes(e.id));saveDay(date);render()});
}
function setManCode(){$('manCode').textContent=S.pendingCode&&!S.editing?`Will be saved to barcode ${S.pendingCode} for instant scans next time.`:''}
$('manBtn').onclick=()=>{
  const name=$('mName').value.trim(),s=num($('mSrv').value)||1;
  const x={name:name||'Quick add',cal:num($('mCal').value),p:num($('mP').value),c:num($('mC').value),f:num($('mF').value),qty:s};
  if(!x.cal&&!x.p&&!x.c&&!x.f){$('mCal').focus();return}
  if(S.editing){const d=day(S.date),e=d.entries.find(q=>q.id===S.editing);if(e){Object.assign(e,{name:x.name,cal:rnd(x.cal*s),p:rnd(x.p*s),c:rnd(x.c*s),f:rnd(x.f*s),meal:S.meal});saveDay(S.date);render()}close();return}
  if(S.pendingCode&&name){x.barcode=S.pendingCode;S.pendingCode=null}
  close();addEntries([x],S.meal,{rememberFoods:!!name});
};
$('delBtn').onclick=()=>{
  const d=day(S.date),i=d.entries.findIndex(q=>q.id===S.editing);if(i<0)return close();
  const [gone]=d.entries.splice(i,1),date=S.date;saveDay(date);render();close();
