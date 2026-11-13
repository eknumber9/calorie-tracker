  $('photoSub').parentNode.querySelector('b').textContent=S.key?'Photo of label or plate':'Photo of barcode';
  $('photoSub').textContent=S.pendingCode?`Snap the Nutrition Facts label to save barcode ${S.pendingCode}`:(S.key?'Barcode, Nutrition Facts or your plate':'Opens the camera app, no permission pop-up');
}
function pstatus(h){$('photoStatus').innerHTML=h||''}
function loadImg(file){return new Promise((res,rej)=>{const url=URL.createObjectURL(file),img=new Image();img.onload=()=>res({img,url});img.onerror=()=>{URL.revokeObjectURL(url);rej({message:"Couldn't open that photo."})};img.src=url})}
function toCanvas(img,max){const k=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight)),c=document.createElement('canvas');c.width=Math.round(img.naturalWidth*k);c.height=Math.round(img.naturalHeight*k);c.getContext('2d').drawImage(img,0,0,c.width,c.height);return c}
$('photoIn').onchange=async e=>{
  const file=e.target.files&&e.target.files[0];e.target.value='';if(!file)return;
  const lbl=$('shootLbl');lbl.classList.add('busy');S.est=[];S.estNote='';renderEst();pstatus('<span class="spin"></span>Reading photo…');
  let url;
  try{
    const r0=await loadImg(file);url=r0.url;const img=r0.img;
    let code=decodeBarcode(toCanvas(img,1600))||decodeBarcode(toCanvas(img,900));
    if(code&&!S.pendingCode){const hit=findLib(code);if(hit)return showFound(hit,code)}
    if(!S.key){if(code){pstatus('');await onCode(code)}else pstatus("Couldn't read a barcode. Fill the frame with the bars and hold steady.");return}
    const blob=await new Promise(r=>toCanvas(img,1400).toBlob(r,'image/jpeg',0.85));
    const note=$('photoNote').value.trim();
    const r=await askClaude(`Look at this photo for a calorie tracking app. It shows one of: (a) a Nutrition Facts label, (b) a product package or barcode with no nutrition label visible, or (c) food on a plate / a meal.
Respond with JSON only, exactly this shape:
{"kind":"label"|"meal"|"barcode_only"|"unknown","items":[{"name":"string","serving":"string","calories":0,"protein":0,"carbs":0,"fat":0}]}
Rules:
- label: one item with the PER-SERVING values exactly as printed. name = the product name if visible, else a short description like "Granola (packaged)". serving = the printed serving size, e.g. "2/3 cup (55g)".
- meal: one item per distinct food you can see, estimating the portion shown; serving describes that portion, e.g. "about 8 oz".
- barcode_only: items is empty.
- Whole numbers; macros in grams.${note?`\nThe person added this note: ${note}`:''}`,blob);
    const items=mapItems(r);
    if(r.kind==='label'&&items.length){
      const bc=S.pendingCode||code;if(bc)items.forEach(i=>i.barcode=bc);
      S.pendingCode=null;S.est=items;S.estNote=bc?'Read from the label and saved to this barcode, so the next scan is instant.':'Read from the label.';
    }else if(items.length){S.est=items;S.estNote=r.kind==='meal'?'Estimated from your photo. Adjust servings if needed.':''}
    else if(code){await onCode(code);return}
    else{pstatus("Couldn't find food or a label in that photo. Try again closer up.");return}
    setShoot();pstatus('');renderEst();
  }catch(err){pstatus(esc(errMsg(err)))}
  finally{lbl.classList.remove('busy');if(url)URL.revokeObjectURL(url)}
};

