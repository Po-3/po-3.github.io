(function(){

/* =========================
 * 設定
 * ========================= */

var FEED_URL = "https://developer.apple.com/news/releases/rss/releases.rss";

var CACHE_KEY = "tnr_os_widget_cache_compact_v5";
var CACHE_TTL_MS = 6 * 60 * 60 * 1000;

/* =========================
 * ユーティリティ
 * ========================= */

function now(){
  return Date.now();
}

function parseXML(str){
  return new window.DOMParser().parseFromString(str, "text/xml");
}

function compareVersionRaw(a, b){
  if(!a || !b) return 0;

  var pa = a.split(".").map(Number);
  var pb = b.split(".").map(Number);

  for(var i=0;i<Math.max(pa.length,pb.length);i++){
    var na = pa[i] || 0;
    var nb = pb[i] || 0;

    if(na > nb) return 1;
    if(na < nb) return -1;
  }
  return 0;
}

function baseVersion(v){
  if(!v) return null;
  var m = String(v).match(/^(\d+(?:\.\d+){0,2})/);
  return m ? m[1] : null;
}

function isPreReleaseOf(stableVer, betaVer){
  if(!stableVer || !betaVer) return false;
  return baseVersion(stableVer) === baseVersion(betaVer);
}

function hasNewerBetaTrainThanStable(stableVer, betaVer){
  if(!stableVer || !betaVer) return false;

  var s = baseVersion(stableVer);
  var b = baseVersion(betaVer);

  if(!s || !b) return false;

  return compareVersionRaw(b, s) > 0;
}

function toJSTDateStr(d){
  if(!d) return "";

  var dt = new Date(d);
  var y = dt.getFullYear();
  var m = ("0" + (dt.getMonth()+1)).slice(-2);
  var day = ("0" + dt.getDate()).slice(-2);

  return " (" + y + "/" + m + "/" + day + ")";
}

/* =========================
 * RSS解析
 * ========================= */

function extractOS(entryTitle){

  var m = entryTitle.match(
    /(iOS|iPadOS|macOS|watchOS|tvOS|visionOS|audioOS)\s+([\d.]+)(?:\s+(Beta\s*\d+|RC))?/i
  );

  if(!m) return null;

  return {
    name: m[1],
    version: m[2],
    pre: m[3] || null
  };
}

/* =========================
 * データ構築
 * ========================= */

function buildCompact(data){

  var commonStable = null;
  var commonStableDate = null;

  var commonBeta = null;
  var commonBetaDate = null;

  var exceptions = [];

  Object.keys(data).forEach(function(os){

    var item = data[os];

    if(!item.stable) return;

    if(!commonStable){
      commonStable = item.stable;
      commonStableDate = item.stableDate;
    }else{
      if(compareVersionRaw(item.stable, commonStable) !== 0){
        exceptions.push(os + ": " + item.stable);
      }
    }

    if(item.beta){
      if(!commonBeta){
        commonBeta = item.beta;
        commonBetaDate = item.betaDate;
      }else{
        if(compareVersionRaw(item.beta, commonBeta) !== 0){
          exceptions.push(os + ": " + item.beta);
        }
      }
    }

  });

  var commonStableOut     = commonStable ? commonStable : "--";
  var commonBetaOut       = commonBeta   ? commonBeta   : "-";
  var commonStableDateStr = toJSTDateStr(commonStableDate);
  var commonBetaDateStr   = toJSTDateStr(commonBetaDate);

  /* =========================
   * ★ここが修正ポイント
   * 正式版公開後は同系統betaを消す
   * ========================= */

  if(
    commonStable &&
    commonBeta &&
    isPreReleaseOf(commonStable, commonBeta) &&
    !hasNewerBetaTrainThanStable(commonStable, commonBeta)
  ){
    commonBetaOut = "-";
    commonBetaDateStr = "";
  }

  return {
    stable: commonStableOut,
    stableDate: commonStableDateStr,
    beta: commonBetaOut,
    betaDate: commonBetaDateStr,
    exceptions: exceptions
  };
}

/* =========================
 * 表示更新
 * ========================= */

function renderCompact(res){

  var stableVer = document.getElementById("os-stable-ver");
  var stableDate = document.getElementById("os-stable-date");

  var betaVer = document.getElementById("os-beta-ver");
  var betaDate = document.getElementById("os-beta-date");

  var ex = document.getElementById("os-exceptions");
  var updated = document.getElementById("os-updated");

  if(stableVer) stableVer.textContent = res.stable;
  if(stableDate) stableDate.textContent = res.stableDate;

  if(betaVer) betaVer.textContent = res.beta;
  if(betaDate) betaDate.textContent = res.betaDate;

  if(ex){
    ex.innerHTML = "";

    res.exceptions.forEach(function(e){
      var div = document.createElement("div");
      div.textContent = e;
      ex.appendChild(div);
    });
  }

  if(updated){
    var dt = new Date();
    updated.textContent =
      dt.getFullYear() + "-" +
      ("0"+(dt.getMonth()+1)).slice(-2) + "-" +
      ("0"+dt.getDate()).slice(-2);
  }

}

/* =========================
 * メイン
 * ========================= */

function fetchAndRender(){

  var cache = localStorage.getItem(CACHE_KEY);

  if(cache){
    try{
      var obj = JSON.parse(cache);

      if(now() - obj.t < CACHE_TTL_MS){
        renderCompact(obj.d);
        return;
      }
    }catch(e){}
  }

  fetch(FEED_URL)
    .then(function(r){ return r.text(); })
    .then(function(txt){

      var xml = parseXML(txt);

      var items = xml.querySelectorAll("item");

      var data = {};

      items.forEach(function(item){

        var title = item.querySelector("title").textContent;

        var os = extractOS(title);

        if(!os) return;

        if(!data[os.name]){
          data[os.name] = {};
        }

        var pubDate = new Date(
          item.querySelector("pubDate").textContent
        );

        if(os.pre){
          data[os.name].beta = os.version;
          data[os.name].betaDate = pubDate;
        }else{
          data[os.name].stable = os.version;
          data[os.name].stableDate = pubDate;
        }

      });

      var res = buildCompact(data);

      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({
          t: now(),
          d: res
        })
      );

      renderCompact(res);

    });

}

/* ========================= */

document.addEventListener(
  "DOMContentLoaded",
  fetchAndRender
);

})();
