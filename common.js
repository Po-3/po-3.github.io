(function () {
  // 金額整形
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

  function fetchWithTimeout(url, timeout = 2000) {
    return Promise.race([
      fetch(url).then(res => res.ok ? res.json() : null).catch(() => null),
      new Promise(resolve => setTimeout(() => resolve(null), timeout))
    ]);
  }

  document.addEventListener("DOMContentLoaded", function () {
    const wrapper = document.getElementById('tonari-latest-carry');
    if (!wrapper) return;
    wrapper.innerHTML = `<span style="color:#999; font-size:13px;">最新データ取得中…</span>`;

    // データ取得
    Promise.allSettled([
      fetchWithTimeout("https://po-3.github.io/miniloto-data/miniloto.json"),
      fetchWithTimeout("https://po-3.github.io/loto6-data/loto6.json"),
      fetchWithTimeout("https://po-3.github.io/loto7-data/loto7.json")
    ]).then(results => {
      try {
        const [mini, l6, l7] = results.map(r => r.status === "fulfilled" && r.value && r.value.length ? r.value : null);

        const miniLast = mini && mini[mini.length - 1];
        const l6Last   = l6   && l6[l6.length - 1];
        const l7Last   = l7   && l7[l7.length - 1];

        if (!miniLast && !l6Last && !l7Last) {
          wrapper.innerHTML = `<span style='color:#eb5030; font-weight:bold;'>結果データ取得エラー</span>`;
          return;
        }

        const resultsList = [
          miniLast && { type: "ミニロト", date: miniLast["日付"], round: miniLast["開催回"], nums: [miniLast["第1数字"], miniLast["第2数字"], miniLast["第3数字"], miniLast["第4数字"], miniLast["第5数字"]].join('・'), bonus: miniLast["ボーナス数字"], link: "https://po-3.github.io/miniloto-data/" },
          l6Last && { type: "ロト6", date: l6Last["日付"], round: l6Last["開催回"], nums: [l6Last["第1数字"], l6Last["第2数字"], l6Last["第3数字"], l6Last["第4数字"], l6Last["第5数字"], l6Last["第6数字"]].join('・'), bonus: l6Last["ボーナス数字"], link: "https://po-3.github.io/loto6-data/" },
          l7Last && { type: "ロト7", date: l7Last["日付"], round: l7Last["開催回"], nums: [l7Last["第1数字"], l7Last["第2数字"], l7Last["第3数字"], l7Last["第4数字"], l7Last["第5数字"], l7Last["第6数字"], l7Last["第7数字"]].join('・'), bonus: (l7Last["BONUS数字1"] && l7Last["BONUS数字2"]) ? l7Last["BONUS数字1"] + "／" + l7Last["BONUS数字2"] : "", link: "https://po-3.github.io/loto7-data/" }
        ].filter(Boolean);

        resultsList.sort((a, b) => new Date(b.date) - new Date(a.date));
        const latest = resultsList[0];

        let html = "";
        if (latest) {
          html += `
            <div style="font-weight:bold; font-size:17px; margin-bottom:2px; color:#e89813;">
              🎯最新${latest.type}結果 <span style="font-size:13.5px; color:#bb7400;">第${latest.round}回</span>
            </div>
            <div style="font-size:12.5px; color:#825900; margin-bottom:3px;">
              ${latest.date}
            </div>
            <div style="font-size:16.5px; margin:2px 0 7px 0; letter-spacing:3px;">
              <span style="font-weight:bold; color:#1a7bc9;">${latest.nums}</span>
              <span style="font-size:12.5px; color:#a8870a; margin-left:7px;">
                （ボ：${latest.bonus}）
              </span>
            </div>
            <a href="${latest.link}" rel="noopener noreferrer"
              style="font-size:13px; background:#fff4c5; border:1px solid #f3cf7d; color:#b46d00; border-radius:8px; padding:5px 18px; text-decoration:none; display:inline-block; margin-top:5px; font-weight:bold;">
              結果詳細を見る
            </a>
            <hr style="border:none; border-top:1.2px dotted #ffe099; margin:13px 0 10px 0;">
          `;
        } else {
          html += "<span style='color:#eb5030; font-weight:bold;'>結果データ取得エラー</span><hr style='border:none; border-top:1.2px dotted #ffe099; margin:13px 0 10px 0;'>";
        }

        // キャリーオーバー
        const CARRY_YELLOW = "#ffe600";
        const CARRY_BLUE   = "#a5dcf9";
        [
          {
            name: "ロト6 キャリーオーバー", data: l6Last,
            logo: "https://cdn-ak.f.st-hatena.com/images/fotolife/n/numberhunter/20250522/20250522171220.png",
            link: "https://www.kujitonari.net/archive/category/ロト6"
          },
          {
            name: "ロト7 キャリーオーバー", data: l7Last,
            logo: "https://cdn-ak.f.st-hatena.com/images/fotolife/n/numberhunter/20250522/20250522171452.png",
            link: "https://www.kujitonari.net/archive/category/ロト7"
          }
        ].forEach(info => {
          let amount = info.data && info.data["キャリーオーバー"] ? info.data["キャリーオーバー"] : 0;
          let isCarry = amount > 0;
          let bgColor = isCarry ? CARRY_YELLOW : CARRY_BLUE;
          html += `
            <div style="background:${bgColor}; border-radius:10px; box-shadow:0 2px 8px rgba(0,0,0,0.10); margin-bottom:8px; padding:10px 10px 8px 10px; display:flex; align-items:center;">
              <img src="${info.logo}" style="width:38px; height:38px; margin-right:10px; border-radius:50%; background:#fff;" loading="lazy" decoding="async">
              <div style="flex:1; text-align:left;">
                <div style="font-size:15px; font-weight:bold; color:#222;">
                  ${info.name}
                  <span style="background:${isCarry ? "#ea1212" : "#227be5"}; color:#fff; padding:1.5px 7px; border-radius:6px; font-size:11.5px; margin-left:5px; display:inline-block;">
                    ${isCarry ? "発生中" : "なし"}
                  </span><br>
                  <span style="font-size:12px; color:#965e00; margin-left:8px;">
                    【第${info.data && info.data["開催回"] ? info.data["開催回"] : "-"}回（${info.data && info.data["日付"] ? info.data["日付"] : "-"}）時点】
                  </span>
                </div>
                <div style="font-size:16.5px; font-weight:bold; color:#222; margin:2px 0 2px 0;">
                  ${
                    isCarry
                    ? `<span style="color:#1a7bc9; font-size:17px; letter-spacing:1px;">${formatYen(amount)}</span>`
                    : `<span style="color:#666; font-size:15px;">現在、キャリーオーバーはありません。</span>`
                  }
                </div>
              </div>
            </div>
          `;
        });

        wrapper.innerHTML = html;
      } catch (e) {
        wrapper.innerHTML = `<span style='color:#eb5030; font-weight:bold;'>結果データ取得エラー</span>`;
      }
    });

          // アニメーションスタイル埋め込み
      if (html.includes('carry-flash')) {
        html = <style>@keyframes carry-flash{0%{background:#ea1212;color:#fff;box-shadow:0 0 9px 3px #ffe600,0 0 3px 1px #fff;}60%{background:#ffe600;color:#b00;box-shadow:0 0 14px 7px #fff388,0 0 5px 3px #ffe600;}100%{background:#ea1212;color:#fff;box-shadow:0 0 9px 3px #ffe600,0 0 3px 1px #fff;}}</style> + html;
      }
      document.getElementById('tonari-latest-carry').innerHTML = html;
    });

        // --- UI：日付をロトボール化、サイドバーh3装飾、見出し色化、サムネ即時img化 ---
    const ballColors = ['red', 'orange', 'yellow', 'yellowgreen', 'blue', 'purple', 'pink'];

    // 日付をロトボール化
    document.querySelectorAll('.archive-entries .date').forEach(function (el) {
      const match = el.textContent.match(/(\d{4})[./-](\d{1,2})[./-](\d{1,2})/);
      if (match) {
        const [_, year, month, day] = match;
        const colorClass = 'loto-ball-' + ballColors[(day - 1) % ballColors.length];
        el.innerHTML = 
          <span class="loto-ball ${colorClass}">${day}</span>
          <span class="loto-date-block">
            <span class="loto-date-month">${month}月</span>
            <span class="loto-date-year">${year}</span>
          </span>
        ;
      }
    });

    // サイドバー見出しのロトボール化
    document.querySelectorAll('.sidebar h3, .hatena-module-title, .hatena-module .module-title').forEach(function (el) {
      const text = el.textContent.trim();
      if (!text || el.querySelector('.loto-ball')) return;
      const firstChar = text[0];
      const rest = text.slice(1);
      const colorClass = 'loto-ball-' + ballColors[firstChar.charCodeAt(0) % ballColors.length];
      el.innerHTML = <span class="loto-ball ${colorClass}">${firstChar}</span>${rest};
    });

    // 記事内h2見出しにランダムロトボール背景
    document.querySelectorAll('.entry-content h2').forEach(function (el) {
      const color = ballColors[Math.floor(Math.random() * ballColors.length)];
      el.setAttribute('data-color', color);
    });

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
    }, 800);

  });
})();
