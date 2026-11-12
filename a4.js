  else if(k100!=null&&qty>0){const s=qty/100;per={cal:k100*s,p:(v('proteins_100g')||0)*s,c:(v('carbohydrates_100g')||0)*s,f:(v('fat_100g')||0)*s}}
  else if(k100!=null){per={cal:k100,p:v('proteins_100g')||0,c:v('carbohydrates_100g')||0,f:v('fat_100g')||0};serving='100 g'}
  if(!per)return null;
  const brand=String(p.brands||'').split(',')[0].trim(),nm=String(p.product_name||'').trim()||'Unknown product';
  return{name:brand&&!nm.toLowerCase().includes(brand.toLowerCase())?`${brand} ${nm}`:nm,serving,cal:rnd(per.cal),p:rnd(per.p),c:rnd(per.c),f:rnd(per.f),src:'Open Food Facts'};
}
async function lookupUSDA(code){
  const j=await fetchJSON(`https://api.nal.usda.gov/fdc/v1/foods/search?query=${code}&dataType=Branded&pageSize=5&api_key=DEMO_KEY`);
  const f=j&&Array.isArray(j.foods)?j.foods.find(x=>normCode(x.gtinUpc)===normCode(code)):null;if(!f)return null;
  const per100={cal:0,p:0,c:0,f:0};
  (f.foodNutrients||[]).forEach(x=>{const v=n(x.value)||0;({'208':()=>per100.cal=v,'203':()=>per100.p=v,'205':()=>per100.c=v,'204':()=>per100.f=v}[x.nutrientNumber]||(()=>{}))()});
  const size=n(f.servingSize),unit=String(f.servingSizeUnit||'').toLowerCase();
  const s=size>0&&['g','grm','ml','mlt'].includes(unit)?size/100:1;
  const tc=t=>String(t||'').toLowerCase().replace(/\b\w/g,c=>c.toUpperCase());
  const brand=tc(f.brandName||f.brandOwner),nm=tc(f.description)||'Product';
  return{name:brand?`${brand} ${nm}`:nm,serving:s===1?'100 g':[f.householdServingFullText,`${size} ${unit.startsWith('m')?'ml':'g'}`].filter(Boolean).join(' · '),cal:rnd(per100.cal*s),p:rnd(per100.p*s),c:rnd(per100.c*s),f:rnd(per100.f*s),src:'USDA'};
}
function codeVariants(c){const v=[c];if(c.length===13&&c[0]==='0')v.push(c.slice(1));if(c.length===12)v.push('0'+c);return v}
function showFound(hit,code){S.est=[{...hit,qty:1,on:true}];S.estNote=`Barcode ${code}: from My foods.`;S.pendingCode=null;setShoot();pstatus('');renderEst()}
async function onCode(raw){
  const code=String(raw).replace(/\D/g,'');if(!code)return;
  S.est=[];S.estNote='';renderEst();
  const hit=findLib(code);if(hit)return showFound(hit,code);
  pstatus(`<span class="spin"></span>Looking up ${esc(code)}…`);
  let item=null;for(const c of codeVariants(code)){item=await lookupOFF(c);if(item)break}
  if(!item)item=await lookupUSDA(code);
  if(item){S.est=[{...item,barcode:code,qty:1,on:true}];S.estNote=`Found in ${item.src}. Check it against the package; it's saved for next time.`;S.pendingCode=null;setShoot();pstatus('');renderEst();return}
  S.pendingCode=code;setShoot();
  pstatus(`No match for ${esc(code)}. ${S.key?'Snap the Nutrition Facts label below, or enter it on the Manual tab.':'Enter it from the label on the Manual tab.'} It'll be saved to this barcode.`);
}

/* ---------- Claude (optional, your own API key) ---------- */
function blobToB64(b){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(String(r.result).split(',')[1]);r.onerror=rej;r.readAsDataURL(b)})}
async function askClaude(prompt,blob){
  if(!S.key)throw{message:'Add your Anthropic API key in Settings.'};
  const content=[];if(blob)content.push({type:'image',source:{type:'base64',media_type:'image/jpeg',data:await blobToB64(blob)}});
  content.push({type:'text',text:prompt});
  let r;
  try{r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'x-api-key':S.key,'anthropic-version':'2023-06-01','content-type':'application/json','anthropic-dangerous-direct-browser-access':'true'},body:JSON.stringify({model:'claude-haiku-5-5',max_tokens:1024,messages:[{role:'user',content}]})})}
  catch(e){throw{message:'No connection.'}}
  const j=await r.json().catch(()=>null);
  if(!r.ok)throw{message:(j&&j.error&&j.error.message)||`Claude request failed (${r.status}).`};
  const t=(j.content||[]).map(c=>c.text||'').join(''),m=t.match(/\{[\s\S]*\}/);
  if(!m)throw{message:'No estimate came back. Try again.'};return JSON.parse(m[0]);
}
function mapItems(r){return(Array.isArray(r.items)?r.items:[]).map(i=>({name:String(i.name||'Food'),serving:String(i.serving||''),cal:rnd(i.calories),p:rnd(i.protein),c:rnd(i.carbs),f:rnd(i.fat),qty:1,on:true}))}
async function estimate(){
  const text=$('estText').value.trim();if(!text)return;
  const btn=$('estBtn');btn.disabled=true;btn.innerHTML='<span class="spin"></span>Estimating…';S.est=[];renderEst();
  try{
    const r=await askClaude(`You estimate nutrition for a calorie tracking app. Estimate calories and macronutrients for the food described below.
Split it into separate items when several foods are listed. Honor any amounts, brands or restaurants mentioned; when no amount is given, assume a typical single US portion and describe that portion in "serving".
Respond with JSON only, exactly this shape: {"items":[{"name":"string","serving":"string","calories":0,"protein":0,"carbs":0,"fat":0}]}. Macros in grams, whole numbers.

Food eaten: ${text}`);
    S.est=mapItems(r);S.estNote='';if(!S.est.length)throw{message:'No estimate came back. Try rewording.'};renderEst();
  }catch(e){$('estOut').innerHTML=`<p class="hint">${esc(errMsg(e))}</p>`}
  finally{btn.disabled=false;btn.textContent='Estimate calories'}
}
$('estBtn').onclick=estimate;

function setShoot(){
  $('shootTitle').textContent='Scan a barcode';
  $('shootSub').textContent='Point your camera at the barcode';
