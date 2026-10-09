/* となりずむ 噂信憑性ヒートマップ（/rumorslist）
 * 原本：widgets/rumors-heatmap/heatmap.js（はてなの固定ページには読み込みタグだけを置く）
 * 公開：bash widgets/rumors-heatmap/publish.sh <版>  → https://po-3.github.io/tonarism/rumors-heatmap.<版>.js
 * 運用メモ：widgets/rumors-heatmap/README.md
 */
(function(){
"use strict";
if(!document.getElementById("tm2")) return;

/* ===== 設定（ここだけ触れば表示が変わる） ===== */
// データ：毎日自動更新されるGist（生成元は未特定。README参照）
const DATA_URL = "https://gist.githubusercontent.com/Po-3/73b7329df525884309ade695a7657ee5/raw/rumors.json";
// 信憑レベルの表示名。5でも「確定」を連想させない（Appleが発表したものは confirmed=true で「公式発表済み」表示）
const LV = {5:"有力報道",4:"確度高い",3:"信憑性あり",2:"噂段階",1:"憶測"};
// 製品カテゴリの表示名と並び順
const CATS = {iphone:"iPhone",ipad:"iPad",mac:"Mac",ios:"OS",watch:"Watch",vision:"Vision",services:"サービス",audio:"Audio",home:"Home"};
// 分類の補正：データのcategoryは記事タイトルから付いていて外れが多い（例：LGのスマートホーム製品がiPhone）。
// 製品名と噂の文言を合わせた文で、最初に出てくる製品名のカテゴリにする。同じ位置なら長い一致を優先。
// 1件は1カテゴリ（複数製品の記事は先に出る製品になる）。直したら README の手順で全件の変化を確かめる
const CAT_RULES = [
  ["services", /Apple TV\+|Apple Music|Apple Pay|Apple One|Apple Card|Apple Arcade|iCloud|App Store/],
  ["home",     /HomePod|HomePad|ホームハブ|Apple TV|tvOS|homeOS|スマートホーム|ドアベル|スマートロック|サーモスタット|ホームアプリ/],
  ["vision",   /visionOS|Vision Pro|Vision Air|Apple Vision/],
  ["watch",    /watchOS|Apple Watch|Watch (?:Series|Ultra|SE)/],
  ["audio",    /AirPods|Beats/],
  ["ipad",     /iPadOS|iPad/],
  ["mac",      /macOS|Mac(?!Rumors)/],
  ["ios",      /iOS/],
  ["iphone",   /iPhone/]
];
const PERIODS = [["30","30日"],["90","90日"],["365","1年"],["all","すべて"]];
const HI_SRC = {bloomberg:1,kuo:1,code:1};   // 出典名を強調表示する種類
const PAGE = 30;                               // 一覧の1回の表示件数
/* ===== 設定ここまで ===== */

function fixCat(r){ const t=(r.product||"")+" "+(r.rumor||""); let b=null; for(const [c,re] of CAT_RULES){ const m=t.match(re); if(m&&(!b||m.index<b.i||(m.index===b.i&&m[0].length>b.l))) b={c,i:m.index,l:m[0].length}; } return b&&b.c!==r.category?{...r,category:b.c}:r; }
const D = {cat:"all", score:"all", period:"90", sort:"score", q:""};
let st = {...D}, all = [], NOW = new Date(), shown = PAGE;
const $ = s => document.querySelector(".tm2 "+s);
const esc = s => String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const age = d => (NOW-new Date(d))/864e5;
function daysAgo(d){ const n=Math.round(age(d)); return n<=0?"今日":n+"日前"; }
function fdate(s){ const d=new Date(s); return isNaN(d)?s:(d.getFullYear()===NOW.getFullYear()?"":d.getFullYear()+"/")+`${d.getMonth()+1}/${d.getDate()}`; }
function lvColor(s){ return getComputedStyle($(".summary")).getPropertyValue("--l"+s).trim(); }
function rgba(hex,a){ const n=parseInt(hex.replace("#",""),16); return `rgba(${n>>16},${n>>8&255},${n&255},${a})`; }

function card(r){
  const link=!!r.blog_url, tag=link?"a":"article";
  const lv=Math.min(5,Math.max(1,r.score|0));
  const prod=r.product&&!(r.rumor||"").startsWith(r.product)?"・"+esc(r.product):"";
  const flag=r.confirmed?`<span class="offbadge">公式発表済み</span>`:age(r.date)<=7?`<span class="newbadge">NEW</span>`:"";
  return `<${tag} class="card" style="--lv:var(--l${lv})"${link?` href="${esc(r.blog_url)}"`:""}>
    <div class="meter" aria-label="信憑スコア${lv}/5 ${LV[lv]}"><span class="num">${lv}<small>/5</small></span><span class="segs" aria-hidden="true">${Array.from({length:5},(_,i)=>`<i${i<lv?"":` class="off"`}></i>`).join("")}</span><span class="lvl">${LV[lv]}</span></div>
    <div class="main">
      <div class="top">${esc(CATS[r.category]||r.category||"")}${prod}</div>
      <div class="rtext">${esc(r.rumor||"")}</div>
      <div class="bottom">${flag}<span class="src${HI_SRC[r.source_type]?" hi":""}">${esc(r.source||"")}</span><span>${fdate(r.date)}（${daysAgo(r.date)}）</span></div>
    </div>${link?`<span class="chev" aria-hidden="true"></span>`:""}</${tag}>`;
}

const inPeriod = r => st.period==="all" || age(r.date) <= +st.period;
function base(){ // 期間・検索だけを当てた集合（ヒートマップの母数）
  let a=all.filter(inPeriod);
  if(st.q){ const t=st.q.toLowerCase(); a=a.filter(r=>((r.product||"")+" "+(r.rumor||"")+" "+(r.source||"")).toLowerCase().includes(t)); }
  return a;
}
function filtered(){
  let a=base();
  if(st.cat!=="all") a=a.filter(r=>r.category===st.cat);
  if(st.score!=="all") a=a.filter(r=>r.score===+st.score);
  if(st.sort==="score") a.sort((x,y)=>y.score-x.score||new Date(y.date)-new Date(x.date));
  else if(st.sort==="date") a.sort((x,y)=>new Date(y.date)-new Date(x.date));
  else a.sort((x,y)=>(x.product||"").localeCompare(y.product||"","ja"));
  return a;
}

function renderHeatmap(){
  const b=base(), cats=Object.keys(CATS).filter(c=>all.some(r=>r.category===c));
  const cs=getComputedStyle($("#hm")), h0=cs.getPropertyValue("--h0").trim(), h1=cs.getPropertyValue("--h1").trim();
  const hex=x=>{ const n=parseInt(x.replace("#",""),16); return [n>>16,n>>8&255,n&255]; }, A=hex(h0), B=hex(h1);
  const shade=t=>`rgb(${A.map((v,i)=>Math.round(v+(B[i]-v)*t)).join(",")})`;
  const cnt=(c,s)=>b.filter(r=>(c==="all"||r.category===c)&&r.score===s).length;
  let max=1; cats.forEach(c=>[5,4,3,2,1].forEach(s=>{ max=Math.max(max,cnt(c,s)); }));
  const cell=(c,s,k,m)=>{
    const lab=`${c==="all"?"全体":CATS[c]} ${LV[s]} ${k}件`;
    if(!k) return `<button class="hm-c z" type="button" disabled aria-label="${lab}"></button>`;
    const v=Math.sqrt(k/m), tt=.08+.92*v;
    const sel=st.cat===c&&st.score==s, dim=(c!=="all"&&st.cat!=="all"&&st.cat!==c)||(st.score!=="all"&&st.score!=s);
    return `<button class="hm-c${sel?" sel":""}${dim?" dim":""}" type="button" data-c="${c}" data-s="${s}" style="background:${shade(tt)};${tt>.6?"color:#fff":""}" aria-label="${lab}">${k}</button>`;
  };
  let h=`<span></span>`+[5,4,3,2,1].map(s=>`<span class="hm-h${st.score==s?" on":""}" data-s="${s}" role="button" tabindex="0"><i style="background:var(--l${s})"></i>${LV[s]}</span>`).join("");
  cats.forEach(c=>{
    h+=`<span class="hm-r${st.cat===c?" on":""}${st.cat!=="all"&&st.cat!==c?" dim":""}" data-c="${c}" role="button" tabindex="0">${CATS[c]}<small>${b.filter(r=>r.category===c).length}件</small></span>`+[5,4,3,2,1].map(s=>cell(c,s,cnt(c,s),max)).join("");
  });
  const tmax=Math.max(1,...[5,4,3,2,1].map(s=>cnt("all",s)));
  h+=`<span class="hm-line"></span><span class="hm-r${st.cat==="all"?"":" dim"}" data-c="all" role="button" tabindex="0">合計<small>${b.length}件</small></span>`+[5,4,3,2,1].map(s=>cell("all",s,cnt("all",s),tmax)).join("");
  $("#hm").innerHTML=h;
}

function chips(){
  const b=all.filter(inPeriod);
  $("#periods").innerHTML=PERIODS.map(([v,l])=>`<button class="${st.period===v?"active":""}" type="button" data-p="${v}" aria-pressed="${st.period===v}">${l}</button>`).join("");
  const cats=Object.keys(CATS).filter(c=>all.some(r=>r.category===c));
  $("#cats").innerHTML=`<button class="fbtn${st.cat==="all"?" active":""}" type="button" data-c="all">すべて<small>${b.length}</small></button>`
    +cats.map(c=>`<button class="fbtn${st.cat===c?" active":""}" type="button" data-c="${c}">${CATS[c]}<small>${b.filter(r=>r.category===c).length}</small></button>`).join("");
}

function syncHash(){
  const p=new URLSearchParams();
  Object.keys(D).forEach(k=>{ if(st[k]!==D[k]) p.set(k,st[k]); });
  const h=p.toString();
  history.replaceState(null,"",h?"#"+h:location.pathname+location.search);
}
function readHash(){
  const p=new URLSearchParams(location.hash.slice(1));
  Object.keys(D).forEach(k=>{ if(p.has(k)) st[k]=p.get(k); });
}

function render(keep){
  if(!keep) shown=PAGE;
  const a=filtered();
  $("#rumors").innerHTML=a.length?a.slice(0,shown).map(card).join(""):`<div class="empty">この条件に一致する噂はありません 👀<br><small>期間を「すべて」にするか、絞り込みを外してみてください。</small></div>`;
  const more=$(".more"); more.hidden=a.length<=shown; more.textContent=`もっと見る（残り${a.length-shown}件）`;
  $("#rcount").textContent=a.length;
  const parts=[];
  if(st.cat!=="all")parts.push(CATS[st.cat]||st.cat);
  if(st.score!=="all")parts.push(LV[st.score]);
  if(st.q)parts.push(`「${st.q}」`);
  $("#active-desc").textContent=parts.length?`（${parts.join(" × ")}）`:"";
  $(".reset-btn").hidden=JSON.stringify(st)===JSON.stringify(D); $(".qclear").hidden=!st.q;
  $("#sort").value=st.sort;
  renderHeatmap(); chips(); { const c=$("#cats"), a=c.querySelector(".active"); if(a&&(a.offsetLeft<c.scrollLeft||a.offsetLeft+a.offsetWidth>c.scrollLeft+c.clientWidth)) c.scrollLeft=a.offsetLeft-c.clientWidth/2+a.offsetWidth/2; } window.__tmOv&&__tmOv(); syncHash();
}

function onAct(e){
  const t=e.target.closest("[data-c],[data-s]"); if(!t||t.disabled)return;
  const c=t.dataset.c, s=t.dataset.s;
  if(c!==undefined&&s!==undefined){ const same=st.cat===c&&st.score===s; st.cat=same?"all":c; st.score=same?"all":s; }
  else if(c!==undefined) st.cat=st.cat===c&&c!=="all"?"all":c;
  else st.score=st.score===s?"all":s;
  render();
  if(t.classList.contains("hm-c")){ const y=$("#rumors").previousElementSibling.previousElementSibling.getBoundingClientRect().top+scrollY-$(".panel").offsetHeight-(parseFloat($(".panel").style.getPropertyValue("--tm-top"))||0)-8; scrollTo({top:y,behavior:"smooth"}); }
}

async function loadData(){
  const r=await fetch(DATA_URL+"?t="+Date.now());
  if(!r.ok) throw new Error("データの取得に失敗しました（"+r.status+"）");
  return r.json();
}

function stickTop(){ // サイトの固定ヘッダーの下にパネルを止める
  let hs=[], tk=0, to;
  const scan=()=>{ hs=[...document.querySelectorAll("body *")].filter(e=>e.offsetWidth>innerWidth/2&&e.offsetHeight<160&&!e.closest(".tm2")&&getComputedStyle(e).position==="fixed"); };
  let ls=0; const f=()=>{ tk=0; let top=0; if((!hs.length||!hs.every(e=>e.isConnected))&&Date.now()-ls>1000){ ls=Date.now(); scan(); } hs.forEach(e=>{ const r=e.getBoundingClientRect(); if(r.top<=1&&r.bottom>0&&getComputedStyle(e).visibility!=="hidden") top=Math.max(top,r.bottom); });
    $(".panel").style.setProperty("--tm-top",Math.round(top)+"px"); };
  addEventListener("scroll",()=>{ if(!tk) tk=requestAnimationFrame(f); clearTimeout(to); to=setTimeout(f,400); },{passive:true});
  addEventListener("resize",()=>{ scan(); f(); }); scan(); f(); setTimeout(()=>{ scan(); f(); },1500);
}

async function init(){
  readHash(); stickTop();
  $("#q").value=st.q;
  $("#hm").addEventListener("click",onAct);
  $("#hm").addEventListener("keydown",e=>{ if((e.key==="Enter"||e.key===" ")&&e.target.matches("[role=button]")){ e.preventDefault(); onAct(e); } });
  const ov=()=>{ const c=$("#cats"); c.classList.toggle("ov-l",c.scrollLeft>2); c.classList.toggle("ov-r",c.scrollLeft+c.clientWidth<c.scrollWidth-2); };
  $("#cats").addEventListener("scroll",ov,{passive:true}); addEventListener("resize",ov); window.__tmOv=ov;
  const cs=$("#cats"); $(".cnav.l").addEventListener("click",()=>cs.scrollBy({left:-cs.clientWidth*.7})); $(".cnav.r").addEventListener("click",()=>cs.scrollBy({left:cs.clientWidth*.7}));
  cs.addEventListener("wheel",e=>{ if(Math.abs(e.deltaY)>Math.abs(e.deltaX)&&cs.scrollWidth>cs.clientWidth){ const m=cs.scrollWidth-cs.clientWidth; if((e.deltaY>0&&cs.scrollLeft<m-1)||(e.deltaY<0&&cs.scrollLeft>0)){ e.preventDefault(); cs.scrollLeft+=e.deltaY; } } },{passive:false});
  $("#cats").addEventListener("click",e=>{ const b=e.target.closest("[data-c]"); if(!b)return; st.cat=b.dataset.c; render(); });
  $("#periods").addEventListener("click",e=>{ const b=e.target.closest("[data-p]"); if(!b)return; st.period=b.dataset.p; render(); });
  $("#sort").addEventListener("change",e=>{ st.sort=e.target.value; render(); });
  let tm; $("#q").addEventListener("input",e=>{ clearTimeout(tm); tm=setTimeout(()=>{ st.q=e.target.value.trim(); render(); },150); });
  $(".reset-btn").addEventListener("click",()=>{ st={...D}; $("#q").value=""; render(); });
  $(".qclear").addEventListener("click",e=>{ e.preventDefault(); $("#q").value=""; st.q=""; render(); $("#q").focus(); });
  $(".more").addEventListener("click",()=>{ shown+=PAGE; render(true); });
  try{
    const data=await loadData();
    all=(data.rumors||[]).filter(r=>(r.score||0)>=1).map(fixCat);
    NOW=new Date(data.updated||Date.now());
    $("#s-total").textContent=all.length;
    $("#s-updated").textContent=data.updated||"—";
    
    const hi=[...all].filter(r=>r.score>=4).sort((x,y)=>y.score-x.score||new Date(y.date)-new Date(x.date));
    const feat=(hi.filter(r=>age(r.date)<=30).length?hi.filter(r=>age(r.date)<=30):hi).slice(0,5);
    $("#featured").innerHTML=feat.length?feat.map(card).join(""):`<div class="empty">現在、注目表示できる高信憑リークはありません。</div>`;
    render();
  }catch(e){
    $("#featured").innerHTML=$("#rumors").innerHTML=`<div class="empty">⚠️ データの読み込みに失敗しました。<br><small>${esc(e.message)}</small></div>`;
  }
}
init();
})();