/* ---------- settings & data ---------- */
$('gear').onclick=()=>{const s=S.settings;$('gCal').value=s.goal;$('gP').value=s.p;$('gC').value=s.c;$('gF').value=s.f;$('gW').value=s.w||190;$('gKey').value=S.key;open('setSheet')};
$('useRec').onclick=()=>{$('gCal').value=DEF.goal;$('gP').value=DEF.p;$('gC').value=DEF.c;$('gF').value=DEF.f;$('gW').value=DEF.w};
$('saveGoals').onclick=()=>{
  S.settings={goal:rnd(num($('gCal').value))||DEF.goal,p:rnd(num($('gP').value)),c:rnd(num($('gC').value)),f:rnd(num($('gF').value)),w:num($('gW').value)||DEF.w};
  S.key=$('gKey').value.trim();try{S.key?localStorage.setItem(P+'apikey',S.key):localStorage.removeItem(P+'apikey')}catch(e){}
  saveSettings();render();close();toast('Saved')};
function download(name,text,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000)}
$('backupBtn').onclick=()=>{
  const data={app:'calorie-tracker',version:1,exported:new Date().toISOString(),settings:S.settings,library:S.library,weights:S.weights,days:allDays()};
  download(`calories-backup-${ymd(new Date())}.json`,JSON.stringify(data),'application/json');
};
$('restoreIn').onchange=async e=>{
  const f=e.target.files&&e.target.files[0];e.target.value='';if(!f)return;
  try{const d=JSON.parse(await f.text());if(d.app!=='calorie-tracker')throw 0;
    if(d.settings)LS.set('settings',d.settings);if(Array.isArray(d.library))LS.set('library',{items:d.library});if(d.weights)LS.set('weights',{items:d.weights});
    Object.entries(d.days||{}).forEach(([k,v])=>{if(v&&Array.isArray(v.entries))LS.set('d-'+k,v)});
    location.reload();
  }catch(err){toast("That isn't a backup file from this app")}
};
$('exportBtn').onclick=()=>{
  const rows=[['date','meal','food','calories','protein_g','carbs_g','fat_g']],days=allDays();
  Object.keys(days).sort().forEach(d=>(days[d].entries||[]).forEach(e=>rows.push([d,e.meal,e.name,e.cal,e.p,e.c,e.f])));
  download(`calorie-log-${ymd(new Date())}.csv`,rows.map(r=>r.map(v=>/[",\n]/.test(String(v))?'"'+String(v).replace(/"/g,'""')+'"':v).join(',')).join('\n'),'text/csv');
};

/* ---------- toast ---------- */
let tt;function toast(msg,undo){const t=$('toast');$('toastMsg').textContent=msg;const b=$('toastBtn');b.style.display=undo?'':'none';b.onclick=()=>{undo&&undo();t.classList.remove('show')};t.classList.add('show');clearTimeout(tt);tt=setTimeout(()=>t.classList.remove('show'),4000)}

/* ---------- app icon (drawn here so no image files are needed) ---------- */
(function(){try{const c=document.createElement('canvas');c.width=c.height=180;const x=c.getContext('2d');
x.fillStyle='#101216';x.fillRect(0,0,180,180);x.lineWidth=18;x.lineCap='round';
x.strokeStyle='#2c3038';x.beginPath();x.arc(90,90,52,0,Math.PI*2);x.stroke();
x.strokeStyle='#4ade80';x.beginPath();x.arc(90,90,52,-Math.PI/2,Math.PI);x.stroke();
x.fillStyle='#4ade80';x.beginPath();x.arc(90,90,11,0,Math.PI*2);x.fill();
const u=c.toDataURL('image/png');['apple-touch-icon','icon'].forEach(r=>{const l=document.createElement('link');l.rel=r;l.href=u;document.head.appendChild(l)})}catch(e){}})();

/* ---------- boot ---------- */
const ls=LS.get('settings');if(ls&&ls.goal)S.settings={...DEF,...ls};
const ll=LS.get('library');if(ll&&Array.isArray(ll.items))S.library=ll.items;
const lw=LS.get('weights');if(lw&&lw.items)S.weights=lw.items;
try{S.key=localStorage.getItem(P+'apikey')||''}catch(e){}
setMeal(S.meal);render();
try{navigator.storage&&navigator.storage.persist&&navigator.storage.persist()}catch(e){}
if('serviceWorker'in navigator&&location.protocol==='https:')navigator.serviceWorker.register('sw.js').catch(()=>{});
