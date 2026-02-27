/* ==========================================================
   Apple OS Widget - Compact (Common version first)
   v4: 日本時間リリース日をバージョン横に表示 (JST = UTC+9)
      日付は小span分離でスタイル制御可能
   Fix: macOS コードネームスキップ / updated JST化 /
        isHot 簡略化 / 例外を縦並び表示
   ========================================================== */
(function(){
  "use strict";

  var RSS_URL = "https://apple-os-rss-proxy.7xjvnhs9mz.workers.dev/";

  var BETA_RE = /(?:\bbeta\b|\bbeta\d+\b|\bbeta\s*\d+\b|\bdeveloper\s+beta\b|\bpublic\s+beta\b|\brelease\s+candidate\b|\brc\b|\brc\d+\b|\brc\s*\d+\b|\(\s*rc\s*\)|\(\s*[a-z]\s*\))/i;

  var OS_KEYS = [
    { key: "iOS",      id: "ios",      label: "iOS"      },
    { key: "iPadOS",   id: "ipados",   label: "iPadOS"   },
    { key: "macOS",    id: "macos",    label: "macOS"    },
    { key: "watchOS",  id: "watchos",  label: "watchOS"  },
    { key: "tvOS",     id: "tvos",     label: "tvOS"     },
    { key: "visionOS", id: "visionos", label: "visionOS" },
    { key: "audioOS",  id: "audioos",  label: "audioOS"  }
  ];

  var DOM = {
    stableVer:  "os-stable-ver",
    stableDate: "os-stable-date",
    betaVer:    "os-beta-ver",
    betaDate:   "os-beta-date",
    exceptions: "os-exceptions",
    updated:    "os-updated",
    auto:       "os-auto"
  };

  var CACHE_KEY         = "tnr_os_widget_cache_compact_v4";
  var CACHE_TTL_MS      = 6 * 60 * 60 * 1000;
  var FETCH_TIMEOUT_MS  = 3500;
  var EVENT_WINDOW_DAYS = 14;

  function $(id){ return document.getElementById(id); }
  function safeText(el, v){ if(el) el.textContent = v; }
  function now(){ return Date.now ? Date.now() : new Date().getTime(); }
  function z2(n){ return (n < 10 ? "0" : "") + n; }

  /* UTC の Date → JST 日付文字列 "YYYY/MM/DD" */
  function toJSTDateStr(date){
    if(!date || isNaN(date.getTime())) return null;
    var jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
    return jst.getUTCFullYear() + "/" +
           z2(jst.getUTCMonth() + 1) + "/" +
           z2(jst.getUTCDate());
  }

  /* 例外行用：バージョン + 日付を "(YYYY/MM/DD)" 付きテキストに結合 */
  function joinVerDate(ver, dateStr){
    if(!ver || ver === "--" || ver === "-") return ver;
    if(!dateStr) return ver;
    return ver + " (" + dateStr + ")";
  }

  function normalizeVersion(v){
    if(!v) return null;
    return String(v)
      .replace(/\(\s*\d[^)]*\)/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\(\s*([a-z])\s*\)/g, "($1)")
      .toLowerCase()
      .replace(/\b(beta)\s*(\d+)\b/g, "beta $2")
      .replace(/\b(rc)\s*(\d+)\b/g, "rc $2")
      .replace(/\brelease\s+candidate\b/g, "rc")
      .replace(/\(\s*rc\s*\)/g, "rc");
  }

  function sameVersion(a, b){
    var na = normalizeVersion(a);
    var nb = normalizeVersion(b);
    if(!na || !nb) return false;
    return na === nb;
  }

  function parseVersionForCompare(raw){
    var norm = normalizeVersion(raw);
    if(!norm) return null;
    var numMatch = norm.match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
    var nums = [0, 0, 0];
    if(numMatch){
      nums[0] = parseInt(numMatch[1], 10);
      nums[1] = numMatch[2] !== undefined ? parseInt(numMatch[2], 10) : 0;
      nums[2] = numMatch[3] !== undefined ? parseInt(numMatch[3], 10) : 0;
    }
    var stage = 2, stageNum = 0;
    if(/\brc\b/.test(norm)){
      stage = 1;
      var rcMatch = norm.match(/\brc\s*(\d+)/);
      if(rcMatch) stageNum = parseInt(rcMatch[1], 10);
    } else if(/\bbeta\b/.test(norm)){
      stage = 0;
      var betaMatch = norm.match(/\bbeta\s*(\d+)/);
      if(betaMatch) stageNum = parseInt(betaMatch[1], 10);
    }
    return { nums: nums, stage: stage, stageNum: stageNum };
  }

  function compareVersionRaw(a, b){
    if(!a && !b) return 0;
    if(!a) return -1;
    if(!b) return  1;
    var pa = parseVersionForCompare(a);
    var pb = parseVersionForCompare(b);
    if(!pa && !pb) return 0;
    if(!pa) return -1;
    if(!pb) return  1;
    for(var i = 0; i < 3; i++){
      if(pa.nums[i] > pb.nums[i]) return  1;
      if(pa.nums[i] < pb.nums[i]) return -1;
    }
    if(pa.stage    > pb.stage)    return  1;
    if(pa.stage    < pb.stage)    return -1;
    if(pa.stageNum > pb.stageNum) return  1;
    if(pa.stageNum < pb.stageNum) return -1;
    return 0;
  }

  /* 最大バージョンと対応する最古の日付を返す（フォールバック用） */
  function maxVersionWithDate(pairs){
    var maxVer = null, maxDate = null;
    for(var i = 0; i < pairs.length; i++){
      var v = pairs[i].ver;
      var d = pairs[i].date;
      if(!v) continue;
      if(maxVer === null || compareVersionRaw(v, maxVer) > 0){
        maxVer  = v;
        maxDate = d;
      } else if(sameVersion(v, maxVer)){
        if(d && (!maxDate || d < maxDate)) maxDate = d;
      }
    }
    return { ver: maxVer, date: maxDate };
  }

  /* 多数派（mode）バージョンと対応する最古の日付を返す
     - ver は normalizeVersion() で同一判定しつつ、表示は「最初に出現した生文字列」を優先
     - 同数タイの場合は compareVersionRaw() で大きい方を採用
     - date は採用verを持つOS群のうち「最古」を採用 */
  function modeVersionWithDate(pairs){
    var map = Object.create(null);
    var order = [];

    for(var i = 0; i < pairs.length; i++){
      var v = pairs[i].ver;
      var d = pairs[i].date;
      if(!v) continue;
      var key = normalizeVersion(v);
      if(!key) continue;

      if(!map[key]){
        map[key] = { count: 0, rep: v, earliest: d || null };
        order.push(key);
      }
      map[key].count++;
      if(d && (!map[key].earliest || d < map[key].earliest)) map[key].earliest = d;
    }

    if(!order.length) return { ver: null, date: null, count: 0, total: 0 };

    var bestKey = order[0];
    for(var j = 1; j < order.length; j++){
      var k = order[j];
      if(map[k].count > map[bestKey].count){
        bestKey = k;
      } else if(map[k].count === map[bestKey].count){
        // 同数なら「より新しい」方を優先
        if(compareVersionRaw(map[k].rep, map[bestKey].rep) > 0) bestKey = k;
      }
    }

    return {
      ver:   map[bestKey].rep,
      date:  map[bestKey].earliest,
      count: map[bestKey].count,
      total: order.length
    };
  }

  /* ── キャッシュ ── */
  function readCache(){
    try{
      var raw = localStorage.getItem(CACHE_KEY);
      if(!raw) return null;
      var obj = JSON.parse(raw);
      if(!obj || !obj.savedAt || !obj.data) return null;
      if(now() - obj.savedAt > CACHE_TTL_MS) return null;
      return obj.data;
    }catch(e){ return null; }
  }
  function writeCache(data){
    try{
      localStorage.setItem(CACHE_KEY,
        JSON.stringify({ savedAt: now(), data: data }));
    }catch(e){}
  }

  /* ── RSS パース ── */
  function parseRSS(xmlText){
    var parser = new DOMParser();
    var xml = parser.parseFromString(xmlText, "application/xml");
    if(xml.getElementsByTagName("parsererror").length) throw new Error("parse error");
    return xml;
  }

  function getItems(xml){
    var items = xml.getElementsByTagName("item");
    var out = [];
    for(var i = 0; i < items.length; i++){
      var it = items[i];
      var t  = it.getElementsByTagName("title")[0];
      var p  = it.getElementsByTagName("pubDate")[0];
      out.push({
        title:   t ? t.textContent : "",
        pubDate: p ? new Date(p.textContent) : null
      });
    }
    return out;
  }

  function sortNewest(items){
    return items.slice().sort(function(a, b){
      var at = a.pubDate && !isNaN(a.pubDate.getTime()) ? a.pubDate.getTime() : 0;
      var bt = b.pubDate && !isNaN(b.pubDate.getTime()) ? b.pubDate.getTime() : 0;
      return bt - at;
    });
  }

  /* ── バージョン抽出 ──
     [FIX] (?:[A-Za-z]+\s+)? を追加し、macOS のコードネーム
     （Sequoia / Tahoe 等）をスキップできるようにした。
     他の OS には影響なし（直後に数字が来ればそのままマッチ）。 */
  function extractVersionPart(title, osKey){
    var re = new RegExp(
      osKey +
        "\\s+(?:[A-Za-z]+\\s+)?" +          // ← [FIX] コードネームをオプションでスキップ
        "(" +
          "[0-9]+(?:\\.[0-9]+){0,2}" +
          "(?:\\s*\\(\\s*[a-z]\\s*\\))?" +
          "(?:" +
            "\\s*(?:beta(?:\\s*\\d+)?|beta\\d+)" +
            "|" +
            "\\s*(?:rc\\s*\\d+|rc\\d+|rc|release\\s+candidate)" +
          ")?" +
        ")",
      "i"
    );
    var m = title.match(re);
    if(!m) return null;
    var v = String(m[1] || "").replace(/\s+/g, " ").trim();
    if(!v) return null;
    if(/\brelease\s+candidate\b/i.test(v)){
      v = v.replace(/\brelease\s+candidate\b/ig, "RC");
    }
    v = v.replace(/\bbeta\s*(\d+)\b/i, "Beta$1").replace(/\bbeta\b/i, "Beta");
    v = v.replace(/\bRC\s*(\d+)\b/i,   "RC$1"  ).replace(/\bRC\b/i,   "RC"  );
    return v;
  }

  /* ── OS ごとに最新バージョンを収集 ── */
  function pickLatestPerOS(items){
    var res = {
      ios:      { stable:null, stableDate:null, beta:null, betaDate:null },
      ipados:   { stable:null, stableDate:null, beta:null, betaDate:null },
      macos:    { stable:null, stableDate:null, beta:null, betaDate:null },
      watchos:  { stable:null, stableDate:null, beta:null, betaDate:null },
      tvos:     { stable:null, stableDate:null, beta:null, betaDate:null },
      audioos:  { stable:null, stableDate:null, beta:null, betaDate:null },
      visionos: { stable:null, stableDate:null, beta:null, betaDate:null },
      updated:  null
    };

    if(items[0] && items[0].pubDate && !isNaN(items[0].pubDate.getTime())){
      res.updated = items[0].pubDate.toISOString();
    }

    for(var i = 0; i < items.length; i++){
      var title   = (items[i].title || "").trim();
      var pubDate = items[i].pubDate;
      if(!title) continue;

      var isBeta = BETA_RE.test(title);

      for(var k = 0; k < OS_KEYS.length; k++){
        var osKey = OS_KEYS[k].key;
        var osId  = OS_KEYS[k].id;
        if(title.indexOf(osKey) === -1) continue;

        var ver = extractVersionPart(title, osKey);
        if(!ver) continue;

        if(isBeta){
          if(!res[osId].beta || compareVersionRaw(ver, res[osId].beta) > 0){
            res[osId].beta     = ver;
            res[osId].betaDate = pubDate;
          } else if(sameVersion(ver, res[osId].beta)){
            if(pubDate && (!res[osId].betaDate || pubDate < res[osId].betaDate)){
              res[osId].betaDate = pubDate;
            }
          }
        } else {
          if(!res[osId].stable || compareVersionRaw(ver, res[osId].stable) > 0){
            res[osId].stable     = ver;
            res[osId].stableDate = pubDate;
          } else if(sameVersion(ver, res[osId].stable)){
            if(pubDate && (!res[osId].stableDate || pubDate < res[osId].stableDate)){
              res[osId].stableDate = pubDate;
            }
          }
        }
      }
    }
    return res;
  }

  /* ── コンパクトデータを生成 ── */
  function buildCompact(data){
    var stPairs = [], btPairs = [];
    for(var i = 0; i < OS_KEYS.length; i++){
      var id = OS_KEYS[i].id;
      var d  = data[id] || {};
      stPairs.push({ ver: d.stable || null, date: d.stableDate || null });
      btPairs.push({ ver: d.beta   || null, date: d.betaDate   || null });
    }

    // 共通は「多数派（mode）」を優先。揃っていない時に“共通=最新”と誤解されるのを防ぐ。
    var stMode = modeVersionWithDate(stPairs);
    var btMode = modeVersionWithDate(btPairs);

    var commonStable     = stMode.ver;
    var commonStableDate = stMode.date;
    var commonBeta       = btMode.ver;
    var commonBetaDate   = btMode.date;

    // もし全OSがバラけていて mode が実質意味を持たない（全て1件ずつ）場合は、従来どおり最大を共通にする
    if(stMode.count <= 1){
      var stMax = maxVersionWithDate(stPairs);
      commonStable     = stMax.ver;
      commonStableDate = stMax.date;
    }
    if(btMode.count <= 1){
      var btMax = maxVersionWithDate(btPairs);
      commonBeta     = btMax.ver;
      commonBetaDate = btMax.date;
    }

    var commonStableOut     = commonStable ? commonStable : "--";
    var commonBetaOut       = commonBeta   ? commonBeta   : "-";
    var commonStableDateStr = toJSTDateStr(commonStableDate);
    var commonBetaDateStr   = toJSTDateStr(commonBetaDate);

    /* 例外注記 */
    var ex = [];
    for(var j = 0; j < OS_KEYS.length; j++){
      var os = OS_KEYS[j];
      var od = data[os.id] || { stable:null, stableDate:null, beta:null, betaDate:null };

      // 正式版：共通と違うものだけ「例外」として出す
      if(commonStable){
        if(!od.stable){
          ex.push(os.label + " 正式版: --");
        } else if(!sameVersion(od.stable, commonStable)){
          ex.push(os.label + " 正式版: " +
            joinVerDate(od.stable, toJSTDateStr(od.stableDate)));
        }
      } else {
        // 共通が決められない場合は、値があるOSだけ列挙
        if(od.stable){
          ex.push(os.label + " 正式版: " +
            joinVerDate(od.stable, toJSTDateStr(od.stableDate)));
        }
      }

      // Beta：共通がある場合は「共通と違うものだけ」例外として出す
      if(commonBeta && commonBeta !== "-"){
        if(od.beta && !sameVersion(od.beta, commonBeta)){
          ex.push(os.label + " Beta: " +
            joinVerDate(od.beta, toJSTDateStr(od.betaDate)));
        }
      } else {
        // 共通がない場合は、値があるOSだけ列挙
        if(od.beta){
          ex.push(os.label + " Beta: " +
            joinVerDate(od.beta, toJSTDateStr(od.betaDate)));
        }
      }
    }

    /* 更新日
       [FIX] UTC → JST に統一（stableDate / betaDate と同じ基準） */
    var updated = null;
    if(data.updated){
      var dd = new Date(data.updated);
      if(!isNaN(dd.getTime())){
        updated = toJSTDateStr(dd).replace(/\//g, "-"); // "YYYY-MM-DD" (JST)
      }
    }

    /* イベント期判定
       [FIX] isHot = 14日以内に更新があれば true に簡略化 */
    var isEvent = false;
    if(updated){
      var d2 = new Date(updated + "T00:00:00+09:00"); // JST基準で比較
      if(!isNaN(d2.getTime())){
        if((Date.now() - d2.getTime()) / 86400000 <= EVENT_WINDOW_DAYS) isEvent = true;
      }
    }
    var isHot = isEvent; // [FIX] 14日以内の更新があればそのまま isHot

    return {
      commonStable:     commonStableOut,
      commonStableDate: commonStableDateStr,
      commonBeta:       commonBetaOut,
      commonBetaDate:   commonBetaDateStr,
      exceptions:       ex,
      updated:          updated,
      isHot:            isHot
    };
  }

  /* ── DOM に反映 ── */
  function applyToDOM(compact, state){
    requestAnimationFrame(function(){

      /* バージョンと日付を別 span へ書き込む */
      safeText($(DOM.stableVer),  compact.commonStable || "--");
      safeText($(DOM.stableDate), compact.commonStableDate
        ? "(" + compact.commonStableDate + ")" : "");

      safeText($(DOM.betaVer),    compact.commonBeta || "-");
      safeText($(DOM.betaDate),   compact.commonBetaDate
        ? "(" + compact.commonBetaDate + ")" : "");

      /* 例外
         [FIX] 横並び join(" / ") → 1件ずつ <div> で縦並びに変更
               スマホでの折り返し問題を解消 */
      var exEl = $(DOM.exceptions);
      if(exEl){
        exEl.textContent = "";
        if(compact.exceptions && compact.exceptions.length){
          compact.exceptions.slice(0, 5).forEach(function(line){
            var div = document.createElement("div");
            div.textContent = line;
            exEl.appendChild(div);
          });
          exEl.style.display = "";
          exEl.classList.toggle("is-hot", !!compact.isHot);
        } else {
          exEl.style.display = "none";
          exEl.classList.remove("is-hot");
        }
      }

      /* 更新日 */
      if(compact.updated){
        safeText($(DOM.updated), compact.updated);
      }

      /* キャッシュ / 自動更新 */
      var autoEl = $(DOM.auto);
      if(autoEl){
        if(state === "cache"){
          autoEl.textContent   = "キャッシュ";
          autoEl.style.display = "";
        } else if(state === "fresh"){
          autoEl.textContent   = "自動更新";
          autoEl.style.display = "";
        } else {
          autoEl.style.display = "none";
        }
      }
    });
  }

  /* ── fetch（タイムアウト付き） ── */
  function fetchWithTimeout(url, timeoutMs){
    var controller = (typeof AbortController !== "undefined")
      ? new AbortController() : null;
    var timer = null;
    if(controller){
      timer = setTimeout(function(){
        try{ controller.abort(); }catch(e){}
      }, timeoutMs);
    }
    return fetch(url, {
      cache:  "no-store",
      signal: controller ? controller.signal : undefined
    }).then(function(res){
      if(timer) clearTimeout(timer);
      if(!res.ok) throw new Error("HTTP " + res.status);
      return res.text();
    });
  }

  function hasAny(data){
    for(var i = 0; i < OS_KEYS.length; i++){
      var id = OS_KEYS[i].id;
      if(data[id] && (data[id].stable || data[id].beta)) return true;
    }
    return false;
  }

  /* ── エントリーポイント ── */
  function run(){
    var cached = readCache();
    if(cached){ applyToDOM(cached, "cache"); }

    fetchWithTimeout(RSS_URL, FETCH_TIMEOUT_MS)
      .then(parseRSS)
      .then(getItems)
      .then(sortNewest)
      .then(pickLatestPerOS)
      .then(function(raw){
        if(!hasAny(raw)) return;
        var compact = buildCompact(raw);
        writeCache(compact);
        applyToDOM(compact, "fresh");
      })
      .catch(function(){
        /* フェッチ失敗 → キャッシュ表示を維持 */
      });
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
})();
