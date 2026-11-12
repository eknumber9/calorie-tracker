  toast(`Deleted "${gone.name}"`,()=>{day(date).entries.splice(i,0,gone);saveDay(date);render()});
};

/* ---------- my foods ---------- */
function renderLib(){
  const q=$('libQ').value.trim().toLowerCase();
  const items=S.library.filter(f=>!q||f.name.toLowerCase().includes(q));
  $('libList').innerHTML=items.length?items.map(f=>{const i=S.library.indexOf(f);return`<div class="food"><button class="main" data-lib="${i}"><span class="fn">${esc(f.name)}${f.serving?` <small style="color:var(--muted)">${esc(f.serving)}</small>`:''}</span><span class="fk">${fmt(f.cal)} cal</span></button><button class="rm" data-librm="${i}" aria-label="Remove">✕</button></div>`}).join('')
    :`<p class="empty">${S.library.length?'No matches.':'Foods you log show up here for one-tap adding.'}</p>`;
}
$('libQ').oninput=renderLib;
$('libList').onclick=e=>{
  const rm=e.target.closest('[data-librm]');if(rm){S.library.splice(+rm.dataset.librm,1);saveLib();renderLib();return}
  const b=e.target.closest('[data-lib]');if(b){const f=S.library[+b.dataset.lib];close();addEntries([f],S.meal)}
};

/* ---------- results list (scan / photo / describe) ---------- */
function errMsg(e){return(e&&e.message)||'Something went wrong.'}
function renderEst(){
  if(!S.est.length){$('estOut').innerHTML='';return}
  const tot=S.est.filter(i=>i.on).reduce((a,i)=>a+i.cal*(i.qty||0),0);
  $('estOut').innerHTML=(S.estNote?`<p class="hint" style="margin-top:12px">${esc(S.estNote)}</p>`:'')+
    S.est.map((i,k)=>`<div class="res"><input type="checkbox" data-k="${k}" ${i.on?'checked':''}><div class="rn"><input data-name="${k}" value="${esc(i.name)}"><small>${i.serving?esc(i.serving)+' · ':''}${fmt(i.cal)} cal · P ${i.p} · C ${i.c} · F ${i.f}</small></div><div class="rq"><input data-q="${k}" inputmode="decimal" value="${i.qty}"><small>servings</small></div></div>`).join('')+
    `<button class="btn" id="estAdd">Add ${fmt(tot)} cal to ${S.meal}</button><p class="hint">Tap an entry later to fine-tune it.</p>`;
}
$('estOut').onchange=e=>{const t=e.target;
  if(t.dataset.k!=null)S.est[+t.dataset.k].on=t.checked;
  if(t.dataset.name!=null)S.est[+t.dataset.name].name=t.value;
  if(t.dataset.q!=null)S.est[+t.dataset.q].qty=num(t.value);
  renderEst()};
$('estOut').onclick=e=>{if(e.target.id==='estAdd'){const sel=S.est.filter(i=>i.on&&i.qty>0);if(!sel.length)return;close();addEntries(sel,S.meal);S.est=[];S.estNote='';$('estOut').innerHTML='';$('estText').value='';$('photoNote').value='';pstatus('')}};

/* ---------- barcode decoding ---------- */
let zReader=null;
function decodeBarcode(canvas){
  try{const Z=window.ZXing;if(!Z)return null;
    if(!zReader){const hints=new Map();
      hints.set(Z.DecodeHintType.POSSIBLE_FORMATS,[Z.BarcodeFormat.EAN_13,Z.BarcodeFormat.EAN_8,Z.BarcodeFormat.UPC_A,Z.BarcodeFormat.UPC_E,Z.BarcodeFormat.CODE_128]);
      hints.set(Z.DecodeHintType.TRY_HARDER,true);zReader=new Z.MultiFormatReader();zReader.setHints(hints)}
    return zReader.decode(new Z.BinaryBitmap(new Z.HybridBinarizer(new Z.HTMLCanvasElementLuminanceSource(canvas)))).getText();
  }catch(e){return null}
}

/* ---------- live scanner ---------- */
let stream=null,scanTimer=null;const scanCanvas=document.createElement('canvas');
async function openScanner(){
  $('scanner').classList.add('show');$('scanMsg').textContent='Line up the barcode in the box';
  try{
    stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment',width:{ideal:1920},height:{ideal:1080}},audio:false});
    const v=$('vid');v.srcObject=stream;await v.play();scanLoop();
  }catch(e){$('scanMsg').textContent='Camera blocked. Allow camera access for this app in iPhone Settings, then try again.'}
}
function stopScanner(){clearTimeout(scanTimer);if(stream)stream.getTracks().forEach(t=>t.stop());stream=null;$('vid').srcObject=null;$('scanner').classList.remove('show')}
function scanLoop(){
  if(!stream)return;const v=$('vid');
  if(v.videoWidth){
    const w=v.videoWidth,h=v.videoHeight,cw=Math.round(w*0.85),ch=Math.round(Math.min(h*0.4,cw*0.7)),k=Math.min(1,900/cw);
    scanCanvas.width=Math.round(cw*k);scanCanvas.height=Math.round(ch*k);
    scanCanvas.getContext('2d').drawImage(v,(w-cw)/2,(h-ch)/2,cw,ch,0,0,scanCanvas.width,scanCanvas.height);
    const code=decodeBarcode(scanCanvas);
    if(code){try{navigator.vibrate&&navigator.vibrate(40)}catch(e){}stopScanner();onCode(code);return}
  }
  scanTimer=setTimeout(scanLoop,120);
}
$('scanBtn').onclick=openScanner;
$('scanClose').onclick=stopScanner;

/* ---------- barcode → nutrition ---------- */
function fetchJSON(url,ms=9000){const ac=new AbortController(),t=setTimeout(()=>ac.abort(),ms);return fetch(url,{signal:ac.signal}).then(r=>r.ok?r.json():null).catch(()=>null).finally(()=>clearTimeout(t))}
function n(x){const v=parseFloat(x);return isFinite(v)?v:null}
async function lookupOFF(code){
  const j=await fetchJSON(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=product_name,brands,serving_size,serving_quantity,nutriments`);
  if(!j||j.status!==1||!j.product)return null;
  const p=j.product,nu=p.nutriments||{},v=k=>n(nu[k]);
  const k100=v('energy-kcal_100g')??(v('energy_100g')!=null?v('energy_100g')/4.184:null);
  const qty=n(p.serving_quantity);let per=null,serving=p.serving_size||'';
  if(v('energy-kcal_serving')!=null)per={cal:v('energy-kcal_serving'),p:v('proteins_serving')||0,c:v('carbohydrates_serving')||0,f:v('fat_serving')||0};
