(() => {
  // ===== 設定 =====
  const FEEDS = {
    loto6:    "https://po-3.github.io/loto6-data/loto6.json",
    miniloto: "https://po-3.github.io/miniloto-data/miniloto.json",
    loto7:    "https://po-3.github.io/loto7-data/loto7.json",
  };
  // JSのgetDay(): Sun=0 ... Sat=6
  const DRAW_DAY = { loto6:[1,4], miniloto:[2], loto7:[5] };
  const TTL_MS = 10 * 60 * 1000; // 10分キャッシュ

  // ===== game-specific weights (att:注目, carry:キャリー, part:参加, bonus:ボーナス) 0.0..1.0 =====
  const WEIGHTS = {
    loto6:    { att: 0.30, carry: 0.40, part: 0.20, bonus: 1.00, social: 0.10 },
    miniloto: { att: 0.45, carry: 0.00, part: 0.35, bonus: 1.00, social: 0.20 },
    loto7:    { att: 0.25, carry: 0.60, part: 0.15, bonus: 1.00, social: 0.10 },
  };

  // ===== utils =====
  const $  = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
  const JPY = (x) => (x || 0).toLocaleString("ja-JP");
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  function daysUntilDraw(game){
    const now = new Date();
    const today = now.getDay(); // 0..6
    let delta = 7;
    for(const d of DRAW_DAY[game]){
      const diff = (d - today + 7) % 7;
      delta = Math.min(delta, diff);
    }
    return delta; // 0=当日, 1=前日, ...
  }
  function attentionScore(game){
    const d = daysUntilDraw(game);
    if(d === 0) return 100;
    if(d === 1) return 70;
    if(d === 2) return 40;
    return 20;
  }
  function participantApprox(game){
    const d = daysUntilDraw(game);
    if(d === 0) return 20; // 当日
    if(d === 1) return 10; // 前日
    return 0;
  }
  function carryScore(yen){
    const bn = Number(yen || 0);
    if(!isFinite(bn) || bn <= 0) return 0;
    // 1億=1点, 10億=100点相当（ロト7も見据え上限100にクランプ）
    const s = (bn / 1_0000_0000) * 10;
    return clamp(Math.round(s), 0, 100);
  }
  function rarityBonus(nums){
    if(!Array.isArray(nums) || !nums.length) return 0;
    const sum = nums.reduce((a,b)=>a+b, 0);
    const allEven = nums.every(n => n % 2 === 0);
    const allOdd  = nums.every(n => n % 2 === 1);
    const tails = {};
    nums.forEach(n => tails[n % 10] = (tails[n % 10] || 0) + 1);
    const maxTail = Math.max(...Object.values(tails));
    let bonus = 0;
    if(allEven || allOdd) bonus += 4;
    // 合計の極端さ（ざっくり正規化）：ロト7最大幅を上限に正規化
    const maxSum = 43 * 7;
    const dev = Math.abs(sum - (maxSum / 2)) / (maxSum / 2);
    if(dev > 0.35) bonus += 3;
    if(maxTail >= 3) bonus += 3;
    return clamp(bonus, 0, 10);
  }

  // X等の外部APIなしで近似する軽量バズスコア（0..100）
  function buzzProxyScore(game, payload){
    const { carry=0, prevCarry=0, streak=0 } = payload || {};
    // 1) キャリー増加率（直近の盛り上がりの変化）
    const delta = Math.max(carry - prevCarry, 0);
    const deltaScore = clamp(Math.round((delta / 1_0000_0000) * 40), 0, 40); // +10億で+40点上限
    // 2) 連続キャリー回数（話題の継続性）
    const streakScore = clamp(streak * 8, 0, 40); // 1回=+8, 5回で+40上限
    // 3) 当日ブースト（SNSが動きやすい）
    const att = attentionScore(game); // 0..100
    const dayBoost = Math.round(att * 0.2); // 最大+20
    // ミニロトはキャリーが無いので、deltaは効かない→日付/連続性をより重視
    return clamp(deltaScore + streakScore + dayBoost, 0, 100);
  }

  function getCache(key){
    try{
      const raw = localStorage.getItem(key);
      if(!raw) return null;
      const { ts, data } = JSON.parse(raw);
      if(Date.now() - ts > TTL_MS) return null;
      return data;
    }catch{ return null; }
  }
  function setCache(key, data){
    try{ localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data })); }catch{}
  }

  // ===== ツールチップ文言（iアイコン内）をユーザー向けに上書き =====
  function setTooltipText(){
    const text = `注目度：抽せんまでの残り時間で加点（当日>前日>それ以外）
キャリー額：最新回の繰越金を指標化
参加人数：当日・前日を考慮した近似
＋ボーナス：出目の特徴などで加点
背景色：スコアに応じて赤→緑に変化`;
    document.querySelectorAll('.info-icon .tooltip').forEach(el=>{ el.textContent = text; });
  }

  async function fetchLatest(url, game){
    const CK = "meter:" + game;
    const cached = getCache(CK);
    if(cached) return cached;

    const r = await fetch(url, { cache: "default" }); // ブラウザHTTPキャッシュ活用
    const data = await r.json();
    const arr = Array.isArray(data) ? data : [data];
    const last = arr[arr.length - 1];
    const prev = arr[arr.length - 2] || null;

    const date  = last["日付"] ?? last["date"] ?? last["抽せん日"] ?? last["draw_date"];
    const carry = +(last["キャリーオーバー"] ?? last["carry"] ?? last["キャリー"] ?? 0);

    // 直前回のキャリーと差分
    const prevCarry = prev ? +(prev["キャリーオーバー"] ?? prev["carry"] ?? prev["キャリー"] ?? 0) : 0;

    // 連続キャリー回数（末尾から遡って >0 の回数）
    let streak = 0;
    for(let i=arr.length-1; i>=0; i--){
      const c = +(arr[i]["キャリーオーバー"] ?? arr[i]["carry"] ?? arr[i]["キャリー"] ?? 0);
      if(c>0) streak++; else break;
    }

    // 数字抽出（第1数字〜第7数字／num1〜）
    const nums = [];
    for(let i=1;i<=7;i++){
      const v = last[`第${i}数字`] ?? last[`num${i}`] ?? last[`第${i}数`];
      if(Number.isFinite(+v)) nums.push(+v);
    }

    const out = { raw:last, date, carry, prevCarry, streak, nums };
    setCache(CK, out);
    return out;
  }

  function renderCard(card, payload){
    const meta  = $('[data-meta]', card);
    const hint  = $('[data-hint]', card);
    const fill  = $('.loto-fill', card);
    const score = $('.loto-score', card);

    const game = card.dataset.game;
    let { date, carry, nums } = payload;

    // ミニロトはキャリーが無いためスコアには反映しない
    if (game === "miniloto") carry = 0;

    // 重み設定（ロト別）
    const W = WEIGHTS[game] || { att: 0.30, carry: 0.50, part: 0.20, bonus: 1.00 };

    // スコア算出（ロト別の重みで合成）
    const sAttention = attentionScore(game);   // 0..100
    const sCarry     = carryScore(carry);      // 0..100
    const sPart      = participantApprox(game); // 0..20（後で×5で0..100化）
    const sRarity    = rarityBonus(nums);      // 0..10（そのまま加点）
    const sBuzz     = buzzProxyScore(game, payload); // 0..100（JSのみ・外部APIなし）

    const composite =
      (sAttention * W.att) +
      (sCarry     * W.carry) +
      ((sPart * 5) * W.part) +
      (sRarity * W.bonus) +
      (sBuzz * (W.social || 0));

    const final = clamp(Math.round(composite), 0, 100);

    // 表示（width方式：CSSのtransition: widthに合わせる）
    fill.style.width = `${final}%`;
    score.textContent = `${final} 点`;
    // 盛り上がり度に応じて背景色を変える（0=赤 → 100=緑）
    const hue = Math.round((final / 100) * 120);            // 0:赤, 120:緑
    const bg  = `hsl(${hue}, 80%, 92%)`;                    // やや薄めの背景
    const brd = `hsl(${hue}, 70%, 75%)`;                    // 枠線も近い色に
    card.style.background = bg;
    card.style.borderColor = brd;
    // なめらかに切り替え
    if (!card.style.transition) card.style.transition = 'background .4s ease, border-color .4s ease';

    if (game === "miniloto") {
      meta.textContent = `最新回: ${date || "—"} ／ キャリーなし ／ 数字: ${nums.length ? nums.map(n=>String(n).padStart(2,"0")).join("・") : "—"}`;
    } else {
      meta.textContent = `最新回: ${date || "—"} ／ 繰越金: ¥${JPY(carry)} ／ 数字: ${nums.length ? nums.map(n=>String(n).padStart(2,"0")).join("・") : "—"}`;
    }
    const attPts   = Math.round(sAttention * W.att);
    const carryPts = Math.round(sCarry * W.carry);
    const partPts  = Math.round((sPart * 5) * W.part);
    const bonusPts = Math.round((sRarity * W.bonus) + (sBuzz * (W.social || 0))); // バズ分はボーナスに含めて表示
    hint.textContent = `内訳: 注目${attPts}点 + キャリー${carryPts}点 + 参加${partPts}点 + ボーナス${bonusPts}点`;
  }

  async function init(){
    const cards = $$('.loto-meter');
    const tasks = cards.map(c => fetchLatest(FEEDS[c.dataset.game], c.dataset.game));
    const settled = await Promise.allSettled(tasks);
    settled.forEach((res, i) => {
      const card = cards[i];
      if(res.status === "fulfilled"){
        renderCard(card, res.value);
      }else{
        $('.loto-score', card).textContent = "— 点";
        $('[data-meta]', card).textContent = "データ取得に失敗しました";
        $('[data-hint]', card).textContent = String(res.reason || "");
      }
    });
  }

  // 遅延初期化（見えたら or アイドル時）
  const root = document.getElementById('loto-meter-root');
  const start = () => { setTooltipText(); init(); if(obs) obs.disconnect(); };
  let obs;
  if(root && 'IntersectionObserver' in window){
    obs = new IntersectionObserver(entries => {
      if(entries.some(e => e.isIntersecting)) start();
    }, { rootMargin: "0px 0px 200px 0px" });
    obs.observe(root);
  }
  (window.requestIdleCallback || ((fn)=>setTimeout(fn,500)))(start);
})();