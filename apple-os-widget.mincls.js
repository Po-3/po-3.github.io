/* ==========================================================
   Apple OS Widget - Compact (Common version first)
   v4: 日本時間リリース日をバージョン横に表示 (JST = UTC+9)
   ========================================================== */
(function(){
  "use strict";

  var RSS_URL = "https://apple-os-rss-proxy.7xjvnhs9mz.workers.dev/";

  var BETA_RE = /(?:\bbeta\b|\bbeta\d+\b|\bbeta\s*\d+\b|\bdeveloper\s+beta\b|\bpublic\s+beta\b|\brelease\s+candidate\b|\brc\b|\brc\d+\b|\brc\s*\d+\b|\(\s*rc\s*\)|\(\s*[a-z]\s*\))/i;

  var OS_KEYS = [
    { key: "iOS",      id: "ios",      label: "iOS" },
    { key: "iPadOS",   id: "ipados",   label: "iPadOS" },
    { key: "macOS",    id: "macos",    label: "macOS" },
    { key: "watchOS",  id: "watchos",  label: "watchOS" },
    { key: "tvOS",     id: "tvos",     label: "tvOS" },
    { key: "visionOS", id: "visionos", label: "visionOS" },
    { key: "audioOS",  id: "audioos",  label: "audioOS" }
  ];

  var DOM = {
    stable:     "os-common-stable",
    beta:       "os-common-beta",
    exceptions: "os-exceptions",
    updated:    "os-updated",
    auto:       "os-auto"
  };

  // ★ v4 に変更（日付フィールド追加によりキャッシュ構造が変わるため）
  var CACHE_KEY      = "tnr_os_widget_cache_compact_v4";
  var CACHE_TTL_MS   = 6 * 60 * 60 * 1000;
  var FETCH_TIMEOUT_MS = 3500;
  var EVENT_WINDOW_DAYS = 14;

  function $(id){ return document.getElementById(id); }
  function safeText(el, v){ if(el) el.textContent = v; }
  function now(){ return Date.now ? Date.now() : new Date().getTime(); }
  function z2(n){ return (n < 10 ? "0" : "") + n; }

  // ★ NEW: UTC の Date オブジェクトを JST 日付文字列 "YYYY/MM/DD" に変換
  function toJSTDateStr(date){
    if(!date || isNaN(date.getTime())) return null;
    var jst = new Date(date.getTime() + 9 * 60 * 60 * 1000); // UTC+9
    return jst.getUTCFullYear() + "/" +
           z2(jst.getUTCMonth() + 1) + "/" +
           z2(jst.getUTCDate());
  }

  // ★ NEW: バージョン文字列と日付文字列を結合（日付無しの場合はそのまま返す）
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
    var nums = [0,0,0];
    if(numMatch){
      nums[0] = parseInt(numMatch[1],10);
      nums[1] = numMatch[2] !== undefined ? parseInt(numMatch[2],10) : 0;
      nums[2] = numMatch[3] !== undefined ? parseInt(numMatch[3],10) : 0;
    }
    var stage = 2; var stageNum = 0;
    if(/\brc\b/.test(norm)){
      stage = 1;
      var rcMatch = norm.match(/\brc\s*(\d+)/);
      if(rcMatch) stageNum = parseInt(rcMatch[1],10);
    } else if(/\bbeta\b/.test(norm)){
      stage = 0;
      var betaMatch = norm.match(/\bbeta\s*(\d+)/);
      if(betaMatch) stageNum = parseInt(betaMatch[1],10);
    }
    return { nums: nums, stage: stage, stageNum: stageNum };
  }

  function compareVersionRaw(a, b){
    if(!a && !b) return 0;
    if(!a) return -1;
    if(!b) return 1;
    var pa = parseVersionForCompare(a);
    var pb = parseVersionForCompare(b);
    if(!pa && !pb) return 0;
    if(!pa) return -1;
    if(!pb) return 1;
    for(var i=0; i<3; i++){
      if(pa.nums[i] > pb.nums[i]) return 1;
      if(pa.nums[i] < pb.nums[i]) return -1;
    }
    if(pa.stage    > pb.stage)    return 1;
    if(pa.stage    < pb.stage)    return -1;
    if(pa.stageNum > pb.stageNum) return 1;
    if(pa.stageNum < pb.stageNum) return -1;
    return 0;
  }

  // ★ CHANGED: 最大バージョンと、そのバージョンに対応する最古の日付を返す
  function maxVersionWithDate(pairs){
    // pairs = [{ver, date}, ...]
    var maxVer  = null;
    var maxDate = null;
    for(var i=0; i<pairs.length; i++){
      var v = pairs[i].ver;
      var d = pairs[i].date;
      if(!v) continue;
      if(maxVer === null || compareVersionRaw(v, maxVer) > 0){
        maxVer  = v;
        maxDate = d;
      } else if(sameVersion(v, maxVer)){
        // 同バージョンなら最古の日付を採用（全OS同日リリースが多いが念のため）
        if(d && (!maxDate || d < maxDate)) maxDate = d;
      }
    }
    return { ver: maxVer, date: maxDate };
  }

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
      localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: now(), data: data }));
    }catch(e){}
  }

  function parseRSS(xmlText){
    var parser = new DOMParser();
    var xml = parser.parseFromString(xmlText, "application/xml");
    if(xml.getElementsByTagName("parsererror").length) throw new Error("parse error");
    return xml;
  }

  function getItems(xml){
    var items = xml.getElementsByTagName("item");
    var out = [];
    for(var i=0;i<items.length;i++){
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
    return items.slice().sort(function(a,b){
      var at = a.pubDate && !isNaN(a.pubDate.getTime()) ? a.pubDate.getTime() : 0;
      var bt = b.pubDate && !isNaN(b.pubDate.getTime()) ? b.pubDate.getTime() : 0;
      return bt - at;
    });
  }

  function extractVersionPart(title, osKey){
    var re = new RegExp(
      osKey +
        "\\s+(" +
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
    var v = String(m[1] || "").replace(/\s+/g," ").trim();
    if(!v) return null;
    if(/\brelease\s+candidate\b/i.test(v)){
      v = v.replace(/\brelease\s+candidate\b/ig, "RC");
    }
    v = v
      .replace(/\bbeta\s*(\d+)\b/i, "Beta$1")
      .replace(/\bbeta\b/i, "Beta");
    v = v
      .replace(/\bRC\s*(\d+)\b/i, "RC$1")
      .replace(/\bRC\b/i, "RC");
    return v;
  }

  // ★ CHANGED: stable/beta に加え stableDate/betaDate も記録
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

    for(var i=0; i<items.length; i++){
      var title  = (items[i].title||"").trim();
      var pubDate = items[i].pubDate;
      if(!title) continue;

      var isBeta = BETA_RE.test(title);

      for(var k=0; k<OS_KEYS.length; k++){
        var osKey = OS_KEYS[k].key;
        var osId  = OS_KEYS[k].id;
        if(title.indexOf(osKey) === -1) continue;

        var ver = extractVersionPart(title, osKey);
        if(!ver) continue;

        if(isBeta){
          if(!res[osId].beta || compareVersionRaw(ver, res[osId].beta) > 0){
            res[osId].beta     = ver;
            res[osId].betaDate = pubDate; // ★ 日付を一緒に保存
          } else if(sameVersion(ver, res[osId].beta)){
            // 同バージョン・より古い日付があれば上書き
            if(pubDate && (!res[osId].betaDate || pubDate < res[osId].betaDate)){
              res[osId].betaDate = pubDate;
            }
          }
        } else {
          if(!res[osId].stable || compareVersionRaw(ver, res[osId].stable) > 0){
            res[osId].stable     = ver;
            res[osId].stableDate = pubDate; // ★ 日付を一緒に保存
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

  // ★ CHANGED: 共通バージョンに日付フィールドを追加
  function buildCompact(data){
    // 1) 共通Stable / Beta（最大値 + 日付）
    var stPairs = [];
    var btPairs = [];
    for(var i=0; i<OS_KEYS.length; i++){
      var id = OS_KEYS[i].id;
      var d  = data[id] || {};
      stPairs.push({ ver: d.stable || null, date: d.stableDate || null });
      btPairs.push({ ver: d.beta   || null, date: d.betaDate   || null });
    }

    var stResult = maxVersionWithDate(stPairs);
    var btResult = maxVersionWithDate(btPairs);

    var commonStable     = stResult.ver;
    var commonStableDate = stResult.date;   // Date オブジェクト or null
    var commonBeta       = btResult.ver;
    var commonBetaDate   = btResult.date;

    var commonStableOut = commonStable ? commonStable : "--";
    var commonBetaOut   = commonBeta   ? commonBeta   : "-";

    // JST 文字列に変換
    var commonStableDateStr = toJSTDateStr(commonStableDate);
    var commonBetaDateStr   = toJSTDateStr(commonBetaDate);

    // 2) 例外注記
    var ex = [];
    for(var j=0; j<OS_KEYS.length; j++){
      var os = OS_KEYS[j];
      var od = data[os.id] || { stable:null, stableDate:null, beta:null, betaDate:null };

      if(commonStable){
        if(!od.stable){
          ex.push(os.label + " 正式版: --");
        } else if(!sameVersion(od.stable, commonStable)){
          // 例外にも日付を付ける
          var exStableDate = toJSTDateStr(od.stableDate);
          ex.push(os.label + " 正式版: " + joinVerDate(od.stable, exStableDate));
        }
      } else {
        if(od.stable){
          var exStableDate2 = toJSTDateStr(od.stableDate);
          ex.push(os.label + " 正式版: " + joinVerDate(od.stable, exStableDate2));
        }
      }

      if(commonBeta && commonBeta !== "-"){
        if(od.beta && !sameVersion(od.beta, commonBeta)){
          var exBetaDate = toJSTDateStr(od.betaDate);
          ex.push(os.label + " Beta: " + joinVerDate(od.beta, exBetaDate));
        }
      } else {
        if(od.beta){
          var exBetaDate2 = toJSTDateStr(od.betaDate);
          ex.push(os.label + " Beta: " + joinVerDate(od.beta, exBetaDate2));
        }
      }
    }

    // 3) 更新日
    var updated = null;
    if(data.updated){
      var dd = new Date(data.updated);
      if(!isNaN(dd.getTime())){
        updated = dd.getFullYear() + "-" + z2(dd.getMonth()+1) + "-" + z2(dd.getDate());
      }
    }

    // 4) イベント期判定
    var isEvent = false;
    if(updated){
      var d2   = new Date(updated + "T00:00:00Z");
      if(!isNaN(d2.getTime())){
        var days = (Date.now() - d2.getTime()) / 86400000;
        if(days <= EVENT_WINDOW_DAYS) isEvent = true;
      }
    }
    var isHot = false;
    if(isEvent && ex.length){
      var s = ex.join(" / ");
      if(/(?:^|\/|\s)(iOS|iPadOS)\s+Beta:/i.test(s)) isHot = true;
    }

    return {
      commonStable:     commonStableOut,
      commonStableDate: commonStableDateStr, // ★ 新フィールド（キャッシュに保存される）
      commonBeta:       commonBetaOut,
      commonBetaDate:   commonBetaDateStr,   // ★ 新フィールド
      exceptions:       ex,
      updated:          updated,
      isHot:            isHot
    };
  }

  // ★ CHANGED: バージョンに日付を付加して表示
  function applyToDOM(compact, state){
    requestAnimationFrame(function(){
      // 正式版: "26.3 (2025/06/10)"
      safeText($(DOM.stable), joinVerDate(compact.commonStable, compact.commonStableDate));
      // Beta:   "26.4 Beta2 (2025/06/17)"
      safeText($(DOM.beta),   joinVerDate(compact.commonBeta,   compact.commonBetaDate));

      var exEl = $(DOM.exceptions);
      if(exEl){
        if(compact.exceptions && compact.exceptions.length){
          var list = compact.exceptions.slice(0, 5);
          exEl.textContent = "例外: " + list.join(" / ");
          exEl.style.display = "";
          exEl.classList.toggle("is-hot", !!compact.isHot);
        } else {
          exEl.textContent  = "";
          exEl.style.display = "none";
          exEl.classList.remove("is-hot");
        }
      }

      if(compact.updated){
        safeText($(DOM.updated), compact.updated);
      }

      var autoEl = $(DOM.auto);
      if(autoEl){
        if(state === "cache"){
          autoEl.textContent  = "キャッシュ";
          autoEl.style.display = "";
        } else if(state === "fresh"){
          autoEl.textContent  = "自動更新";
          autoEl.style.display = "";
        } else {
          autoEl.style.display = "none";
        }
      }
    });
  }

  function fetchWithTimeout(url, timeoutMs){
    var controller = (typeof AbortController !== "undefined") ? new AbortController() : null;
    var timer = null;
    if(controller){
      timer = setTimeout(function(){ try{ controller.abort(); }catch(e){} }, timeoutMs);
    }
    return fetch(url, { cache:"no-store", signal: controller ? controller.signal : undefined })
      .then(function(res){
        if(timer) clearTimeout(timer);
        if(!res.ok) throw new Error("HTTP " + res.status);
        return res.text();
      });
  }

  function hasAny(data){
    for(var i=0; i<OS_KEYS.length; i++){
      var id = OS_KEYS[i].id;
      if(data[id] && (data[id].stable || data[id].beta)) return true;
    }
    return false;
  }

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
        // キャッシュ表示中ならそのまま
      });
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
})();
