/* ==========================================================
   Apple OS Widget - Compact
   v7: WWDC後のBeta並走表示に対応
      - 最新世代・正式版
      - 現行世代・ベータ
      - 次世代・ベータ
      - 旧OSの安全更新
      - 例外（正式版 / 現行Beta / 次世代Beta）
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

  var LEGACY_OS_IDS = {
    ios: true,
    ipados: true,
    macos: true
  };

  var DOM = {
    stableVer:        "os-stable-ver",
    stableDate:       "os-stable-date",
    currentBetaRow:   "os-current-beta-row",
    currentBetaVer:   "os-current-beta-ver",
    currentBetaDate:  "os-current-beta-date",
    nextBetaRow:      "os-next-beta-row",
    nextBetaVer:      "os-next-beta-ver",
    nextBetaDate:     "os-next-beta-date",
    betaNote:         "os-beta-note",
    legacyTitle:      "os-legacy-title",
    legacy:           "os-legacy-security",
    exceptionsTitle:  "os-exceptions-title",
    exceptions:       "os-exceptions",
    updated:          "os-updated",
    auto:             "os-auto"
  };

  var CACHE_KEY         = "tnr_os_widget_cache_compact_v7";
  var CACHE_TTL_MS      = 6 * 60 * 60 * 1000;
  var FETCH_TIMEOUT_MS  = 3500;
  var EVENT_WINDOW_DAYS = 14;
  var LEGACY_MAX_ITEMS  = 8;

  function $(id){ return document.getElementById(id); }
  function safeText(el, v){ if(el) el.textContent = v; }
  function now(){ return Date.now ? Date.now() : new Date().getTime(); }
  function z2(n){ return (n < 10 ? "0" : "") + n; }

  function toJSTDateStr(date){
    if(!date || isNaN(date.getTime())) return null;
    var jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
    return jst.getUTCFullYear() + "/" +
           z2(jst.getUTCMonth() + 1) + "/" +
           z2(jst.getUTCDate());
  }

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
      .replace(/\(\s*rc\s*\)/g, "rc")
      .replace(/\bv\.?\s*(\d+)\b/g, "v$1");
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

    var rev = 0;
    var revMatch = norm.match(/\bv(\d+)\b/);
    if(revMatch) rev = parseInt(revMatch[1], 10);

    return { nums: nums, stage: stage, stageNum: stageNum, rev: rev };
  }

  function getMajorVersion(raw){
    var p = parseVersionForCompare(raw);
    if(!p) return null;
    return p.nums[0];
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

    if(pa.stage > pb.stage) return  1;
    if(pa.stage < pb.stage) return -1;

    if(pa.stageNum > pb.stageNum) return  1;
    if(pa.stageNum < pb.stageNum) return -1;

    if(pa.rev > pb.rev) return  1;
    if(pa.rev < pb.rev) return -1;

    return 0;
  }

  function parseBaseVersion(raw){
    var p = parseVersionForCompare(raw);
    if(!p) return null;
    return p.nums.slice(0);
  }

  function compareBaseVersion(a, b){
    var pa = parseBaseVersion(a);
    var pb = parseBaseVersion(b);

    if(!pa && !pb) return 0;
    if(!pa) return -1;
    if(!pb) return  1;

    for(var i = 0; i < 3; i++){
      if(pa[i] > pb[i]) return  1;
      if(pa[i] < pb[i]) return -1;
    }

    return 0;
  }

  function shouldHideBetaAfterStable(stableVer, betaVer){
    if(!stableVer || !betaVer) return false;
    return compareBaseVersion(betaVer, stableVer) <= 0;
  }

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
      if(d && (!map[key].earliest || d < map[key].earliest)){
        map[key].earliest = d;
      }
    }

    if(!order.length) return { ver: null, date: null, count: 0, total: 0 };

    var bestKey = order[0];

    for(var j = 1; j < order.length; j++){
      var k = order[j];

      if(map[k].count > map[bestKey].count){
        bestKey = k;
      } else if(map[k].count === map[bestKey].count){
        if(compareVersionRaw(map[k].rep, map[bestKey].rep) > 0){
          bestKey = k;
        }
      }
    }

    return {
      ver:   map[bestKey].rep,
      date:  map[bestKey].earliest,
      count: map[bestKey].count,
      total: order.length
    };
  }

  function chooseCommonVersion(pairs){
    var mode = modeVersionWithDate(pairs);
    var ver = mode.ver;
    var date = mode.date;

    if(mode.count <= 1){
      var max = maxVersionWithDate(pairs);
      ver = max.ver;
      date = max.date;
    }

    return { ver: ver, date: date };
  }

  function readCache(){
    try{
      var raw = localStorage.getItem(CACHE_KEY);
      if(!raw) return null;

      var obj = JSON.parse(raw);
      if(!obj || !obj.savedAt || !obj.data) return null;
      if(now() - obj.savedAt > CACHE_TTL_MS) return null;

      return obj.data;
    }catch(e){
      return null;
    }
  }

  function writeCache(data){
    try{
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        savedAt: now(),
        data: data
      }));
    }catch(e){}
  }

  function parseRSS(xmlText){
    var parser = new DOMParser();
    var xml = parser.parseFromString(xmlText, "application/xml");

    if(xml.getElementsByTagName("parsererror").length){
      throw new Error("parse error");
    }

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

  function extractVersionPart(title, osKey){
    var re = new RegExp(
      osKey +
        "\\s+(?:[A-Za-z]+\\s+)?" +
        "(" +
          "[0-9]+(?:\\.[0-9]+){0,2}" +
          "(?:\\s*\\(\\s*[a-z]\\s*\\))?" +
          "(?:" +
            "\\s*(?:beta(?:\\s*\\d+)?|beta\\d+)" +
            "|" +
            "\\s*(?:rc\\s*\\d+|rc\\d+|rc|release\\s+candidate)" +
          ")?" +
          "(?:\\s*v\\.?\\s*\\d+)?" +
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
    v = v.replace(/\bRC\s*(\d+)\b/i, "RC$1").replace(/\bRC\b/i, "RC");
    v = v.replace(/\bv\.?\s*(\d+)\b/i, " v.$1");

    return v;
  }

  function makeEmptyOSData(){
    return {
      stable: null,
      stableDate: null,
      beta: null,
      betaDate: null,
      betaByMajor: {}
    };
  }

  function pickLatestPerOS(items){
    var res = {
      ios:      makeEmptyOSData(),
      ipados:   makeEmptyOSData(),
      macos:    makeEmptyOSData(),
      watchos:  makeEmptyOSData(),
      tvos:     makeEmptyOSData(),
      audioos:  makeEmptyOSData(),
      visionos: makeEmptyOSData(),
      legacy:   {},
      updated:  null
    };

    for(var a = 0; a < OS_KEYS.length; a++){
      res.legacy[OS_KEYS[a].id] = {};
    }

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

          var betaMajor = getMajorVersion(ver);
          if(betaMajor !== null){
            var betaMajorKey = String(betaMajor);
            var oldBeta = res[osId].betaByMajor[betaMajorKey];

            if(!oldBeta || compareVersionRaw(ver, oldBeta.ver) > 0){
              res[osId].betaByMajor[betaMajorKey] = { ver: ver, date: pubDate };
            } else if(oldBeta && sameVersion(ver, oldBeta.ver)){
              if(pubDate && (!oldBeta.date || pubDate < oldBeta.date)){
                oldBeta.date = pubDate;
              }
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

          var major = getMajorVersion(ver);
          if(major !== null){
            var mKey = String(major);
            var old = res.legacy[osId][mKey];

            if(!old || compareVersionRaw(ver, old.ver) > 0){
              res.legacy[osId][mKey] = { ver: ver, date: pubDate };
            } else if(old && sameVersion(ver, old.ver)){
              if(pubDate && (!old.date || pubDate < old.date)){
                old.date = pubDate;
              }
            }
          }
        }
      }
    }

    return res;
  }

  function getBetaEntryForMajor(osData, major){
    if(!osData || major === null || major === undefined || !osData.betaByMajor){
      return { ver: null, date: null };
    }

    var entry = osData.betaByMajor[String(major)];
    if(!entry) return { ver: null, date: null };

    return {
      ver: entry.ver || null,
      date: entry.date || null
    };
  }

  function pickNextBetaMajor(data, currentMajor){
    var map = Object.create(null);
    var order = [];

    for(var i = 0; i < OS_KEYS.length; i++){
      var od = data[OS_KEYS[i].id] || {};
      var majorsMap = od.betaByMajor || {};
      var majors = Object.keys(majorsMap);

      for(var j = 0; j < majors.length; j++){
        var major = parseInt(majors[j], 10);
        if(isNaN(major)) continue;
        if(currentMajor !== null && currentMajor !== undefined && major <= currentMajor) continue;

        var key = String(major);
        if(!map[key]){
          map[key] = { major: major, count: 0 };
          order.push(key);
        }

        map[key].count++;
      }
    }

    if(!order.length) return null;

    var bestKey = order[0];

    for(var k = 1; k < order.length; k++){
      var candKey = order[k];

      if(map[candKey].count > map[bestKey].count){
        bestKey = candKey;
      } else if(map[candKey].count === map[bestKey].count){
        if(map[candKey].major > map[bestKey].major){
          bestKey = candKey;
        }
      }
    }

    return map[bestKey].major;
  }

  function buildLegacyItems(data, commonStable){
    var commonMajor = getMajorVersion(commonStable);
    if(commonMajor === null) return [];

    var items = [];

    for(var i = 0; i < OS_KEYS.length; i++){
      var os = OS_KEYS[i];
      if(!LEGACY_OS_IDS[os.id]) continue;

      var majorsMap = data.legacy && data.legacy[os.id] ? data.legacy[os.id] : {};
      var majors = Object.keys(majorsMap).sort(function(a, b){
        return parseInt(b, 10) - parseInt(a, 10);
      });

      for(var j = 0; j < majors.length; j++){
        var major = parseInt(majors[j], 10);
        if(isNaN(major)) continue;
        if(major >= commonMajor) continue;

        var entry = majorsMap[majors[j]];
        if(!entry || !entry.ver) continue;

        items.push(os.label + " " + major + "系: " + joinVerDate(entry.ver, toJSTDateStr(entry.date)));
      }
    }

    return items.slice(0, LEGACY_MAX_ITEMS);
  }

  function buildCompact(data){
    var stPairs = [];

    for(var i = 0; i < OS_KEYS.length; i++){
      var id = OS_KEYS[i].id;
      var d  = data[id] || {};
      stPairs.push({ ver: d.stable || null, date: d.stableDate || null });
    }

    var stCommon = chooseCommonVersion(stPairs);
    var commonStable = stCommon.ver;
    var commonStableDate = stCommon.date;
    var commonStableMajor = getMajorVersion(commonStable);

    var currentBetaPairs = [];
    var nextBetaPairs = [];
    var nextBetaMajor = pickNextBetaMajor(data, commonStableMajor);

    for(var b = 0; b < OS_KEYS.length; b++){
      var bd = data[OS_KEYS[b].id] || {};
      var cur = getBetaEntryForMajor(bd, commonStableMajor);
      var nxt = getBetaEntryForMajor(bd, nextBetaMajor);

      currentBetaPairs.push({ ver: cur.ver, date: cur.date });
      nextBetaPairs.push({ ver: nxt.ver, date: nxt.date });
    }

    var currentCommon = chooseCommonVersion(currentBetaPairs);
    var nextCommon = chooseCommonVersion(nextBetaPairs);

    var commonCurrentBeta = currentCommon.ver;
    var commonCurrentBetaDate = currentCommon.date;
    var commonNextBeta = nextCommon.ver;
    var commonNextBetaDate = nextCommon.date;

    var currentBetaHiddenByStable = shouldHideBetaAfterStable(commonStable, commonCurrentBeta);

    var commonStableOut = commonStable ? commonStable : "--";
    var commonCurrentBetaOut = commonCurrentBeta ? commonCurrentBeta : "-";
    var commonNextBetaOut = commonNextBeta ? commonNextBeta : "-";

    var commonStableDateStr = toJSTDateStr(commonStableDate);
    var commonCurrentBetaDateStr = toJSTDateStr(commonCurrentBetaDate);
    var commonNextBetaDateStr = toJSTDateStr(commonNextBetaDate);

    if(currentBetaHiddenByStable){
      commonCurrentBetaOut = "-";
      commonCurrentBetaDateStr = null;
    }

    var legacyItems = buildLegacyItems(data, commonStable);

    var exStable = [];
    var exCurrentBeta = [];
    var exNextBeta = [];

    for(var j = 0; j < OS_KEYS.length; j++){
      var os = OS_KEYS[j];
      var od = data[os.id] || {
        stable: null,
        stableDate: null,
        beta: null,
        betaDate: null,
        betaByMajor: {}
      };

      if(commonStable){
        if(!od.stable){
          exStable.push(os.label + ": --");
        } else if(!sameVersion(od.stable, commonStable)){
          exStable.push(os.label + ": " + joinVerDate(od.stable, toJSTDateStr(od.stableDate)));
        }
      } else {
        if(od.stable){
          exStable.push(os.label + ": " + joinVerDate(od.stable, toJSTDateStr(od.stableDate)));
        }
      }

      var stableRefForThisOS = od.stable || commonStable || null;
      var currentEntry = getBetaEntryForMajor(od, commonStableMajor);
      var hideThisCurrentBeta = shouldHideBetaAfterStable(stableRefForThisOS, currentEntry.ver);

      if(commonCurrentBetaOut && commonCurrentBetaOut !== "-"){
        if(currentEntry.ver && !hideThisCurrentBeta && !sameVersion(currentEntry.ver, commonCurrentBetaOut)){
          exCurrentBeta.push(os.label + ": " + joinVerDate(currentEntry.ver, toJSTDateStr(currentEntry.date)));
        }
      } else {
        if(currentEntry.ver && !hideThisCurrentBeta){
          exCurrentBeta.push(os.label + ": " + joinVerDate(currentEntry.ver, toJSTDateStr(currentEntry.date)));
        }
      }

      var nextEntry = getBetaEntryForMajor(od, nextBetaMajor);

      if(commonNextBetaOut && commonNextBetaOut !== "-"){
        if(nextEntry.ver && !sameVersion(nextEntry.ver, commonNextBetaOut)){
          exNextBeta.push(os.label + ": " + joinVerDate(nextEntry.ver, toJSTDateStr(nextEntry.date)));
        }
      } else {
        if(nextEntry.ver){
          exNextBeta.push(os.label + ": " + joinVerDate(nextEntry.ver, toJSTDateStr(nextEntry.date)));
        }
      }
    }

    var updated = null;
    if(data.updated){
      var dd = new Date(data.updated);
      if(!isNaN(dd.getTime())){
        updated = toJSTDateStr(dd).replace(/\//g, "-");
      }
    }

    var isEvent = false;
    if(updated){
      var d2 = new Date(updated + "T00:00:00+09:00");
      if(!isNaN(d2.getTime())){
        if((Date.now() - d2.getTime()) / 86400000 <= EVENT_WINDOW_DAYS){
          isEvent = true;
        }
      }
    }

    return {
      commonStable:          commonStableOut,
      commonStableDate:      commonStableDateStr,
      commonCurrentBeta:     commonCurrentBetaOut,
      commonCurrentBetaDate: commonCurrentBetaDateStr,
      commonNextBeta:        commonNextBetaOut,
      commonNextBetaDate:    commonNextBetaDateStr,
      legacy:                legacyItems,
      exceptions: {
        stable: exStable,
        currentBeta: exCurrentBeta,
        nextBeta: exNextBeta
      },
      updated: updated,
      isHot: isEvent
    };
  }

  function appendDecoratedLine(el, line){
    var target = "macOS: 26.3.2";
    var idx = line.indexOf(target);

    if(idx === -1){
      el.textContent = line;
      return;
    }

    el.appendChild(document.createTextNode(line.slice(0, idx + target.length)));

    var note = document.createElement("span");
    note.style.fontSize = "0.8em";
    note.style.color = "#888";
    note.textContent = " (MacBook Neo Only)";
    el.appendChild(note);

    el.appendChild(document.createTextNode(line.slice(idx + target.length)));
  }

  function addSimpleItems(parent, items){
    if(!items || !items.length) return;

    items.forEach(function(line){
      var div = document.createElement("div");
      div.className = "tnr-osw-ex-item";
      appendDecoratedLine(div, line);
      parent.appendChild(div);
    });
  }

  function applyToDOM(compact, state){
    requestAnimationFrame(function(){
      var hasCurrentBeta = !!(compact.commonCurrentBeta && compact.commonCurrentBeta !== "-");
      var hasNextBeta = !!(compact.commonNextBeta && compact.commonNextBeta !== "-");

      safeText($(DOM.stableVer), compact.commonStable || "--");
      safeText($(DOM.stableDate), compact.commonStableDate ? "(" + compact.commonStableDate + ")" : "");

      safeText($(DOM.currentBetaVer), compact.commonCurrentBeta || "-");
      safeText($(DOM.currentBetaDate), compact.commonCurrentBetaDate ? "(" + compact.commonCurrentBetaDate + ")" : "");

      safeText($(DOM.nextBetaVer), compact.commonNextBeta || "-");
      safeText($(DOM.nextBetaDate), compact.commonNextBetaDate ? "(" + compact.commonNextBetaDate + ")" : "");

      var currentBetaRowEl = $(DOM.currentBetaRow);
      if(currentBetaRowEl){
        currentBetaRowEl.style.display = "";
      }

      var nextBetaRowEl = $(DOM.nextBetaRow);
      if(nextBetaRowEl){
        nextBetaRowEl.style.display = hasNextBeta ? "" : "none";
      }

      var betaNoteEl = $(DOM.betaNote);
      if(betaNoteEl){
        betaNoteEl.style.display = hasNextBeta ? "" : "none";
      }

      var legacyTitleEl = $(DOM.legacyTitle);
      var legacyEl = $(DOM.legacy);
      var legacy = compact.legacy || [];

      if(legacyEl){
        legacyEl.textContent = "";

        if(legacy.length){
          addSimpleItems(legacyEl, legacy);
          legacyEl.style.display = "";
          if(legacyTitleEl) legacyTitleEl.style.display = "";
        } else {
          legacyEl.style.display = "none";
          if(legacyTitleEl) legacyTitleEl.style.display = "none";
        }
      }

      var exTitleEl = $(DOM.exceptionsTitle);
      var exEl = $(DOM.exceptions);

      if(exEl){
        exEl.textContent = "";

        var st = (compact.exceptions && compact.exceptions.stable) ? compact.exceptions.stable : [];
        var cb = (compact.exceptions && compact.exceptions.currentBeta) ? compact.exceptions.currentBeta : [];
        var nb = (compact.exceptions && compact.exceptions.nextBeta) ? compact.exceptions.nextBeta : [];

        function addGroup(title, items, kindClass){
          if(!items || !items.length) return;

          var g = document.createElement("div");
          g.className = "tnr-osw-ex-group " + kindClass;

          var h = document.createElement("div");
          h.className = "tnr-osw-ex-h";
          h.textContent = title;
          g.appendChild(h);

          items.slice(0, 5).forEach(function(line){
            var div = document.createElement("div");
            div.className = "tnr-osw-ex-item";
            appendDecoratedLine(div, line);
            g.appendChild(div);
          });

          exEl.appendChild(g);
        }

        addGroup("正式版", st, "is-stable");
        addGroup("現行Beta", cb, "is-beta-current");
        addGroup("次世代Beta", nb, "is-beta-next");

        if((st && st.length) || (cb && cb.length) || (nb && nb.length)){
          exEl.style.display = "";
          exEl.classList.toggle("is-hot", !!compact.isHot);
          if(exTitleEl) exTitleEl.style.display = "";
        } else {
          exEl.style.display = "none";
          exEl.classList.remove("is-hot");
          if(exTitleEl) exTitleEl.style.display = "none";
        }
      }

      if(compact.updated){
        safeText($(DOM.updated), compact.updated);
      }

      var autoEl = $(DOM.auto);
      if(autoEl){
        if(state === "cache"){
          autoEl.textContent = "キャッシュ";
          autoEl.style.display = "";
        } else if(state === "fresh"){
          autoEl.textContent = "自動更新";
          autoEl.style.display = "";
        } else {
          autoEl.style.display = "none";
        }
      }
    });
  }

  function fetchWithTimeout(url, timeoutMs){
    var controller = (typeof AbortController !== "undefined")
      ? new AbortController()
      : null;

    var timer = null;

    if(controller){
      timer = setTimeout(function(){
        try{
          controller.abort();
        }catch(e){}
      }, timeoutMs);
    }

    return fetch(url, {
      cache: "no-store",
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

  function run(){
    var cached = readCache();
    if(cached){
      applyToDOM(cached, "cache");
    }

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
        /* フェッチ失敗時はキャッシュ表示を維持 */
      });
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
})();
