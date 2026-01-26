/* ==========================================================
   Apple OS Widget - Compact (Common version first)
   - Source: Cloudflare Workers (CORS OK)
   - CLS: DOM text only / widget height is fixed by CSS
   - Strategy:
     1) 全OSの "Stable" を集計して多数派を「共通Stable」として表示
     2) 全OSの "Beta" を集計して多数派を「共通Beta」として表示
     3) 例外（共通から外れる/未掲載）は小さく注記として表示
   ========================================================== */
(function(){
  "use strict";

  var RSS_URL = "https://apple-os-rss-proxy.7xjvnhs9mz.workers.dev/";

  // beta2 / beta 2 / RC1 / Release Candidate も拾う
  var BETA_RE = /(?:\bbeta\b|\bbeta\d+\b|\bbeta\s*\d+\b|\bdeveloper\s+beta\b|\bpublic\s+beta\b|\brelease\s+candidate\b|\brc\b|\brc\d+\b|\brc\s*\d+\b)/i;

  // 対象OS（例外注記用）
  var OS_KEYS = [
    { key: "iOS",      id: "ios",      label: "iOS" },
    { key: "iPadOS",   id: "ipados",   label: "iPadOS" },
    { key: "macOS",    id: "macos",    label: "macOS" },
    { key: "watchOS",  id: "watchos",  label: "watchOS" },
    { key: "tvOS",     id: "tvos",     label: "tvOS" },
    { key: "visionOS", id: "visionos", label: "visionOS" },
    { key: "audioOS",  id: "audioos",  label: "audioOS" }
  ];

  // DOM（このIDをHTML側で用意してください）
  //  - os-common-stable: 共通Stable
  //  - os-common-beta  : 共通Beta
  //  - os-exceptions   : 例外注記（小さく）
  //  - os-updated      : 更新日
  var DOM = {
    stable: "os-common-stable",
    beta: "os-common-beta",
    exceptions: "os-exceptions",
    updated: "os-updated"
  };

  var CACHE_KEY = "tnr_os_widget_cache_compact_v1";
  var CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h
  var FETCH_TIMEOUT_MS = 3500;

  function $(id){ return document.getElementById(id); }
  function safeText(el, v){ if(el) el.textContent = v; }
  function now(){ return Date.now ? Date.now() : new Date().getTime(); }
  function z2(n){ return (n < 10 ? "0" : "") + n; }

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
      var t = it.getElementsByTagName("title")[0];
      var p = it.getElementsByTagName("pubDate")[0];
      out.push({
        title: t ? t.textContent : "",
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
    // "iOS 26.3 beta 2 (23D5033l)" -> "26.3 beta 2"
    // "(...)" は拾わない
    var re = new RegExp(
      osKey + "\\s+([0-9]+(?:\\.[0-9]+){0,2}(?:\\s*(?:beta\\s*\\d+|beta\\d+|RC\\s*\\d+|RC\\d+))?)",
      "i"
    );
    var m = title.match(re);
    if(!m) return null;
    return String(m[1]||"").replace(/\s+/g," ").trim() || null;
  }

  function pickLatestPerOS(items){
    var res = {
      ios:{stable:null,beta:null},
      ipados:{stable:null,beta:null},
      macos:{stable:null,beta:null},
      watchos:{stable:null,beta:null},
      tvos:{stable:null,beta:null},
      audioos:{stable:null,beta:null},
      visionos:{stable:null,beta:null},
      updated:null
    };

    if(items[0] && items[0].pubDate && !isNaN(items[0].pubDate.getTime())){
      res.updated = items[0].pubDate.toISOString();
    }

    for(var i=0;i<items.length;i++){
      var title = (items[i].title||"").trim();
      if(!title) continue;

      var isBeta = BETA_RE.test(title);

      for(var k=0;k<OS_KEYS.length;k++){
        var osKey = OS_KEYS[k].key;
        var osId  = OS_KEYS[k].id;
        if(title.indexOf(osKey) === -1) continue;

        var ver = extractVersionPart(title, osKey);
        if(!ver) continue;

        if(isBeta){
          if(!res[osId].beta) res[osId].beta = ver;
        }else{
          if(!res[osId].stable) res[osId].stable = ver;
        }
      }
    }

    return res;
  }

  function majorityValue(values){
    // values: ["26.2","26.2",null,"26.3"] など
    var counts = Object.create(null);
    var best = null;
    var bestCount = 0;

    for(var i=0;i<values.length;i++){
      var v = values[i];
      if(!v) continue;
      counts[v] = (counts[v] || 0) + 1;
      if(counts[v] > bestCount){
        bestCount = counts[v];
        best = v;
      }
    }
    return best || null;
  }

  function buildCompact(data){
    // 1) 共通Stable / 共通Beta（多数派）
    var st = [];
    var bt = [];
    for(var i=0;i<OS_KEYS.length;i++){
      var id = OS_KEYS[i].id;
      st.push(data[id] ? data[id].stable : null);
      bt.push(data[id] ? data[id].beta : null);
    }

    var commonStable = majorityValue(st);
    var commonBeta = majorityValue(bt);

    // betaが未掲載なら "-"
    var commonStableOut = commonStable ? commonStable : "--";
    var commonBetaOut = commonBeta ? commonBeta : "-";

    // 2) 例外注記
    //  - stable が共通と違う or 未掲載
    //  - beta が共通と違う（ただし beta未掲載は出しすぎない）
    var ex = [];
    for(var j=0;j<OS_KEYS.length;j++){
      var os = OS_KEYS[j];
      var d = data[os.id] || {stable:null,beta:null};

      // stable例外
      if(commonStable){
        if(!d.stable){
          ex.push(os.label + " Stable: --");
        }else if(d.stable !== commonStable){
          ex.push(os.label + " Stable: " + d.stable);
        }
      }else{
        if(d.stable){
          ex.push(os.label + " Stable: " + d.stable);
        }
      }

      // beta例外（共通betaがある時のみ比較。共通betaが無いなら出しすぎない）
      if(commonBeta){
        if(d.beta && d.beta !== commonBeta){
          ex.push(os.label + " Beta: " + d.beta);
        }
      }else{
        // 共通betaが無いとき：betaが存在するOSだけ軽く出す
        if(d.beta){
          ex.push(os.label + " Beta: " + d.beta);
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

    return {
      commonStable: commonStableOut,
      commonBeta: commonBetaOut,
      exceptions: ex,
      updated: updated
    };
  }

  function applyToDOM(compact){
    requestAnimationFrame(function(){
      safeText($(DOM.stable), compact.commonStable);
      safeText($(DOM.beta), compact.commonBeta);

      var exEl = $(DOM.exceptions);
      if(exEl){
        if(compact.exceptions && compact.exceptions.length){
          // 例外は最大5行に制限（サイドバーの見た目維持）
          var list = compact.exceptions.slice(0,5);
          exEl.textContent = "例外: " + list.join(" / ");
          exEl.style.display = "";
        }else{
          exEl.textContent = "";
          exEl.style.display = "none";
        }
      }

      if(compact.updated){
        safeText($(DOM.updated), compact.updated);
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
    for(var i=0;i<OS_KEYS.length;i++){
      var id = OS_KEYS[i].id;
      if((data[id] && (data[id].stable || data[id].beta))) return true;
    }
    return false;
  }

  function run(){
    // cache即反映
    var cached = readCache();
    if(cached){
      applyToDOM(cached);
    }

    // fresh取得
    fetchWithTimeout(RSS_URL, FETCH_TIMEOUT_MS)
      .then(parseRSS)
      .then(getItems)
      .then(sortNewest)
      .then(pickLatestPerOS)
      .then(function(raw){
        if(!hasAny(raw)) return;

        var compact = buildCompact(raw);
        writeCache(compact);
        applyToDOM(compact);
      })
      .catch(function(){});
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", run);
  }else{
    run();
  }
})();
