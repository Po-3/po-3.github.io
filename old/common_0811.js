(function () {
  // --- ロトボール配色とクラス名生成 ---
  const ballColors = ['red', 'orange', 'yellow', 'yellowgreen', 'blue', 'purple', 'pink'];
  function getLotoColorClass(n) {
    return 'loto-ball-' + ballColors[n % ballColors.length];
  }

  // 金額整形
  function formatYen(amount) {
    if (!amount || isNaN(amount)) return "";
    amount = Math.floor(amount);
    let oku = Math.floor(amount / 100000000);
    let man = Math.floor((amount % 100000000) / 10000);
    let en = amount % 10000;
    let arr = [];
    if (oku > 0) arr.push(`${oku}億`);
    if (man > 0) arr.push(`${man}万`);
    if (en > 0 || arr.length === 0) arr.push(`${en}円`);
    return arr.join(' ');
  }

  // fetchのタイムアウト＋Abort＋バスター＋エラー補強
  function fetchWithTimeout(url, timeout = 2000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    return fetch(url + '?_=' + Date.now(), { signal: controller.signal })
      .then(res => res.ok ? res.json() : null)
      .catch(() => null)
      .finally(() => clearTimeout(timer));
  }

  // キャッシュキーとTTL
  const CACHE_KEY = "tonari-latest-json";
  const CACHE_TTL = 5 * 60 * 1000; // 5分

  // 描画処理のみ分離
  function renderLatest(latest) {
    const wrapper = document.getElementById('tonari-latest-carry');
    if (!wrapper) return;
    const displayType = latest.type;
    const numStr = Array.isArray(latest.nums) ? latest.nums.join('・') : '';
    const bonusStr = latest.bonus || '';
    const link = latest.link || "#";
    const round = latest.round || "-";
    const date = latest.date || "-";

    let html = `
      <div style="font-weight:bold; font-size:17px; margin-bottom:2px; color:#e89813;">
        🎯最新${displayType}結果 <span style="font-size:13.5px; color:#bb7400;">第${round}回</span>
      </div>
      <div style="font-size:12.5px; color:#825900; margin-bottom:3px;">
        ${date}
      </div>
      <div style="font-size:16.5px; margin:2px 0 7px 0; letter-spacing:3px;">
        <span style="font-weight:bold; color:#1a7bc9;">${numStr}</span><br />
        <span style="font-size:12.5px; color:#a8870a; margin-left:7px;">
          ボーナス数字：${bonusStr}
        </span>
      </div>
      <a href="${link}" rel="noopener noreferrer"
        style="font-size:13px; background:#fff4c5; border:1px solid #f3cf7d; color:#b46d00; border-radius:8px; padding:5px 18px; text-decoration:none; display:inline-block; margin-top:5px; font-weight:bold;">
        結果詳細を見る
      </a>
      <hr style="border:none; border-top:1.2px dotted #ffe099; margin:13px 0 10px 0;">
    `;

    // キャリーオーバー表示
    const CARRY_YELLOW = "#ffe600";
    const CARRY_BLUE   = "#a5dcf9";
    [
      {
        name: "ロト6 キャリーオーバー",
        amount: latest.carry_loto6 || 0,
        icon: "https://cdn-ak.f.st-hatena.com/images/fotolife/n/numberhunter/20250726/20250726222053.jpg",
        link: "https://www.kujitonari.net/archive/category/ロト6"
      },
      {
        name: "ロト7 キャリーオーバー",
        amount: latest.carry_loto7 || 0,
        icon: "https://cdn-ak.f.st-hatena.com/images/fotolife/n/numberhunter/20250726/20250726222056.jpg",
        link: "https://www.kujitonari.net/archive/category/ロト7"
      }
        ].forEach(info => {
          let isCarry = info.amount > 0;
          let bgColor = isCarry ? CARRY_YELLOW : CARRY_BLUE;
          html += `
            <div style="background:${bgColor}; border-radius:10px; box-shadow:0 2px 8px rgba(0,0,0,0.10); margin-bottom:8px; padding:10px 10px 8px 10px; display:flex; align-items:center;">
             <img src="${info.icon}" alt="${info.name}のアイコン" style="width:38px; height:38px; margin-right:10px; border-radius:50%; background:#fff;" loading="lazy" decoding="async">              <div style="flex:1; text-align:left;">
                <div style="font-size:15px; font-weight:bold; color:#222;">
                  ${info.name}
                  <span class="carry-flash" style="background:${isCarry ? "#ea1212" : "#227be5"}; color:#fff; padding:1.5px 7px; border-radius:6px; font-size:11.5px; margin-left:5px; ${isCarry ? 'animation:carry-flash 1.25s infinite alternate; box-shadow:0 0 9px 3px #ffe600,0 0 3px 1px #fff; border:1.3px solid #ffe600;' : ''}; display:inline-block;">
                    ${isCarry ? "発生中" : "なし"}
                  </span>
                </div>
                <div style="font-size:16.5px; font-weight:bold; color:#222; margin:2px 0 2px 0;">
                  ${
                    isCarry
                    ? `<span style="color:#1a7bc9; font-size:17px; letter-spacing:1px;">${formatYen(info.amount)}</span>`
                    : `<span style="color:#666; font-size:15px;">現在、キャリーオーバーはありません。</span>`
                  }
                </div>
              </div>
            </div>
          `;
        });

    // --- アニメーションスタイル埋め込み（carry-flash使用時のみ） ---
    if (html.includes('carry-flash')) {
      html = `<style>@keyframes carry-flash{0%{background:#ea1212;color:#fff;box-shadow:0 0 9px 3px #ffe600,0 0 3px 1px #fff;}60%{background:#ffe600;color:#b00;box-shadow:0 0 14px 7px #fff388,0 0 5px 3px #ffe600;}100%{background:#ea1212;color:#fff;box-shadow:0 0 9px 3px #ffe600,0 0 3px 1px #fff;}}</style>` + html;
    }

    wrapper.innerHTML = html;

    // --- UIパーツ群（従来どおり） ---
  // --- 日付をロトボール化 ---
  document.querySelectorAll('.date.archive-date').forEach(function (el) {
    if (el.dataset.lotoball === "done") return;

    const yearEl = el.querySelector('.date-year');
    const monthEl = el.querySelector('.date-month');
    const dayEl = el.querySelector('.date-day');

    if (!yearEl || !monthEl || !dayEl) return;

    const year = yearEl.textContent.trim();
    const month = parseInt(monthEl.textContent.trim(), 10);
    const day = parseInt(dayEl.textContent.trim(), 10);

    if (isNaN(day) || day < 1 || day > 31) return;

    const colorClass = getLotoColorClass(day - 1);

    el.innerHTML =
      `<span class="loto-ball ${colorClass}">${day}</span>` +
      `<span class="loto-date-block">` +
        `<span class="loto-date-month">${month}月</span>` +
        `<span class="loto-date-year">${year}</span>` +
      `</span>`;

    el.dataset.lotoball = "done";
  });

    // サイドバー見出しのロトボール化
    document.querySelectorAll('.sidebar h3, .hatena-module-title, .hatena-module .module-title').forEach(function (el) {
      if (el.dataset.lotoball === "done") return;
      const text = el.textContent.trim();
      if (!text || el.querySelector('.loto-ball')) return;
      const firstChar = text[0];
      const rest = text.slice(1);
      let colorKey = 0;
      if (/\\d/.test(firstChar)) {
        colorKey = parseInt(firstChar, 10);
      } else {
        colorKey = firstChar.charCodeAt(0);
      }
      const colorClass = getLotoColorClass(colorKey);
      el.innerHTML = `<span class="loto-ball ${colorClass}">${firstChar}</span>${rest}`;
      el.dataset.lotoball = "done";
    });

    // 記事内h2見出しにランダムロトボール背景
    document.querySelectorAll('.entry-content h2').forEach(function (el) {
      const color = ballColors[Math.floor(Math.random() * ballColors.length)];
      el.setAttribute('data-color', color);
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    const wrapper = document.getElementById('tonari-latest-carry');
    if (!wrapper) return;
    wrapper.innerHTML = `<div style="font-size:13px; color:#999;">読込中...</div>`;

    // キャッシュ確認→fetch→描画
    const now = Date.now();
    const cached = JSON.parse(sessionStorage.getItem(CACHE_KEY) || "{}");
    if (cached.timestamp && now - cached.timestamp < CACHE_TTL && cached.data) {
      renderLatest(cached.data);
    } else {
      fetchWithTimeout("https://po-3.github.io/latest.json", 2000).then(latest => {
        if (latest && latest.type) {
          sessionStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: now, data: latest }));
          renderLatest(latest);
        } else {
          wrapper.innerHTML = `<span style='color:#eb5030; font-weight:bold;'>結果データ取得エラー</span>`;
        }
      });
    }

    // ◆◆ UIパーツ群（シェアボタン自動生成・ページトップボタン・AdSense遅延ロード）◆◆

    // ページトップボタン
    const btn = document.getElementById('pageTop');
    if (btn) {
      window.addEventListener('scroll', function () {
        btn.style.display = window.scrollY > 100 ? 'block' : 'none';
      });
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }

    // シェアボタン
    const pageUrl = encodeURIComponent(location.href);
    const pageTitle = encodeURIComponent(document.title);
    document.querySelectorAll('.share-hatebu').forEach(el => {
      el.href = `https://b.hatena.ne.jp/entry/${location.href}`;
    });
    document.querySelectorAll('.share-x').forEach(el => {
      el.href = `https://twitter.com/intent/tweet?text=${pageTitle}&url=${pageUrl}&hashtags=宝くじ,ロト6`;
    });

    // AdSense 遅延ロード
    if ('requestIdleCallback' in window) {
      requestIdleCallback(loadAdsense, { timeout: 1000 });
    } else {
      setTimeout(loadAdsense, 800);
    }
    function loadAdsense() {
      const ad = document.createElement('ins');
      ad.className = "adsbygoogle";
      ad.style.display = "block";
      ad.setAttribute("data-ad-client", "ca-pub-2136896785327919");
      ad.setAttribute("data-ad-slot", "1104983477");
      ad.setAttribute("data-ad-format", "auto");
      ad.setAttribute("data-full-width-responsive", "true");
      const adsenseParent = document.getElementById("profile-adsense");
      if (adsenseParent) {
        adsenseParent.appendChild(ad);
        if (window.adsbygoogle) window.adsbygoogle.push({});
      }
    }
  });
})();