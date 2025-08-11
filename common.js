/* common.js v2025-08-11-lcp-sniper
 * 目的：LCP/FCP/TBT 改善（初期は最小、装飾は遅延）
 * 読み込み側は必ず <script src=".../common.js" defer></script>
 */
(function () {
  // ====== 設定 ======
  const ballColors = ['red','orange','yellow','yellowgreen','blue','purple','pink'];
  const CACHE_KEY = "tonari-latest-json:v1";
  const CACHE_TTL_MS = 5 * 60 * 1000;
  const LATEST_URL = "https://po-3.github.io/latest.json";

  // ====== ユーティリティ ======
  const now = () => Date.now();
  const idle = (fn, timeout=1200) =>
    ('requestIdleCallback' in window) ? requestIdleCallback(fn, { timeout }) : setTimeout(fn, 0);
  const raf = (fn) =>
    ('requestAnimationFrame' in window) ? requestAnimationFrame(fn) : setTimeout(fn, 0);

  function fetchJson(url, { timeout=2000 } = {}) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeout);
    return fetch(url, { signal: ctrl.signal, cache: 'default', credentials: 'omit' })
      .then(r => r.ok ? r.json() : null)
      .catch(() => null)
      .finally(() => clearTimeout(t));
  }

  function getLotoColorClass(n){ return 'loto-ball-' + ballColors[n % ballColors.length]; }

  function formatYen(amount) {
    if (!Number.isFinite(+amount)) return "";
    amount = Math.floor(amount);
    const oku = Math.floor(amount / 1e8);
    const man = Math.floor((amount % 1e8) / 1e4);
    const en  = amount % 1e4;
    const out = [];
    if (oku) out.push(`${oku}億`);
    if (man) out.push(`${man}万`);
    if (en || out.length === 0) out.push(`${en}円`);
    return out.join(' ');
  }

  // ====== ランタイムで「今このページのLCP候補」を即座にpreload ======
  function preloadLikelyLCP() {
    try {
      const links = new Set();
      const vh = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);

      // 0) og:image を最優先候補に（記事詳細でLCPになりがち）
      const og = document.querySelector('meta[property="og:image"]')?.content;
      if (og) links.add(new URL(og, location.href).href);

      // 1) 初回ビューポート内の大きい<img>を収集
      const imgCandidates = Array.from(document.images).filter(img => {
        const r = img.getBoundingClientRect();
        return r.top < vh && r.bottom > 0; // 画面内
      });

      // 2) 背景画像系（ヒーロー/サムネのdiv）も収集
      const bgCandidates = Array.from(document.querySelectorAll(
        '.entry-figure, .entry-hero, .entry-thumb, header .eyecatch, .archive-entry .thumb, .hatena-post img'
      ));

      // スコアリング：画面内面積 × 解像度係数（雑だが軽い）
      function scoreRect(el) {
        const r = el.getBoundingClientRect();
        const area = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0)) * Math.max(0, r.width);
        return area;
      }

      let bestImg = null, bestImgScore = 0;
      for (const img of imgCandidates) {
        const s = scoreRect(img) * (Math.max(img.naturalWidth, 1) * Math.max(img.naturalHeight, 1) > 400*300 ? 1.2 : 1);
        if (s > bestImgScore) { bestImgScore = s; bestImg = img; }
      }

      let bestBgUrl = "", bestBgScore = 0;
      for (const el of bgCandidates) {
        const bg = getComputedStyle(el).backgroundImage || "";
        const m = bg.match(/url\(["']?(.*?)["']?\)/);
        const abs = m && m[1] ? new URL(m[1], location.href).href : "";
        if (!abs) continue;
        const s = scoreRect(el);
        if (s > bestBgScore) { bestBgScore = s; bestBgUrl = abs; }
      }

      // どちらが強いかで採用（両方あれば両方preloadしてもOK）
      if (bestImg && bestImg.currentSrc) links.add(bestImg.currentSrc || bestImg.src);
      if (bestBgUrl) links.add(bestBgUrl);

      // preload差し込み＋fetchpriorityを引き上げ
      let count = 0;
      for (const href of links) {
        if (!href) continue;
        const link = document.createElement('link');
        link.rel = 'preload';
        link.as  = 'image';
        link.href = href;
        link.crossOrigin = 'anonymous';
        document.head.appendChild(link);
        count++;
      }

      // 該当<img>の優先度も上げる（ChromeのPriority Hints）
      if (bestImg) {
        try {
          bestImg.setAttribute('fetchpriority', 'high');
          bestImg.setAttribute('decoding', 'async'); // デコードでメインブロックしない
          bestImg.setAttribute('loading', 'eager');  // LCP対象は遅延しない
        } catch {}
      }

      // 背景画像しかないケースも考慮して preconnect（CDNをよく使うなら）
      const cdn = (href) => {
        try { return new URL(href).origin; } catch { return ""; }
      };
      const origins = new Set(Array.from(links).map(cdn).filter(Boolean));
      for (const o of origins) {
        const l = document.createElement('link');
        l.rel = 'preconnect';
        l.href = o;
        l.crossOrigin = 'anonymous';
        document.head.appendChild(l);
      }
    } catch {}
  }

  // ====== LCPに関わる最小描画 ======
  function renderLatest(latest) {
    const wrap = document.getElementById('tonari-latest-carry');
    if (!wrap) return;

    const type  = latest?.type  ?? "";
    const nums  = Array.isArray(latest?.nums) ? latest.nums.join('・') : "";
    const bonus = latest?.bonus ?? "";
    const round = latest?.round ?? "-";
    const date  = latest?.date  ?? "-";

    let link = "#";
    switch (type) {
      case "ロト6": link = "https://po-3.github.io/loto6-data/"; break;
      case "ミニロト": link = "https://po-3.github.io/miniloto-data/"; break;
      case "ロト7": link = "https://po-3.github.io/loto7-data/"; break;
    }

    const carryDefs = [
      { name: "ロト6 キャリーオーバー", amount: latest?.carry_loto6 || 0,
        icon: "https://cdn-ak.f.st-hatena.com/images/fotolife/n/numberhunter/20250726/20250726222053.jpg",
        link: "https://www.kujitonari.net/archive/category/ロト6", w: 38, h: 38 },
      { name: "ロト7 キャリーオーバー", amount: latest?.carry_loto7 || 0,
        icon: "https://cdn-ak.f.st-hatena.com/images/fotolife/n/numberhunter/20250726/20250726222056.jpg",
        link: "https://www.kujitonari.net/archive/category/ロト7", w: 38, h: 38 }
    ];

    let html = `
      <div style="font-weight:700;font-size:17px;margin-bottom:2px;color:#e89813;">
        🎯最新${type}結果 <span style="font-size:13.5px;color:#bb7400;">第${round}回</span>
      </div>
      <div style="font-size:12.5px;color:#825900;margin-bottom:3px;">${date}</div>
      <div style="font-size:16.5px;margin:2px 0 7px 0;letter-spacing:3px;">
        <span style="font-weight:700;color:#1a7bc9;">${nums}</span><br/>
        <span style="font-size:12.5px;color:#a8870a;margin-left:7px;">ボーナス数字：${bonus}</span>
      </div>
      <a href="${link}" rel="noopener noreferrer"
         style="font-size:13px;background:#fff4c5;border:1px solid #f3cf7d;color:#b46d00;border-radius:8px;padding:5px 18px;text-decoration:none;display:inline-block;margin-top:5px;font-weight:700;">
        結果詳細を見る
      </a>
      <hr style="border:none;border-top:1.2px dotted #ffe099;margin:13px 0 10px 0;">
    `;

    for (const c of carryDefs) {
      const active = c.amount > 0;
      html += `
        <div style="background:${active ? "#ffe600" : "#a5dcf9"};border-radius:10px;box-shadow:0 2px 8px rgba(0,0,0,.10);margin-bottom:8px;padding:10px 10px 8px;display:flex;align-items:center;">
          <img src="${c.icon}" alt="${c.name}のアイコン" width="${c.w}" height="${c.h}"
               loading="lazy" decoding="async" style="margin-right:10px;border-radius:50%;background:#fff;">
          <div style="flex:1;text-align:left;">
            <div style="font-size:15px;font-weight:700;color:#222;">
              ${c.name}
              <span class="${active ? "carry-flash" : ""}"
                    style="background:${active ? "#ea1212" : "#227be5"};color:#fff;padding:1.5px 7px;border-radius:6px;font-size:11.5px;margin-left:5px;display:inline-block;">
                ${active ? "発生中" : "なし"}
              </span>
            </div>
            <div style="font-size:16.5px;font-weight:700;color:#222;margin:2px 0 2px 0;">
              ${ active
                 ? `<span style="color:#1a7bc9;font-size:17px;letter-spacing:1px;">${formatYen(c.amount)}</span>`
                 : `<span style="color:#666;font-size:15px;">現在、キャリーオーバーはありません。</span>` }
            </div>
          </div>
        </div>`;
    }

    raf(() => { wrap.innerHTML = html; });
  }

  function initDecorations() {
    document.querySelectorAll('.date.archive-date:not([data-lotoball])').forEach(el => {
      const y = el.querySelector('.date-year')?.textContent?.trim();
      const m = parseInt(el.querySelector('.date-month')?.textContent, 10);
      const d = parseInt(el.querySelector('.date-day')?.textContent, 10);
      if (!y || !Number.isFinite(m) || !(d>=1&&d<=31)) { el.dataset.lotoball='skip'; return; }
      el.innerHTML =
        `<span class="loto-ball ${getLotoColorClass(d-1)}">${d}</span>` +
        `<span class="loto-date-block"><span class="loto-date-month">${m}月</span><span class="loto-date-year">${y}</span></span>`;
      el.dataset.lotoball = 'done';
    });

    document.querySelectorAll('.sidebar h3, .hatena-module-title, .hatena-module .module-title').forEach(el => {
      if (el.dataset.lotoball || !el.textContent) return;
      const t = el.textContent.trim();
      if (!t || el.querySelector('.loto-ball')) { el.dataset.lotoball='skip'; return; }
      const first = t[0], rest = t.slice(1);
      const key = /\d/.test(first) ? parseInt(first,10) : first.charCodeAt(0);
      el.innerHTML = `<span class="loto-ball ${getLotoColorClass(key)}">${first}</span>${rest}`;
      el.dataset.lotoball = 'done';
    });

    document.querySelectorAll('.entry-content h2:not([data-color])')
      .forEach(el => el.setAttribute('data-color', ballColors[(Math.random()*ballColors.length)|0]));
  }

  function initPageTop() {
    const btn = document.getElementById('pageTop');
    if (!btn) return;
    let ticking = false;
    window.addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      raf(() => {
        btn.style.display = window.scrollY > 100 ? 'block' : 'none';
        ticking = false;
      });
    }, { passive: true });
    btn.addEventListener('click', e => {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, { passive: true });
  }

  function initShare() {
    const pageUrl = encodeURIComponent(location.href);
    const pageTitle = encodeURIComponent(document.title);
    document.querySelectorAll('.share-hatebu').forEach(el => el.href = `https://b.hatena.ne.jp/entry/${location.href}`);
    document.querySelectorAll('.share-x').forEach(el => el.href = `https://twitter.com/intent/tweet?text=${pageTitle}&url=${pageUrl}&hashtags=宝くじ,ロト6`);
  }

  function initAdsenseLazy() {
    const slot = document.getElementById("profile-adsense");
    if (!slot) return;
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        const ad = document.createElement('ins');
        ad.className = "adsbygoogle";
        ad.style.display = "block";
        ad.setAttribute("data-ad-client", "ca-pub-2136896785327919");
        ad.setAttribute("data-ad-slot", "1104983477");
        ad.setAttribute("data-ad-format", "auto");
        ad.setAttribute("data-full-width-responsive", "true");
        slot.appendChild(ad);
        if (window.adsbygoogle) window.adsbygoogle.push({});
        io.disconnect();
      });
    }, { rootMargin: "600px 0px" });
    io.observe(slot);
  }

  // ====== 起動 ======
  document.addEventListener("DOMContentLoaded", () => {
    // LCP候補を即preload（この一手でFCP/LCPを一段引き下げ）
    preloadLikelyLCP();

    const wrap = document.getElementById('tonari-latest-carry');
    if (wrap) wrap.innerHTML = `<div style="font-size:13px;color:#999;">読込中...</div>`;

    const readCache = () => {
      const s = localStorage.getItem(CACHE_KEY) || sessionStorage.getItem(CACHE_KEY);
      if (!s) return null;
      try { return JSON.parse(s); } catch { return null; }
    };
    const writeCache = (data) => {
      const payload = JSON.stringify({ timestamp: now(), data });
      try { localStorage.setItem(CACHE_KEY, payload); } catch {}
      try { sessionStorage.setItem(CACHE_KEY, payload); } catch {}
    };

    const cached = readCache();
    if (cached?.timestamp && (now() - cached.timestamp < CACHE_TTL_MS) && cached.data) {
      renderLatest(cached.data);
    } else {
      fetchJson(LATEST_URL, { timeout: 2000 }).then(latest => {
        if (latest?.type) {
          writeCache(latest);
          renderLatest(latest);
        } else if (wrap) {
          wrap.innerHTML = `<span style="color:#eb5030;font-weight:700;">結果データ取得エラー</span>`;
        }
      });
    }

    idle(() => {
      initDecorations();
      initPageTop();
      initShare();
      initAdsenseLazy();
    });
  });
})();