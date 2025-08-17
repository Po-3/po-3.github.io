/*!
 * l6-unique-gen v1
 * 「他の人と被りにくい」LOTO6 1口ジェネレーター（外部読み込み版）
 * MIT License
 */
(function(){
  "use strict";

  // --- utils ---
  const $all = (sel, root=document) => Array.from(root.querySelectorAll(sel));
  const toHalf = s => (s||"").replace(/[０-９，、．・]/g, ch=>{
    const m = {"，":",","、":",","．":".","・":","}[ch];
    return m || String.fromCharCode(ch.charCodeAt(0)-0xFEE0);
  });
  const parseSeeds = (str) => {
    const t = toHalf(str).split(/[^\d]+/).map(s=>s.trim()).filter(Boolean);
    const ns = t.map(n=>parseInt(n,10)).filter(x=>Number.isInteger(x)&&x>=1&&x<=43);
    return [...new Set(ns)];
  };
  const pad2 = n => String(n).padStart(2,"0");
  const fmt  = arr => arr.map(pad2).join("・");

  // --- permutation from seeds ---
  function makePermutation(seeds){
    let s1 = Math.min(...seeds), s2 = Math.max(...seeds);
    if(!Number.isFinite(s1) || !Number.isFinite(s2)){
      const now = new Date();
      const y=now.getFullYear(), m=now.getMonth()+1, d=now.getDate();
      const mins = now.getHours()*60 + now.getMinutes();
      s1 = ((y+m+d) % 43) || 1;
      s2 = (mins % 43) || 43;
    }
    let a = (2*s1 + 1) % 43; if(a===0) a = 41;    // 43と互いに素に
    const b = (3*s2 + 7) % 43;
    const out = new Array(43);
    for(let k=0;k<43;k++) out[k] = ((a*k + b) % 43) + 1;
    return out;
  }

  // --- pick 6 numbers by "anti-crowd" rules ---
  function pickLoto6(seeds){
    const seq = makePermutation(seeds);
    const chosen = [];
    const usedTail = new Set();
    const tail = x => x % 10;
    const hasAdj = x => chosen.some(y => Math.abs(x - y) === 1);

    // 高位(>=32)を3つ優先
    for(const x of seq){
      if(chosen.length >= 3) break;
      if(x>=32 && !hasAdj(x) && !usedTail.has(tail(x))){
        chosen.push(x); usedTail.add(tail(x));
      }
    }
    // 残りを充足（連番・末尾被りを避ける）
    for(const x of seq){
      if(chosen.length === 6) break;
      if(!hasAdj(x) && !usedTail.has(tail(x))){
        chosen.push(x); usedTail.add(tail(x));
      }
    }
    // 万一足りなければ最後の1枠だけ連番許容
    if(chosen.length < 6){
      for(const x of seq){
        if(!usedTail.has(tail(x))){ chosen.push(x); break; }
      }
    }
    return { asc: [...chosen].sort((a,b)=>a-b), gen: chosen };
  }

  // --- UI builder (inline stylesで軽量に) ---
  function buildWidget(root){
    root.innerHTML = ""; // 既存をクリア
    root.style.border = "1px solid #e5e7eb";
    root.style.borderRadius = "10px";
    root.style.padding = "10px";
    root.style.maxWidth = "560px";
    root.style.margin = "12px auto";
    root.style.fontFamily = "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial";

    const head = document.createElement("div");
    head.textContent = "LOTO6｜被りにくい一口ジェネレーター";
    head.style.fontWeight = "700";
    head.style.marginBottom = "6px";

    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.gap = "6px";
    row.style.flexWrap = "wrap";
    row.style.alignItems = "center";

    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "例: 02,31（空欄でもOK）";
    input.setAttribute("aria-label", "任意の数字（1〜43）");
    Object.assign(input.style, {
      flex: "1 1 220px", padding: "8px 10px",
      border: "1px solid #d1d5db", borderRadius: "8px", fontSize: "15px"
    });

    const go = document.createElement("button");
    go.type = "button"; go.textContent = "計算";
    Object.assign(go.style, btnStyle("#111827"));

    const clr = document.createElement("button");
    clr.type = "button"; clr.textContent = "クリア";
    Object.assign(clr.style, btnStyle("#6b7280"));

    const o1 = document.createElement("div");
    o1.style.marginTop = "8px"; o1.style.fontWeight = "600";
    o1.textContent = "結果（昇順）：";

    const o2 = document.createElement("div");
    o2.style.marginTop = "4px";
    o2.textContent = "生成順：";

    row.appendChild(input); row.appendChild(go); row.appendChild(clr);
    root.appendChild(head); root.appendChild(row); root.appendChild(o1); root.appendChild(o2);

    function run(){
      const seeds = parseSeeds(input.value);
      const r = pickLoto6(seeds);
      o1.textContent = "結果（昇順）：" + (r.asc.length ? fmt(r.asc) : "—");
      o2.textContent = "生成順：" + (r.gen.length ? fmt(r.gen) : "—");
    }
    function clearAll(){
      input.value = ""; o1.textContent = "結果（昇順）："; o2.textContent = "生成順："; input.focus();
    }
    go.addEventListener("click", run);
    clr.addEventListener("click", clearAll);
    input.addEventListener("keydown", e => { if(e.key === "Enter"){ e.preventDefault(); run(); } });
  }

  function btnStyle(bg){
    return {
      padding:"8px 12px", border:"1px solid "+bg, background:bg, color:"#fff",
      borderRadius:"8px", cursor:"pointer"
    };
  }

  // 起動：ページ内の data-l6-widget を全てウィジェット化
  function init(){
    $all("[data-l6-widget]").forEach(buildWidget);
  }
  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", init, {once:true});
  }else{
    init();
  }
})();