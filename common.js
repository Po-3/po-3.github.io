// common.js（置き換え版）
(function () {
  // ===== 基本ユーティリティ =====
  const ballColors = ['red','orange','yellow','yellowgreen','blue','purple','pink'];
  const CACHE_KEY = "tonari-latest-json";
  const CACHE_TTL = 5 * 60 * 1000; // 5分

  // 低コストのアイドル実行（requestIdleCallback が無い環境でも）
  const idle = (fn, timeout=1200) =>
    ('requestIdleCallback' in window)
      ? requestIdleCallback(fn, { timeout })
      : setTimeout(fn, 0);

  // 受信→JSON だけ。CDNキャッシュを活かすため**バスターは付けない**
  function fetchJson(url, { timeout=2000, signal } = {}) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeout);
    const s = signal || ctrl.signal;
    return fetch(url, { signal: s, credentials: 'omit', cache: 'default' })
      .then(r => r.ok ? r.json() : null)
      .catch(() => null)
      .finally(() => clearTimeout(t));
  }

  // 金額整形
  function formatYen(amount) {
    if (!Number.isFinite(+amount)) return "";
    amount = Math.floor(amount);
    const oku = Math.floor(amount / 1e8);
    const man = Math.floor((amount % 1e8) / 1e4);
    const en  = amount % 1e4;
    const arr = [];
    if (oku) arr.push(`${oku}億`);
    if (man) arr.push(`${man}万`);
    if (en || arr.length===0) arr.push(`${en}円`);
    return arr.join(' ');
  }

  // 色クラス
  const getLotoColorClass = (n) => 'loto-ball-' + ballColors[n % ballColors.length];

  // ====== 描画（DOM書き換えは1フレームに集約） ======
  function renderLatest(latest) {
    const wrap = document.getElementById('tonari-latest-carry');
    if (!wrap) return;

    const { type='', nums=[], bonus='', link='#', round='-', date='-' } = latest || {};
    const numStr = Array.isArray(nums) ? nums.join('・') : '';

    // キャリー要素
    const carryDefs = [
      { name: "ロト6 キャリーオーバー", amount: latest?.carry_loto6 || 0,
        icon: "https://cdn-ak.f.st-hatena.com/images/fotolife/n/numberhunter/20250726/20250726222053.jpg",
        link: "https://www.kujitonari.net/archive/category/ロト6" },
      { name: "ロト7 キャリーオーバー", amount: latest?.carry_loto7 || 0,
        icon: "https://cdn-ak.f.st-hatena.com/images/fotolife/n/numberhunter/20250726/20250726222056.jpg",
        link: "https://www.kujitonari.net/archive/category/ロト7" }
    ];

    let html = `
      <div style="font-weight:700;font-size:17px;margin-bottom:2px;color:#e89813;">
        🎯最新${type}結果 <span style="font-size:13.5px;color:#bb7400;">第${round}回</span>
      </div>
      <div style="font-size:12.5px;color:#825900;margin-bottom:3px;">${date}</div>
      <div style="font-size:16.5px;margin:2px 0 7px 0;letter-spacing:3px;">
        <span style="font-weight:700;color:#1a7bc9;">${numStr}</span><br/>
        <span style="font-size:12.5px;color:#a8870a;margin-left:7px;">ボーナス数字：${bonus}</span>
      </div>
      <a href="${link}" rel="noopener noreferrer"
         style="font-size:13px;background:#fff4c5;border:1px solid #f3cf7d;color:#b46d00;border-radius:8px;padding:5px 18px;text-decoration:none;display:inline-block;margin-top:5px;font-weight:700;">
        結果詳細を見る
      </a>
      <hr style="border:none;border-top:1.2px dotted #ffe099;margin:13px 0 10px 0;">
    `;

    for (const info of carryDefs) {
      const isCarry = info.amount > 0;
      html += `
        <div style="background:${isCarry ? "#ffe600" : "#a5dcf9"};border-radius:10px;box-shadow:0 2px 8px rgba(0,0,0,.10);margin-bottom:8px;padding:10px 10px 8px;display:flex;align-items:center;">
          <img src="${info.icon}" alt="${info.name}のアイコン" style="width:38px;height:38px;margin-right:10px;border-radius:50%;background:#fff;" loading="lazy" decoding="async">
          <div style="flex:1;text-align:left;">
            <div style="font-size:15px;font-weight:700;color:#222;">
              ${info.name}
              <span class="${isCarry ? "carry-flash" : ""}" style="background:${isCarry ? "#ea1212" : "#227be5"};color:#fff;padding:1.5px 7px;border-radius:6px;font-size:11.5px;margin-left:5px;display:inline-block;">
                ${isCarry ? "発生中" : "なし"}
              </span>
            </div>
            <div style="font-size:16.5px;font-weight:700;color:#222;margin:2px 0 2px 0;">
              ${ isCarry
                  ? `<span style="color:#1a7bc9;font-size:17px;letter-spacing:1px;">${formatYen(info.amount)}</span>`
                  : `<span style="color:#666;font-size:15px;">現在、キャリーオーバーはありません。</span>` }
            </div>
          </div>
        </div>`;
    }

    // 1回のreflowで反映
    requestAnimationFrame(() => {
      if (html.includes('carry-flash')) {
        const style = document.createElement('style');
        style.textContent =
          '@keyframes carry-flash{0%{background:#ea1212;color:#fff;box-shadow:0 0 9px 3px #ffe600,0 0 3px 1px #fff;}60%{background:#ffe600;color:#b00;box-shadow:0 0 14px 7px #fff388,0 0 5px 3px #ffe600;}100%{background:#ea1212;color:#fff;box-shadow:0 0 9px 3px #ffe600,0 0 3px 1px #fff;}} .carry-flash{animation:carry-flash 1.25s infinite alternate;border:1.3px solid #ffe600;box-shadow:0 0 9px 3px #ffe600,0 0 3px 1px #fff;}';
        document.head.appendChild(style);
      }
      wrap.innerHTML = html;
    });

    // === 以降のUIはアイドル時間に分離 ===
    idle(() => {
      // 日付ロトボール化（書き換え最小）
      document.querySelectorAll('.date.archive-date:not([data-lotoball])').forEach(el => {
        const y = el.querySelector('.date-year')?.textContent?.trim();
        const m = parseInt(el.querySelector('.date-month')?.textContent, 10);
        const d = parseInt(el.querySelector('.date-day')?.textContent, 10);
        if (!y || !Number.isFinite(m) || !(d>=1&&d<=31)) { el.dataset.lotoball='skip'; return; }
        const colorClass = getLotoColorClass(d-1);
        el.innerHTML =
          `<span class="loto-ball ${colorClass}">${d}</span><span class="loto-date-block"><span class="loto-date-month">${m}月</span><span class="loto-date-year">${y}</span></span>`;
        el.dataset.lotoball = 'done';
      });

      // サイドバー見出しのロトボール化
      document.querySelectorAll('.sidebar h3, .hatena-module-title, .hatena-module .module-title')
        .forEach(el => {
          if (el.dataset.lotoball) return;
          const text = el.textContent.trim();
          if (!text || el.querySelector('.loto-ball')) { el.dataset.lotoball='skip'; return; }
          const first = text[0], rest = text.slice(1);
          const key = /\d/.test(first) ? parseInt(first,10) : first.charCodeAt(0);
          el.innerHTML = `<span class="loto-ball ${getLotoColorClass(key)}">${first}</span>${rest}`;
          el.dataset.lotoball = 'done';
        });

      // h2に色データ属性（軽量、レイアウト不変更）
      document.querySelectorAll('.entry-content h2:not([data-color])')
        .forEach(el => el.setAttribute('data-color', ballColors[(Math.random()*ballColors.length)|0]));
    });
  }

  // ===== エントリーポイント =====
  document.addEventListener("DOMContentLoaded", () => {
    const wrap = document.getElementById('tonari-latest-carry');
    if (wrap) wrap.innerHTML = `<div style="font-size:13px;color:#999;">読込中...</div>`;

    // 5分キャッシュ → 失敗時のみメッセージ
    const now = Date.now();
    const cached = JSON.parse(sessionStorage.getItem(CACHE_KEY) || "null");
    if (cached?.timestamp && (now - cached.timestamp < CACHE_TTL) && cached.data) {
      renderLatest(cached.data);
    } else {
      fetchJson("https://po-3.github.io/latest.json").then(latest => {
        if (latest?.type) {
          sessionStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: now, data: latest }));
          renderLatest(latest);
        } else if (wrap) {
          wrap.innerHTML = `<span style="color:#eb5030;font-weight:700;">結果データ取得エラー</span>`;
        }
      });
    }

    // ===== 付随UI：軽量&遅延 =====

    // ページトップボタン（passive + rAF節電）
    const btn = document.getElementById('pageTop');
    if (btn) {
      let ticking = false;
      window.addEventListener('scroll', () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
          btn.style.display = window.scrollY > 100 ? 'block' : 'none';
          ticking = false;
        });
      }, { passive: true });
      btn.addEventListener('click', e => {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, { passive: true });
    }

    // シェアボタン（最小限の書き換え）
    idle(() => {
      const pageUrl = encodeURIComponent(location.href);
      const pageTitle = encodeURIComponent(document.title);
      document.querySelectorAll('.share-hatebu').forEach(el => el.href = `https://b.hatena.ne.jp/entry/${location.href}`);
      document.querySelectorAll('.share-x').forEach(el => el.href = `https://twitter.com/intent/tweet?text=${pageTitle}&url=${pageUrl}&hashtags=宝くじ,ロト6`);
    });

    // AdSense は **IntersectionObserver で実可視時に** 起動（TBTに効く）
    idle(() => {
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
    });
  });
})();