/*! iPhone17 Quiz v3.0 (accuracy-first, Apple Sept 2025) | single-file, no deps */
(() => {
  "use strict";

  // util: option builder
  function opt(label, score) { return { label, score }; }

  const MODELS = ["Air", "17", "Pro", "ProMax"];

  // --- 30 QUESTIONS (updated for 2025 official specs) ---
  const Q = [
    { t: "片手操作のしやすさを最優先したい", o: [
      opt("強くそう思う",{Air:3,17:2,Pro:0,ProMax:0}),
      opt("ややそう思う",{Air:2,17:1,Pro:0,ProMax:0}),
      opt("あまり思わない",{Air:0,17:0,Pro:1,ProMax:1}),
      opt("全く思わない",{Air:0,17:0,Pro:1,ProMax:2}),
    ]},
    { t: "重量200g超でも問題ない", o: [
      opt("はい",{Air:0,17:0,Pro:1,ProMax:3}), // Pro=206g, ProMax=233g
      opt("どちらかといえばはい",{Air:0,17:0,Pro:1,ProMax:2}),
      opt("あまり望ましくない",{Air:2,17:1,Pro:0,ProMax:0}),
      opt("絶対ムリ",{Air:3,17:2,Pro:0,ProMax:0}),
    ]},
    { t: "望遠ズーム（光学）が欲しい", o: [
      opt("必須",{Air:0,17:0,Pro:2,ProMax:3}), // Airは2x=クロップ, 17は望遠レンズなし
      opt("できれば欲しい",{Air:0,17:0,Pro:2,ProMax:2}),
      opt("なくても良い",{Air:2,17:2,Pro:0,ProMax:0}),
      opt("不要",{Air:3,17:2,Pro:0,ProMax:0}),
    ]},
    { t: "動画を本格的（Log/ProRes的な作風）に撮る予定", o: [
      opt("頻繁に撮る",{Air:0,17:0,Pro:3,ProMax:3}),
      opt("たまに撮る",{Air:0,17:1,Pro:2,ProMax:2}),
      opt("ほぼ撮らない",{Air:2,17:2,Pro:0,ProMax:0}),
      opt("短尺メイン",{Air:2,17:2,Pro:0,ProMax:0}),
    ]},
    { t: "価格はできるだけ抑えたい", o: [
      opt("強く重視",{Air:3,17:2,Pro:0,ProMax:0}),
      opt("やや重視",{Air:2,17:2,Pro:1,ProMax:0}),
      opt("あまり重視しない",{Air:0,17:0,Pro:1,ProMax:2}),
      opt("重視しない",{Air:0,17:0,Pro:2,ProMax:3}),
    ]},
    { t: "薄さ・軽さのデザインに惹かれる", o: [
      opt("とても惹かれる",{Air:3,17:1,Pro:0,ProMax:0}), // Airは5.6mm/約165g
      opt("やや惹かれる",{Air:2,17:1,Pro:0,ProMax:0}),
      opt("どちらでもない",{Air:0,17:1,Pro:1,ProMax:1}),
      opt("重さ気にしない",{Air:0,17:0,Pro:1,ProMax:2}),
    ]},
    { t: "ゲーム性能（GPU）を重視", o: [
      opt("最重視",{Air:0,17:0,Pro:3,ProMax:3}),
      opt("重視",{Air:0,17:1,Pro:2,ProMax:2}),
      opt("普通",{Air:1,17:2,Pro:1,ProMax:1}),
      opt("重視しない",{Air:2,17:2,Pro:0,ProMax:0}),
    ]},
    // ★大画面（サイズ実機順：Pro Max(6.9) > Air(6.5) > Pro(6.3) = 17(6.3)）
    { t: "大画面が好き（動画/読書/作業）", o: [
      opt("大画面必須",{Air:2,17:0,Pro:1,ProMax:3}),
      opt("できれば大画面",{Air:2,17:0,Pro:1,ProMax:2}),
      opt("普通",{Air:0,17:2,Pro:1,ProMax:0}),
      opt("小さめ/標準が良い",{Air:0,17:3,Pro:1,ProMax:0}),
    ]},
    { t: "電池持ちを最重視（丸一日以上の安心感）", o: [
      opt("最重視",{Air:1,17:2,Pro:2,ProMax:3}), // Airも良好だが最長はPro Max
      opt("重視",{Air:1,17:2,Pro:2,ProMax:2}),
      opt("普通",{Air:1,17:2,Pro:1,ProMax:1}),
      opt("気にしない",{Air:2,17:2,Pro:0,ProMax:0}),
    ]},
    // ★放熱・負荷安定（Pro/Maxはベイパーチャンバー＋一体設計が強み）
    { t: "発熱時の安定（長時間の高負荷でも性能を維持）を重視", o: [
      opt("強く重視",{Air:0,17:1,Pro:3,ProMax:3}),
      opt("やや重視",{Air:0,17:1,Pro:2,ProMax:2}),
      opt("普通",{Air:1,17:2,Pro:1,ProMax:1}),
      opt("気にしない",{Air:2,17:2,Pro:0,ProMax:0}),
    ]},
    { t: "写真は“そこそこでOK”、軽さ優先", o: [
      opt("その通り",{Air:3,17:2,Pro:0,ProMax:0}),
      opt("やや同意",{Air:2,17:2,Pro:0,ProMax:0}),
      opt("迷う",{Air:1,17:1,Pro:1,ProMax:1}),
      opt("高画質優先",{Air:0,17:0,Pro:2,ProMax:3}),
    ]},
    // ★マクロ/夜景/動体：17は広角＋超広角でAirより適性、Pro系はさらに強い
    { t: "マクロ/夜景/動体など“難しい写真”を攻めたい", o: [
      opt("はい",{Air:0,17:2,Pro:3,ProMax:3}),
      opt("どちらかと言えばはい",{Air:0,17:2,Pro:2,ProMax:2}),
      opt("あまり",{Air:2,17:2,Pro:0,ProMax:0}),
      opt("いいえ",{Air:3,17:2,Pro:0,ProMax:0}),
    ]},
    { t: "片手で長時間持っても疲れたくない", o: [
      opt("はい",{Air:3,17:2,Pro:0,ProMax:0}),
      opt("ややはい",{Air:2,17:2,Pro:0,ProMax:0}),
      opt("どちらでも",{Air:1,17:1,Pro:1,ProMax:1}),
      opt("いいえ",{Air:0,17:0,Pro:1,ProMax:2}),
    ]},
    { t: "SNS/ショート動画撮影が中心", o: [
      opt("はい",{Air:2,17:2,Pro:1,ProMax:1}),
      opt("ややはい",{Air:2,17:2,Pro:1,ProMax:1}),
      opt("いいえ",{Air:0,17:0,Pro:2,ProMax:2}),
      opt("本格映像重視",{Air:0,17:0,Pro:3,ProMax:3}),
    ]},
    { t: "外部ストレージやPC連携で重めの編集も想定", o: [
      opt("想定する",{Air:0,17:0,Pro:2,ProMax:3}),
      opt("少し想定",{Air:0,17:1,Pro:2,ProMax:2}),
      opt("あまり想定せず",{Air:2,17:2,Pro:0,ProMax:0}),
      opt("想定しない",{Air:3,17:2,Pro:0,ProMax:0}),
    ]},
    { t: "出張/旅行が多い（軽さ・充電性重視）", o: [
      opt("多い",{Air:3,17:2,Pro:0,ProMax:0}),
      opt("ときどき",{Air:2,17:2,Pro:1,ProMax:0}),
      opt("少ない",{Air:0,17:1,Pro:1,ProMax:2}),
      opt("ほぼない",{Air:0,17:0,Pro:1,ProMax:2}),
    ]},
    // ★ProMotionは全機種対応（差は小さめに）
    { t: "画面の滑らかさ（高リフレッシュ）を重視", o: [
      opt("最重視",{Air:2,17:2,Pro:3,ProMax:3}),
      opt("重視",{Air:1,17:2,Pro:2,ProMax:2}),
      opt("普通",{Air:1,17:1,Pro:1,ProMax:1}),
      opt("気にしない",{Air:2,17:2,Pro:0,ProMax:0}),
    ]},
    { t: "握りやすい角の丸み/薄さが好み", o: [
      opt("とても好み",{Air:3,17:1,Pro:0,ProMax:0}),
      opt("やや好み",{Air:2,17:1,Pro:0,ProMax:0}),
      opt("どちらでも",{Air:1,17:1,Pro:1,ProMax:1}),
      opt("角ばっていてもOK",{Air:0,17:0,Pro:2,ProMax:2}),
    ]},
    { t: "長期利用（3〜4年）での性能余力を重視", o: [
      opt("最重視",{Air:0,17:1,Pro:3,ProMax:3}),
      opt("重視",{Air:0,17:1,Pro:2,ProMax:2}),
      opt("普通",{Air:1,17:2,Pro:1,ProMax:1}),
      opt("気にしない",{Air:2,17:2,Pro:0,ProMax:0}),
    ]},
    { t: "セルフィー/人物の肌の質感にこだわる", o: [
      opt("強くこだわる",{Air:0,17:2,Pro:2,ProMax:2}),
      opt("ややこだわる",{Air:1,17:2,Pro:2,ProMax:2}),
      opt("普通",{Air:2,17:2,Pro:1,ProMax:1}),
      opt("気にしない",{Air:2,17:2,Pro:0,ProMax:0}),
    ]},
    { t: "端末価格よりケース/アクセの自由度を重視", o: [
      opt("はい",{Air:2,17:2,Pro:1,ProMax:1}),
      opt("ややはい",{Air:2,17:2,Pro:1,ProMax:1}),
      opt("いいえ",{Air:0,17:0,Pro:2,ProMax:2}),
      opt("アクセ最小",{Air:2,17:2,Pro:0,ProMax:0}),
    ]},
    { t: "ストレージは大容量（>256GB）を選びたい", o: [
      opt("はい",{Air:0,17:1,Pro:2,ProMax:3}),
      opt("どちらかと言えば",{Air:0,17:1,Pro:2,ProMax:2}),
      opt("あまり",{Air:2,17:2,Pro:0,ProMax:0}),
      opt("いいえ",{Air:2,17:2,Pro:0,ProMax:0}),
    ]},
    { t: "被写体ブレ対策やAFスピードにこだわる", o: [
      opt("最重視",{Air:0,17:1,Pro:3,ProMax:3}),
      opt("重視",{Air:0,17:1,Pro:2,ProMax:2}),
      opt("普通",{Air:1,17:2,Pro:1,ProMax:1}),
      opt("気にしない",{Air:2,17:2,Pro:0,ProMax:0}),
    ]},
    { t: "価格より“持っていて嬉しい所有感”を重視", o: [
      opt("強く重視",{Air:1,17:0,Pro:2,ProMax:3}), // 所有感＝素材/質感/大画面
      opt("やや重視",{Air:1,17:1,Pro:2,ProMax:2}),
      opt("普通",{Air:1,17:2,Pro:1,ProMax:1}),
      opt("重視しない",{Air:2,17:2,Pro:0,ProMax:0}),
    ]},
    { t: "厚手ケース込みでも軽さを保ちたい", o: [
      opt("はい",{Air:3,17:2,Pro:0,ProMax:0}),
      opt("ややはい",{Air:2,17:2,Pro:0,ProMax:0}),
      opt("どちらでも",{Air:1,17:1,Pro:1,ProMax:1}),
      opt("いいえ",{Air:0,17:0,Pro:1,ProMax:2}),
    ]},
    { t: "小さめバッグ/ポケットに収めたい", o: [
      opt("はい",{Air:3,17:2,Pro:0,ProMax:0}),
      opt("ややはい",{Air:2,17:2,Pro:0,ProMax:0}),
      opt("どちらでも",{Air:1,17:1,Pro:1,ProMax:1}),
      opt("いいえ",{Air:0,17:0,Pro:1,ProMax:2}),
    ]},
    { t: "スポーツ観戦や子ども行事で“遠くを寄せたい”", o: [
      opt("よくある",{Air:0,17:0,Pro:2,ProMax:3}),
      opt("ときどきある",{Air:0,17:1,Pro:2,ProMax:2}),
      opt("あまりない",{Air:2,17:2,Pro:0,ProMax:0}),
      opt("ない",{Air:3,17:2,Pro:0,ProMax:0}),
    ]},
    // ★屋外視認性：全機種強化、Pro/Maxにやや加点
    { t: "画面の明るさ・屋外視認性は妥協したくない", o: [
      opt("妥協したくない",{Air:2,17:2,Pro:2,ProMax:3}),
      opt("できれば高い方が良い",{Air:1,17:2,Pro:2,ProMax:2}),
      opt("普通でOK",{Air:2,17:2,Pro:0,ProMax:0}),
      opt("気にしない",{Air:2,17:2,Pro:0,ProMax:0}),
    ]},
    // （Q25は上の発熱・安定に統合済みのためスキップなし）
    { t: "将来の下取り/リセールも考慮したい", o: [
      opt("強く考慮",{Air:1,17:1,Pro:2,ProMax:3}),
      opt("やや考慮",{Air:1,17:1,Pro:2,ProMax:2}),
      opt("あまり",{Air:2,17:2,Pro:0,ProMax:0}),
      opt("考えない",{Air:2,17:2,Pro:0,ProMax:0}),
    ]},
    // カラー嗜好（Airはライト系/新色、Pro系は落ち着き系）
    { t: "好みのカラーはどれ？", o: [
      opt("ライト系（ライトゴールド／シルバー等）",{Air:2,17:2,Pro:1,ProMax:1}),
      opt("ダーク系（黒／グラファイト／濃紺系）",{Air:0,17:1,Pro:1,ProMax:1}),
      opt("明るい新色・限定色を試したい",{Air:2,17:2,Pro:1,ProMax:0}),
      opt("近い色でもOK（色は重視しない）",{Air:1,17:1,Pro:1,ProMax:1}),
    ]},
  ];

  // --- advisory text (updated description) ---
  function advisoryFor(m){
    switch(m){
      case "Air":
        return "超薄型・軽量（約165g / 5.6mm）で6.5インチの広い画面。日常撮影は1眼メイン＋2xクロップでも十分、携帯性と見やすさの両立を最優先するなら最有力。";
      case "17":
        return "6.3インチのバランス機。広角＋超広角でマクロにも対応、扱いやすい重量で“良いとこ取り”。望遠が不要なら失敗しにくい選択肢。";
      case "Pro":
        return "放熱強化の一体構造と高性能GPU、3眼構成で写真・動画を妥協したくない人向け。高負荷のゲーム/編集や長期運用の余力を重視するなら◎。";
      case "ProMax":
        return "6.9インチの最大全画面＋最長バッテリー。8x光学品質ズームで“遠くを寄せる”用途にも強い。すべて盛りたいならここ。";
      default: return "";
    }
  }
  function modelName(m){
    return m==="ProMax" ? "iPhone 17 Pro Max"
         : m==="Pro"    ? "iPhone 17 Pro"
         : m==="17"     ? "iPhone 17"
         :                "iPhone Air";
  }

  // --- small tie-breakers (anchors) ---
  function tweakByAnchors(saved, score){
    // Q1=片手, Q2=重量許容, Q3=望遠, Q8=大画面（Air>Pro）
    const anchors = [
      {q:1, bias:{Air:2,17:1}},
      {q:2, bias:{ProMax:2,Pro:1}},
      {q:3, bias:{ProMax:2,Pro:1}},
      {q:8, bias:{ProMax:2,Air:2,Pro:1}},
    ];
    anchors.forEach(a=>{
      const sel = saved[`q${a.q-1}`];
      if(sel==null) return;
      const forward = (a.q===2 ? (sel===0 || sel===1) : sel===0);
      if(forward){
        Object.entries(a.bias).forEach(([m,v])=>{
          score[m] = (score[m]||0) + v;
        });
      }
    });
  }

  // --- CSS inject ---
  function injectCSS(){
    const style = document.createElement("style");
    style.textContent = `
      .quiz-wrap{max-width:920px;margin:0 auto;padding:16px 14px;line-height:1.7;font-size:16px}
      .quiz-head{position:sticky;top:0;background:#fff;border-bottom:1px solid #eee;padding:10px 0;z-index:10}
      .badge{display:inline-block;padding:2px 8px;border-radius:999px;background:#f2f4f7;font-size:12px;margin-right:6px}
      .grid{display:grid;gap:14px}
      .qcard{border:1px solid #ececec;border-radius:12px;padding:14px}
      .qtitle{font-weight:700;margin-bottom:8px}
      .opts label{display:flex;gap:8px;align-items:flex-start;padding:8px;border-radius:10px;border:1px solid #e9e9e9;margin:6px 0;cursor:pointer}
      .opts input{margin-top:3px}
      .meter{height:8px;border-radius:8px;background:#f2f4f7;overflow:hidden}
      .meter>i{display:block;height:100%;width:0;transition:width .25s ease}
      .flex{display:flex;gap:10px;flex-wrap:wrap}
      .btn{appearance:none;border:1px solid #333;background:#111;color:#fff;border-radius:10px;padding:10px 16px;cursor:pointer}
      .btn.subtle{background:#fff;color:#111;border-color:#ccc}
      .hint{font-size:13px;color:#666}
      .res-card{border:1px solid #e8e8e8;border-radius:12px;padding:14px}
      .rank{display:grid;gap:8px}
      .rank .row{display:flex;justify-content:space-between;border:1px dashed #e9e9e9;border-radius:10px;padding:8px 10px}
      .okay{background:#f7fff8;border:1px solid #dff6e3;color:#05620b;border-radius:10px;padding:10px}
      .sticky-actions{position:sticky;bottom:0;background:#fff;border-top:1px solid #eee;padding:10px 0;margin-top:10px}
      @media (max-width:480px){.quiz-wrap{padding:14px 10px;font-size:16px}}
    `;
    document.head.appendChild(style);
  }

  // --- mount ---
  function mount(){
    const host = document.getElementById("iphone17-quiz");
    if(!host) return;

    injectCSS();

    const wrap = document.createElement("div");
    wrap.className = "quiz-wrap";
    wrap.innerHTML = `
      <div class="quiz-head">
        <div class="flex" style="align-items:center;justify-content:space-between;">
          <div>
            <span class="badge">診断</span>
            <strong>iPhone Air / 17 / 17 Pro / 17 Pro Max — 30問で最適解</strong>
            <div class="hint">選択すると自動で進捗が更新されます（保存は自動）</div>
          </div>
          <div style="min-width:180px">
            <div class="meter" aria-label="progress"><i id="progbar"></i></div>
            <div class="hint"><span id="progressCount">0</span>/<span id="qTotal">0</span> 回答済み</div>
          </div>
        </div>
      </div>

      <div id="quizGrid" class="grid" aria-live="polite"></div>

      <div class="sticky-actions flex">
        <button class="btn" id="calcBtn">診断する</button>
        <button class="btn subtle" id="resetBtn" title="すべて未選択に戻します">リセット</button>
        <span class="hint">※途中保存：この端末のブラウザにのみ保存されます</span>
      </div>

      <div id="result" class="res-card" style="display:none;margin-top:12px"></div>
    `;
    host.appendChild(wrap);

    const grid = wrap.querySelector("#quizGrid");
    const progbar = wrap.querySelector("#progbar");
    const progressCount = wrap.querySelector("#progressCount");
    const qTotal = wrap.querySelector("#qTotal");

    const KEY = "iphone17quiz.v3";
    const saved = JSON.parse(localStorage.getItem(KEY) || "{}");

    qTotal.textContent = Q.length.toString();

    // build Qs
    Q.forEach((q, qi) => {
      const card = document.createElement("div"); card.className = "qcard";
      const title = document.createElement("div"); title.className = "qtitle";
      title.textContent = (qi+1) + ". " + q.t;
      const opts = document.createElement("div"); opts.className = "opts";

      q.o.forEach((optObj, oi) => {
        const id = `q${qi}_o${oi}`;
        const lab = document.createElement("label");
        const input = document.createElement("input");
        input.type = "radio"; input.name = `q${qi}`; input.value = oi; input.id = id;
        if (saved[`q${qi}`] == oi) input.checked = true;
        input.addEventListener("change", () => {
          saved[`q${qi}`] = oi;
          localStorage.setItem(KEY, JSON.stringify(saved));
          updateProgress();
        });
        const span = document.createElement("span"); span.textContent = optObj.label;
        lab.appendChild(input); lab.appendChild(span);
        opts.appendChild(lab);
      });

      card.append(title, opts);
      if (q.t.includes("カラー")) {
        const note = document.createElement("div");
        note.className = "hint";
        note.textContent = "※ 2025年のPro/Pro Maxに黒系はありません。ダーク系を選んだ場合は近い質感としてDeep Blueを提案します。";
        card.appendChild(note);
      }
      grid.appendChild(card);
    });

    function answeredCount(){ return Object.keys(saved).filter(k => k.startsWith("q")).length; }
    function updateProgress(){
      const n = answeredCount();
      progressCount.textContent = n.toString();
      const w = (n / Q.length * 100) | 0;
      progbar.style.width = w + "%";
    }
    updateProgress();

    const calcBtn = wrap.querySelector("#calcBtn");
    const resetBtn = wrap.querySelector("#resetBtn");
    const result = wrap.querySelector("#result");

    calcBtn.addEventListener("click", () => {
      if (answeredCount() < Q.length) {
        if (!confirm("未回答の質問があります。現在の回答で診断しますか？")) return;
      }
      const score = { Air:0, 17:0, Pro:0, ProMax:0 };
      Q.forEach((q, qi) => {
        const sel = saved[`q${qi}`];
        if (sel == null) return;
        const sc = q.o[sel].score;
        MODELS.forEach(m => { score[m] += (sc[m] || 0); });
      });

      // tie-breakers
      tweakByAnchors(saved, score);

      const sorted = Object.entries(score).sort((a,b) => b[1] - a[1]);
      const top = sorted[0];

      const advice = advisoryFor(top[0]);
      const rankHtml = sorted.map(([m,v]) =>
        `<div class="row"><span>${modelName(m)}</span><strong>${v} 点</strong></div>`
      ).join("");

      // Color choice note for transparency
      const colorQi = Q.findIndex(q => q.t.includes("好みのカラー"));
      let colorNote = "";
      if (colorQi !== -1) {
        const sel = saved[`q${colorQi}`];
        if (sel != null) {
          if (sel === 1) { // ダーク系（黒/グラファイト/濃紺）
            colorNote = "<p class=\"hint\">※ 黒系は現行の Pro/Pro Max にありません。近い質感として <strong>Deep Blue</strong> を提案しています。</p>";
          } else if (sel === 0) { // ライト系
            colorNote = "<p class=\"hint\">※ ライト系をご希望のため、質感が近い <strong>Silver/Light 系</strong> を優先提案しています。</p>";
          } else if (sel === 2) { // 明るい新色
            colorNote = "<p class=\"hint\">※ 明るい新色・限定色をご希望のため、今年の <strong>Cosmic Orange 等</strong> を優先提案しています。</p>";
          }
        }
      }

      result.style.display = "block";
      result.innerHTML = `
        <h3>診断結果：<span class="badge">おすすめ</span> ${modelName(top[0])}</h3>
        <p class="okay">${advice}</p>
        ${colorNote}
        <div class="rank" style="margin-top:10px">${rankHtml}</div>
        <div class="hint" style="margin-top:8px">※ 地域によってSIM仕様（eSIM/物理SIM）は異なる場合があります。購入前に各国/キャリアの販売仕様をご確認ください。</div>
      `;
      result.scrollIntoView({behavior:"smooth", block:"start"});
    });

    resetBtn.addEventListener("click", () => {
      if (!confirm("すべて未選択に戻します。よろしいですか？")) return;
      localStorage.removeItem(KEY);
      location.reload();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();