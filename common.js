(function () {
  // --- 共通関数 ---
  function formatYen(amount) {
    if (!amount) return "";
    amount = Math.floor(amount);
    let oku = Math.floor(amount / 100000000);
    let man = Math.floor((amount % 100000000) / 10000);
    let en = amount % 10000;
    let arr = [];
    if (oku > 0) arr.push(`${oku}億`);
    if (man > 0) arr.push(`${man}万`);
    if (en > 0 || arr.length === 0) arr.push(`${en.toLocaleString()}円`);
    return arr.join(' ');
  }

  // --- 最新ロトデータ取得＆表示 ---
  Promise.all([
    fetch("https://po-3.github.io/miniloto-data/miniloto.json").then(res => res.ok ? res.json() : null),
    fetch("https://po-3.github.io/loto6-data/loto6.json").then(res => res.ok ? res.json() : null),
    fetch("https://po-3.github.io/loto7-data/loto7.json").then(res => res.ok ? res.json() : null),
  ]).then(([mini, l6, l7]) => {
    let html = "";

    // 最新回取得
    const miniLast = mini && mini[mini.length - 1];
    const l6Last = l6 && l6[l6.length - 1];
    const l7Last = l7 && l7[l7.length - 1];

    // 最新日時で最も新しい回を先頭に
    const results = [
      miniLast ? {
        type: "ミニロト",
        date: miniLast["日付"] || "",
        round: miniLast["開催回"] || "",
        nums: [miniLast["第1数字"], miniLast["第2数字"], miniLast["第3数字"], miniLast["第4数字"], miniLast["第5数字"]].join('・'),
        bonus: miniLast["ボーナス数字"] ?? "",
        link: "https://po-3.github.io/miniloto-data/"
      } : null,
      l6Last ? {
        type: "ロト6",
        date: l6Last["日付"] || "",
        round: l6Last["開催回"] || "",
        nums: [l6Last["第1数字"], l6Last["第2数字"], l6Last["第3数字"], l6Last["第4数字"], l6Last["第5数字"], l6Last["第6数字"]].join('・'),
        bonus: l6Last["ボーナス数字"] ?? "",
        link: "https://po-3.github.io/loto6-data/"
      } : null,
      l7Last ? {
        type: "ロト7",
        date: l7Last["日付"] || "",
        round: l7Last["開催回"] || "",
        nums: [l7Last["第1数字"], l7Last["第2数字"], l7Last["第3数字"], l7Last["第4数字"], l7Last["第5数字"], l7Last["第6数字"], l7Last["第7数字"]].join('・'),
        bonus: (l7Last["BONUS数字1"] && l7Last["BONUS数字2"])
          ? l7Last["BONUS数字1"] + "／" + l7Last["BONUS数字2"]
          : "",
        link: "https://po-3.github.io/loto7-data/"
      } : null
    ].filter(Boolean);

    results.sort((a, b) => new Date(b.date) - new Date(a.date));
    const latest = results[0];

    // 最新結果HTML
    if (latest) {
html += `
  <div class="loto-result-title">
    <span class="emoji">🎯</span>最新${latest.type}結果
    <span style="font-size:0.93em;color:#bb7400;font-weight:600;margin-left:4px;">第${latest.round}回</span>
  </div>
  <div class="loto-result-date">
    ${latest.date}
  </div>
  <div class="loto-result-nums">
    ${latest.nums}
    <span class="loto-result-bonus">（ボ：${latest.bonus}）</span>
  </div>
  <a href="${latest.link}" rel="noopener noreferrer" class="loto-result-link">
    <i class="fa-solid fa-circle-arrow-right" style="margin-right:7px;"></i>結果詳細を見る
  </a>
  <hr>
`;
[
  {
    name: "ロト6 キャリーオーバー",
    data: l6Last,
    logo: "https://cdn-ak.f.st-hatena.com/images/fotolife/n/numberhunter/20250522/20250522171220.png",
    link: "https://www.kujitonari.net/archive/category/ロト6",
    label: "発生中",
    labelClass: "loto-carry-label",
    boxClass: "loto-carry-box"
  },
  {
    name: "ロト7 キャリーオーバー",
    data: l7Last,
    logo: "https://cdn-ak.f.st-hatena.com/images/fotolife/n/numberhunter/20250522/20250522171452.png",
    link: "https://www.kujitonari.net/archive/category/ロト7",
    label: "キャリーなし",
    labelClass: "loto-carry-label loto-carry-none",
    boxClass: "loto-carry-box loto-carry-none"
  }
].forEach(info => {
  let amount = info.data && info.data["キャリーオーバー"] ? info.data["キャリーオーバー"] : 0;
  let isCarry = amount > 0 && info.name.includes('ロト6');
  html += `
    <div class="${isCarry ? info.boxClass : info.boxClass + ' loto-carry-none'}">
      <img src="${info.logo}" class="loto-carry-logo" loading="lazy" decoding="async">
      <div class="loto-carry-content">
        <div class="loto-carry-title">
          ${info.name}
          <span class="${info.labelClass}">
            ${isCarry ? "発生中" : "キャリーなし"}
          </span>
        </div>
        <div class="loto-carry-sub">
          【第${info.data && info.data["開催回"] ? info.data["開催回"] : "-"}回（${info.data && info.data["日付"] ? info.data["日付"] : "-"}）時点】
        </div>
        <div class="loto-carry-amount">
          ${isCarry
            ? `<span>${formatYen(amount)}</span>`
            : `現在、キャリーオーバーはありません。`
          }
        </div>
      </div>
    </div>
  `;
});

    // アニメーション埋め込み
    if (html.includes('carry-flash')) {
      html = `<style>@keyframes carry-flash{0%{background:#ea1212;color:#fff;box-shadow:0 0 9px 3px #ffe600,0 0 3px 1px #fff;}60%{background:#ffe600;color:#b00;box-shadow:0 0 14px 7px #fff388,0 0 5px 3px #ffe600;}100%{background:#ea1212;color:#fff;box-shadow:0 0 9px 3px #ffe600,0 0 3px 1px #fff;}}</style>` + html;
    }
    document.getElementById('tonari-latest-carry').innerHTML = html;
  });

  // --- DOMContentLoadedまとめて1本化 ---
  document.addEventListener("DOMContentLoaded", function () {
    const ballColors = ['red', 'orange', 'yellow', 'yellowgreen', 'blue', 'purple', 'pink'];

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

    // 記事一覧：日付をロトボール化
    document.querySelectorAll('.archive-entries .date').forEach(function (el) {
      const match = el.textContent.match(/(\d{4})[./-](\d{1,2})[./-](\d{1,2})/);
      if (match) {
        const [_, year, month, day] = match;
        const colorClass = 'loto-ball-' + ballColors[(day - 1) % ballColors.length];
        el.innerHTML = `
          <span class="loto-ball ${colorClass}">${day}</span>
          <span class="loto-date-block">
            <span class="loto-date-month">${month}月</span>
            <span class="loto-date-year">${year}</span>
          </span>
        `;
      }
    });

    // サイドバー見出し：先頭1文字をロトボール化
    document.querySelectorAll('.sidebar h3, .hatena-module-title, .hatena-module .module-title').forEach(function (el) {
      const text = el.textContent.trim();
      if (!text || el.querySelector('.loto-ball')) return;
      const firstChar = text[0];
      const rest = text.slice(1);
      const colorClass = 'loto-ball-' + ballColors[firstChar.charCodeAt(0) % ballColors.length];
      el.innerHTML = `<span class="loto-ball ${colorClass}">${firstChar}</span>${rest}`;
    });

    // 記事内見出し：h2にランダムロトボール背景
    document.querySelectorAll('.entry-content h2').forEach(function (el) {
      const color = ballColors[Math.floor(Math.random() * ballColors.length)];
      el.setAttribute('data-color', color);
    });

    // シェアボタン自動生成
    const pageUrl = encodeURIComponent(location.href);
    const pageTitle = encodeURIComponent(document.title);
    document.querySelectorAll('.share-hatebu').forEach(el => {
      el.href = `https://b.hatena.ne.jp/entry/${location.href}`;
    });
    document.querySelectorAll('.share-x').forEach(el => {
      el.href = `https://twitter.com/intent/tweet?text=${pageTitle}&url=${pageUrl}&hashtags=宝くじ,ロト6`;
    });

    // AdSense 遅延ロード
    setTimeout(() => {
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
    }, 800); // 0.8秒遅延
  });
})();
