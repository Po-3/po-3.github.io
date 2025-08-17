/* lotto-board.v20250818.js
 * 億万長者ボード“風” 予想ボード（公開データ＋透明ロジック版）
 * - 指標: 登場回数（本数字合算）, 連続不出現（本数字）, 相性共起（本数字）
 * - 重みスライダーでスコア合成 → ヒートボード
 * - マスク（X/十字/斜め/チェッカー等）＋行/列シフトで重ね合わせ位置を調整
 * - 100点満点の期待度スコア（P5→0 / P95→100 の相対）
 * - 2025-08-18 JST
 */
(function () {
  const MOUNT_ID = "lotto-millionaire-like-board";
  const GAMES = {
    "ロト6":   { url:"https://po-3.github.io/loto6-data/loto6.json",    max:43, pick:6, cols:7 },
    "ロト7":   { url:"https://po-3.github.io/loto7-data/loto7.json",    max:37, pick:7, cols:7 },
    "ミニロト": { url:"https://po-3.github.io/miniloto-data/miniloto.json", max:31, pick:5, cols:7 },
  };
  const RECENT_N = null;   // 直近N回に限定するなら数値、全期間ならnull
  const COOC_BASE = [1,2,3]; // 相性のベース初期値（UIで変更可）
  const MASKS = {
    "無し": (r,c)=>false,
    "十字": (r,c,rows,cols,o)=> r===((rows>>1)+o.r)%rows || c===((cols>>1)+o.c)%cols,
    "X型":  (r,c,rows,cols,o)=> ((r%rows)===(c+o.c)%cols || (r%rows)===((cols-1-c+o.c)%cols)),
    "斜め帯":(r,c,rows,cols,o)=> ((r + o.r) % rows) === ((c + o.c) % cols),
    "チェッカー":(r,c,rows,cols,o)=> ((r+o.r)+(c+o.c))%2===0
  };

  // ---------- utils ----------
  const el = (h)=>{const t=document.createElement("template"); t.innerHTML=h.trim(); return t.content.firstElementChild;};
  const css = `
    #${MOUNT_ID}{line-height:1.8}
    #${MOUNT_ID} h2{margin:1.4em 0 .6em; font-size:1.5em}
    #${MOUNT_ID} h3{margin:1.0em 0 .4em; font-size:1.1em}
    #${MOUNT_ID} .description, #${MOUNT_ID} .toc {background:#fafafa;border:1px solid #ddd;padding:10px 15px;margin:0 0 1.2em}
    #${MOUNT_ID} .toc ul{margin:0;padding-left:1.2em}
    #${MOUNT_ID} .controls{display:flex;flex-wrap:wrap;gap:.6em;align-items:center;margin:.5em 0 1em}
    #${MOUNT_ID} .controls label{font-size:.95em}
    #${MOUNT_ID} .board{display:grid;gap:6px;margin:.6em 0 1em}
    #${MOUNT_ID} .cell{border:1px solid #e5e5e5;padding:.25em .1em;text-align:center;border-radius:4px;font-variant-numeric:tabular-nums}
    #${MOUNT_ID} .legend{display:flex;gap:8px;align-items:center;font-size:.9em;color:#555}
    #${MOUNT_ID} .legend .box{width:20px;height:12px;border:1px solid #ccc}
    #${MOUNT_ID} .pick{font-weight:bold}
    #${MOUNT_ID} .note{color:#666;font-size:.9em;margin-top:.4em}
    #${MOUNT_ID} .updated{font-size:.85em;color:#888;margin:.2em 0 1em}
    #${MOUNT_ID} input[type=range]{vertical-align:middle}
    #${MOUNT_ID} .btn{cursor:pointer;border:1px solid #ddd;padding:.3em .6em;border-radius:4px;background:#fff}
  `;
  const injectCSS = ()=>{const s=document.createElement("style"); s.textContent=css; document.head.appendChild(s);};
  const pad = (n)=>String(n).padStart(2,"0");
  const isDigitKey = (k)=> /^第(\d+)数字$/.test(k);
  const isBonusKey = (k)=> /^(BONUS数字\d*|ボーナス数字\d*|ボーナス数字)$/i.test(k);

  const normalize = (data)=>{
    if(Array.isArray(data?.items)) return {rows:data.items, meta:{count:data.count||data.items.length, lastDate:data.last_updated||data.updated||null}};
    if(Array.isArray(data)) { const last=data[data.length-1]||{}; return {rows:data, meta:{count:data.length, lastDate:last["日付"]||last["date"]||null} }
    }
    return {rows:[], meta:{}};
  };

  // 本数字抽出
  const extractMain = (r)=>{const a=[]; for(const k in r) if(isDigitKey(k)){const v=+r[k]; if(Number.isInteger(v)) a.push(v);} return a;};

  // 指標計算
  const countAppear = (rows)=>{ const m=new Map(); const data = (RECENT_N && rows.length>RECENT_N)? rows.slice(-RECENT_N): rows;
    for(const r of data){ for(const k in r) if(isDigitKey(k)){ const v=+r[k]; if(Number.isInteger(v)) m.set(v,(m.get(v)||0)+1);} }
    return m; };

  const skipStreak = (rows, max)=>{ const last=new Array(max+1).fill(-1); rows.forEach((r,i)=>{ for(const k in r) if(isDigitKey(k)){const v=+r[k]; if(Number.isInteger(v)&&v>=1&&v<=max) last[v]=i;}});
    const N=rows.length, out=new Map(); for(let n=1;n<=max;n++){ const s=(last[n]===-1)? N : (N-1-last[n]); out.set(n,s); } return out; };

  const cooccur = (rows, bases)=>{ // bases: 配列（本数字が出た回のみ母集団）
    const freq=new Map(); let used=0;
    for(const r of rows){
      const main = extractMain(r);
      if (!bases.some(b=>main.includes(b))) continue;
      used++;
      for(const n of main){ if(bases.includes(n)) continue; freq.set(n,(freq.get(n)||0)+1); }
    }
    return {freq, used};
  };

  const zscoreMap = (mp)=>{ // 値をzスコア化
    const nums=[...mp.values()]; if(nums.length===0) return new Map();
    const mean = nums.reduce((a,b)=>a+b,0)/nums.length;
    const varc = nums.reduce((a,b)=>a+(b-mean)*(b-mean),0)/nums.length;
    const sd = Math.sqrt(varc)||1e-9;
    const out=new Map(); for(const [k,v] of mp.entries()) out.set(k,(v-mean)/sd);
    return out;
  };

  // ％タイル
  const percentile = (arr, p)=>{ // p:0..100
    if(!arr.length) return 0;
    const a=[...arr].sort((x,y)=>x-y);
    const i=(a.length-1)*p/100;
    const lo=Math.floor(i), hi=Math.ceil(i);
    if(lo===hi) return a[lo];
    const t=i-lo; return a[lo]*(1-t)+a[hi]*t;
  };

  // 色（青→白→赤）
  const heat = (z)=>{ const t = Math.max(-2, Math.min(2, z)); const p=(t+2)/4;
    const lerp=(a,b,t)=>Math.round(a+(b-a)*t);
    let r,g,b; if(p<0.5){ const q=p*2; r=lerp(70,255,q); g=lerp(130,255,q); b=lerp(180,255,q); }
    else { const q=(p-0.5)*2; r=lerp(255,220,q); g=lerp(255,20,q); b=lerp(255,60,q); }
    return `rgb(${r},${g},${b})`;
  };

  async function main() {
    injectCSS();
    const mount = document.getElementById(MOUNT_ID);
    if(!mount) return;

    // --- 仕組み＋使い方（冒頭説明） ---
    mount.innerHTML = `<div class="description">
      <h3 style="margin:.2em 0 .6em">このボードは何？</h3>
      <p style="margin:.2em 0">
        過去の抽せんデータから<strong>登場回数</strong>・<strong>連続不出現回数</strong>・<strong>相性（共起）回数</strong>の3指標を計算し、
        それぞれを標準化（zスコア化）して<strong>重み付け合成</strong>します。スコアは<strong>青→白→赤</strong>のヒートマップで表示され、
        赤いほど<strong>有力候補</strong>寄りの数値です。
      </p>
      <hr style="border:none;border-top:1px solid #e5e5e5;margin:1em 0">
      <h3 style="margin:.2em 0 .6em">相性ベースとは？</h3>
      <p style="margin:.2em 0">
        指定した数字と<strong>同じ回に出がちな数字</strong>を測るための母集団です。例：ベースに <code>07</code> を選ぶと、
        「07が出た回」で一緒に出た数字の傾向を集計します。複数選択すると
        <em>「選んだ数字のどれかが出た回」</em>が母集団になります。
      </p>
      <ul style="margin:.4em 0 .8em 1em">
        <li>例1：ベース <code>07</code> → 07と同回に出やすい数字が赤くなる</li>
        <li>例2：ベース <code>07</code>・<code>13</code> → 07または13が出た回で共起しやすい数字</li>
      </ul>
      <div class="note" style="margin:.4em 0 .8em">
        <strong>複数選択の操作</strong>：Windows は <code>Ctrl</code>／Mac は <code>⌘</code>（範囲は <code>Shift</code>）
      </div>
      <hr style="border:none;border-top:1px solid #e5e5e5;margin:1em 0">
      <h3 style="margin:.2em 0 .6em">マスクとシフト</h3>
      <ul style="margin:.2em 0 .8em 1em">
        <li><b>十字</b>：中央の縦・横ライン</li>
        <li><b>X型</b>：両対角線</li>
        <li><b>斜め帯</b>：斜め一本（<em>行/列シフト</em>で帯の位置を移動）</li>
        <li><b>チェッカー</b>：市松模様（一マスおき）</li>
      </ul>
      <p class="note" style="margin:.2em 0 .8em">
        <strong>行シフト/列シフト</strong>は、模様の重ね位置を上下/左右にずらす微調整です。
      </p>
      <hr style="border:none;border-top:1px solid #e5e5e5;margin:1em 0">
      <h3 style="margin:.2em 0 .6em">採点の仕組み（100点満点）</h3>
      <p style="margin:.2em 0">
        <code>z_comb(n)=w1·zA(n)+w2·zS(n)+w3·zC(n)</code>。
        盤面全体の <code>z_comb</code> 分布で <b>P5→0</b> / <b>P95→100</b> に線形変換。
      </p>
      <p class="note" style="margin:.2em 0">
        ※相対評価であり、当選確率そのものではありません。
      </p>
    </div>`;

    try {
      const results = await Promise.allSettled(
        Object.entries(GAMES).map(async ([name,conf])=>{
          const res = await fetch(conf.url, {cache:"no-store"});
          if(!res.ok) throw new Error(`${name}の取得に失敗（${res.status}）`);
          const json = await res.json();
          const {rows, meta} = normalize(json);
          return {name, rows, meta, ...conf};
        })
      );

      const toc = [];
      let body = "";

      for (const r of results) {
        if (r.status !== "fulfilled") {
          body += `<h2>【読み込み失敗】</h2><div class="note">${r.reason?.message||"不明なエラー"}</div>`;
          continue;
        }
        const {name, rows, meta, max, pick, cols} = r.value;
        const rowsData = (RECENT_N && rows.length>RECENT_N) ? rows.slice(-RECENT_N) : rows;

        // 指標
        const appear = countAppear(rowsData);                      // 回数
        const streak = skipStreak(rows, max);                      // 連続不出現（全期間基準）
        const {freq:cof} = cooccur(rows, COOC_BASE);               // 相性（初期ベース）

        // zスコア
        const zA = zscoreMap(appear);
        const zS = zscoreMap(streak);
        const zC_base = zscoreMap(cof); // 初期（ベース変更後は都度再計算）

        const secId = `sec-${name}`;
        body += `<h2 id="${secId}">${name}：予想ボード</h2>
                 <div class="updated">(${name} / 件数: ${rows.length.toLocaleString()} 回${meta?.lastDate?`・最終日: ${meta.lastDate}`:""})</div>`;

        // コントロール
        const idW1=`${secId}-w1`, idW2=`${secId}-w2`, idW3=`${secId}-w3`;
        const idMask=`${secId}-mask`, idShiftR=`${secId}-sr`, idShiftC=`${secId}-sc`;
        const idBase=`${secId}-base`, idBoard=`${secId}-board`, idOut=`${secId}-out`;
        const idRegen=`${secId}-regen`;

        const baseOpts = Array.from({length:max},(_,i)=>i+1).map(n=>`<option value="${n}" ${COOC_BASE.includes(n)?"selected":""}>${pad(n)}</option>`).join("");

        body += `
          <div class="controls">
            <label title="過去に本数字として多く出た数字を優先">重み：登場回数 <input type="range" id="${idW1}" min="0" max="3" step="0.1" value="1.0"></label>
            <label title="長く出ていない数字を優先">連続不出現 <input type="range" id="${idW2}" min="0" max="3" step="0.1" value="1.0"></label>
            <label title="相性ベースと同回に出がちな数字を優先">相性共起 <input type="range" id="${idW3}" min="0" max="3" step="0.1" value="1.0"></label>
            <label>相性ベース（複数可）
              <select id="${idBase}" multiple size="3" style="min-width:6ch" title="複数選択：Windows=Ctrl+クリック／Mac=⌘+クリック（範囲はShift）">${baseOpts}</select>
            </label>
          </div>
          <div class="controls">
            <label title="重ねる模様を選びます">マスク
              <select id="${idMask}">
                ${Object.keys(MASKS).map(k=>`<option>${k}</option>`).join("")}
              </select>
            </label>
            <label title="マスク模様を上下にずらす">行シフト <input type="range" id="${idShiftR}" min="0" max="6" value="0"></label>
            <label title="マスク模様を左右にずらす">列シフト <input type="range" id="${idShiftC}" min="0" max="6" value="0"></label>
            <button class="btn" id="${idRegen}" title="マスク内上位→不足分は全体上位で補完">${pick}個の候補を抽出</button>
          </div>
          <div class="legend">
            <span>低</span><span class="box" style="background:${heat(-2)}"></span>
            <span class="box" style="background:${heat(0)}"></span>
            <span class="box" style="background:${heat(2)}"></span><span>高</span>
          </div>
          <div id="${idBoard}"></div>
          <div id="${idOut}" class="note"></div>
        `;

        toc.push({ id:secId, text:name, children:[{id:idBoard, text:"ボード"}] });

        // 初期レンダリング（描画後にDOMを取る）
        setTimeout(()=>{
          const W1=document.getElementById(idW1), W2=document.getElementById(idW2), W3=document.getElementById(idW3);
          const MASK=document.getElementById(idMask), SR=document.getElementById(idShiftR), SC=document.getElementById(idShiftC);
          const BASE=document.getElementById(idBase), BOARD=document.getElementById(idBoard), OUT=document.getElementById(idOut);
          const REGEN=document.getElementById(idRegen);
          if(!BOARD) return;

          const rowsCount = Math.ceil(max / cols);

          const cooccurDyn = (rows, bases)=>{
            const {freq, used} = cooccur(rows, bases);
            return {z: zscoreMap(freq), used};
          };

          const renderBoard = ()=>{
            // 相性（ベース選択に追従）
            const bases = Array.from(BASE.selectedOptions).map(o=>+o.value);
            const {z: zC2, used:usedNow} = cooccurDyn(rows, bases.length?bases:COOC_BASE);

            // 合成スコアと分布
            const w1=+W1.value, w2=+W2.value, w3=+W3.value;
            const score=new Map(), dist=[];
            for(let n=1;n<=max;n++){
              const a=zA.get(n)||0, s=zS.get(n)||0, c=zC2.get(n)||0;
              const z = w1*a + w2*s + w3*c;
              score.set(n, z);
              dist.push(z);
            }
            const P5 = percentile(dist, 5), P95 = percentile(dist, 95);
            const clamp = (x,lo,hi)=>Math.min(hi, Math.max(lo, x));
            const to100 = (avgZ)=> (P95>P5? clamp((avgZ-P5)/(P95-P5)*100,0,100):50);

            // ボード描画
            BOARD.innerHTML = "";
            BOARD.className = "board";
            BOARD.style.gridTemplateColumns = `repeat(${cols}, minmax(34px,1fr))`;

            const maskName = MASK.value;
            const maskFn = MASKS[maskName];
            const off = { r:+SR.value, c:+SC.value };

            const cells=[];
            for(let i=0;i<rowsCount;i++){
              for(let j=0;j<cols;j++){
                const n = i*cols + j + 1;
                if(n>max){
                  const dummy=el(`<div class="cell" style="visibility:hidden">--</div>`);
                  BOARD.appendChild(dummy);
                  continue;
                }
                const z = score.get(n)||0;
                const color = heat(z);
                const masked = maskFn ? maskFn(i,j,rowsCount,cols,off) : false;
                const cell = el(`<div class="cell" data-n="${n}" style="background:${color};${masked?'outline:2px solid #333':''}">${pad(n)}</div>`);
                BOARD.appendChild(cell);
                cells.push({n, z, masked});
              }
            }

            // 候補抽出（マスク内上位→不足分は全体上位）
            const pickTop = ()=>{
              const masked = cells.filter(c=>c.masked).sort((a,b)=>b.z-a.z || a.n-b.n).slice(0,pick).map(c=>c.n);
              if(masked.length<pick){
                const rest = cells.filter(c=>!masked.includes(c.n)).sort((a,b)=>b.z-a.z || a.n-b.n).slice(0, pick-masked.length).map(c=>c.n);
                return masked.concat(rest);
              }
              return masked;
            };
            const sel = pickTop().sort((a,b)=>a-b);

            // 候補の期待度（100点換算）
            let avgZ = 0;
            let sumA=0, sumS=0, sumC=0;
            for(const n of sel){
              const a=zA.get(n)||0, s=zS.get(n)||0, c=zC2.get(n)||0;
              sumA+=a; sumS+=s; sumC+=c;
              avgZ += score.get(n)||0;
            }
            const k = sel.length || 1;
            const avgA = sumA / k, avgS = sumS / k, avgC = sumC / k;
            avgZ = avgZ / k;
            const rating = to100(avgZ);

            OUT.innerHTML = `<b>候補（${sel.length}個）:</b> ${sel.map(pad).join(" ")} ` +
              `<br><b>期待度（100点満点）:</b> ${rating.toFixed(0)} 点 ` +
              `<span class="note">（現設定での相対評価・P5→0点／P95→100点）</span>` +
              `<br><span class="note">平均z[登:${avgA.toFixed(2)} / 不出:${avgS.toFixed(2)} / 相:${avgC.toFixed(2)}], 重み[${w1.toFixed(1)}, ${w2.toFixed(1)}, ${w3.toFixed(1)}]</span>` +
              `${usedNow?`<br><span class="note">相性母集団: ${usedNow}回</span>`:''}`;

            return sel;
          };

          const rerender = renderBoard;
          W1.addEventListener("input", rerender);
          W2.addEventListener("input", rerender);
          W3.addEventListener("input", rerender);
          MASK.addEventListener("change", rerender);
          SR.addEventListener("input", rerender);
          SC.addEventListener("input", rerender);
          BASE.addEventListener("change", rerender);
          REGEN.addEventListener("click", rerender);
          rerender();
        }, 0);
      }

      // 目次
      let tocHTML = `<div class="toc"><strong>目次</strong><ul>`;
      for(const sec of toc){
        tocHTML += `<li><a href="#${sec.id}">${sec.text}</a>`;
        if(sec.children?.length){
          tocHTML += `<ul>`;
          for(const c of sec.children) tocHTML += `<li><a href="#${c.id}">${c.text}</a></li>`;
          tocHTML += `</ul>`;
        }
        tocHTML += `</li>`;
      }
      tocHTML += `</ul></div>`;

      mount.insertAdjacentHTML("beforeend", tocHTML + body);

    } catch (e) {
      const mount = document.getElementById(MOUNT_ID);
      if (mount) mount.innerHTML += `<h2>データ読み込みエラー</h2><div class="note">${e?.message||e}</div>`;
      console.error(e);
    }
  }

  // DOM準備後に実行（外部JS＋deferでも安全）
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", main, { once: true });
  } else {
    main();
  }
})();