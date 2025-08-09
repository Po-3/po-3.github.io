/* logicmap-embed.js v1.3 (wrap+colsPerRow) */
(function () {
  var MAX_BY_TYPE = { miniloto: 31, loto6: 43, loto7: 37 };
  var DEFAULT_WINDOW = 30;
  var HOT_THRESHOLD = 0.20;
  var COLD_GAP_THRESHOLD = 18;
  var REJOIN_GAP_THRESHOLD = 10;

  function normalizeFromJP(raw, lotoType) {
    if (raw && typeof raw === 'object' && Array.isArray(raw.draws)) return raw;
    if (!Array.isArray(raw)) return null;
    var draws = raw.map(function (row) {
      var keys = Object.keys(row);
      var numKeys = keys.filter(function (k) { return /^第\d+数字$/.test(k); })
        .sort(function (a, b) {
          var na = parseInt(a.replace(/\D/g, ''), 10);
          var nb = parseInt(b.replace(/\D/g, ''), 10);
          return na - nb;
        });
      var main = numKeys.map(function (k) { return parseInt(String(row[k]), 10); })
        .filter(function (n) { return Number.isFinite(n); });
      var no = parseInt(String(row['開催回'] || ''), 10) || 0;
      var date = String(row['日付'] || '');
      var braw = row['ボーナス数字'];
      var bonus = (braw === '' || braw == null) ? undefined : parseInt(String(braw), 10);
      return { no: no, date: date, main: main, bonus: bonus };
    }).filter(function (d) { return d.main && d.main.length > 0; });
    return { game: lotoType, draws: draws };
  }

  function computeStats(draws, maxNumber, windowSize) {
    if (windowSize == null) windowSize = DEFAULT_WINDOW;
    var sorted = draws.slice().sort(function (a, b) { return a.no - b.no; });
    var lastN = sorted.slice(-windowSize);

    var appearMap = {};
    for (var n = 1; n <= maxNumber; n++) appearMap[n] = [];
    lastN.forEach(function (d, idx) {
      d.main.forEach(function (v) { if (v >= 1 && v <= maxNumber) appearMap[v].push(idx); });
    });

    var latest = lastN[lastN.length - 1] || { main: [] };
    var latestSet = new Set(latest.main || []);

    var streakMap = {}, gapMap = {}, freqMap = {}, rejoinMap = {}, scoreMap = {};
    for (var n2 = 1; n2 <= maxNumber; n2++) {
      var s = 0; for (var i = lastN.length - 1; i >= 0; i--) { if (lastN[i].main.indexOf(n2) >= 0) s++; else break; }
      streakMap[n2] = s;
      var g = 0; for (var j = lastN.length - 1; j >= 0; j--) { if (lastN[j].main.indexOf(n2) < 0) g++; else break; }
      gapMap[n2] = g;
      freqMap[n2] = appearMap[n2].length / Math.max(1, lastN.length);
    }

    var prev = lastN[lastN.length - 2] || { main: [] };
    var prevSet = new Set(prev.main || []);
    for (var n3 = 1; n3 <= maxNumber; n3++) {
      rejoinMap[n3] = !!(latestSet.has(n3) && !prevSet.has(n3) && (gapMap[n3] >= REJOIN_GAP_THRESHOLD));
    }

    for (var n4 = 1; n4 <= maxNumber; n4++) {
      scoreMap[n4] = makeScore({
        freq: freqMap[n4],
        streak: streakMap[n4],
        gap: gapMap[n4],
        rejoin: rejoinMap[n4]
      });
    }

    return { lastN: lastN, freqMap: freqMap, streakMap: streakMap, gapMap: gapMap, rejoinMap: rejoinMap, scoreMap: scoreMap, latest: latest };
  }

  function makeScore(o) {
    var freqPart = Math.min(o.freq, 0.30) * 100;
    var streakPart = Math.min(o.streak, 3) * 6;
    var gapPart = Math.max(0, 12 - Math.abs(o.gap - 8));
    var rejoinPart = o.rejoin ? 5 : 0;
    return Math.round((freqPart + streakPart + gapPart + rejoinPart) * 100) / 100;
  }

  function cellStyle(freq, gap, streak, rejoin) {
    var bg = '#fff';
    if (freq >= HOT_THRESHOLD) bg = '#ffebe8';
    if (gap >= COLD_GAP_THRESHOLD) bg = '#eaf3ff';
    var label = null;
    if (rejoin) label = '新';
    else if (streak >= 2) label = String(streak);
    return { bg: bg, label: label };
  }

  function buildUI(root, options, stats, maxNumber) {
    root.innerHTML = '';

    var container = document.createElement('div');
    container.style.maxWidth = '100%';
    container.style.background = '#fff';
    container.style.border = '1px solid #e6ebf4';
    container.style.borderRadius = '12px';
    container.style.padding = '12px';
    container.style.boxShadow = '0 6px 20px #d2e4fa22';

    var head = document.createElement('div');
    head.style.display = 'flex';
    head.style.alignItems = 'center';
    head.style.gap = '8px';

    var title = document.createElement('strong');
    title.textContent = 'エリア出現グリッド';
    title.style.fontSize = '16px';

    head.appendChild(title);
    head.appendChild(document.createElement('div')).style.flex = '1';

    if (options.showControls !== false) {
      var label = document.createElement('label');
      label.textContent = '直近';
      label.style.fontSize = '13px';
      label.style.marginRight = '6px';

      var select = document.createElement('select');
[10, 20, 30, 40, 50, 100].forEach(function (n) {
  var opt = document.createElement('option');
  opt.value = String(n);
  opt.textContent = n + '回';
  if (n === options.windowSize) opt.selected = true;
  select.appendChild(opt);
});
      select.style.padding = '6px 8px';
      select.style.border = '1px solid #d9e1ee';
      select.style.borderRadius = '8px';
      select.addEventListener('change', function () {
        options.windowSize = parseInt(select.value, 10);
        fetchAndRender(root, options);
      });

      var right = document.createElement('div');
      right.appendChild(label);
      right.appendChild(select);
      head.appendChild(right);
    }
    container.appendChild(head);

    // ---- レイアウト（折返し） ----
    var pad = 6;
    var baseCellW = options.baseCellW || 28;
    var layout = options.layout || 'wrap';

    var viewportW = Math.max(0, (root.clientWidth || 360) - 24);
    var cellW = baseCellW;
    var cellH = Math.max(32, Math.round(cellW * 1.4));

    var cols, rows;
    if (layout === 'wrap') {
      var autoCols = Math.max(8, Math.floor((viewportW - pad * 2) / cellW));
      cols = Math.min(maxNumber, options.colsPerRow || autoCols);
      if (!isFinite(cols) || cols < 1) cols = Math.min(maxNumber, 10);
      rows = Math.ceil(maxNumber / cols);
    } else {
      cols = maxNumber; rows = 1;
      if (pad * 2 + cellW * cols > viewportW) container.style.overflowX = 'auto';
    }

    var width = pad * 2 + cellW * cols;
    var height = pad * 2 + cellH * rows;

    // ---- SVG ----
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', String(width));
    svg.setAttribute('height', String(height));
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', '出現グリッド');
    svg.style.display = 'block';
    svg.style.maxWidth = '100%';

    var bgRect = document.createElementNS(svg.namespaceURI, 'rect');
    bgRect.setAttribute('x', '0');
    bgRect.setAttribute('y', '0');
    bgRect.setAttribute('width', String(width));
    bgRect.setAttribute('height', String(height));
    bgRect.setAttribute('fill', '#fff');
    bgRect.setAttribute('rx', '10');
    svg.appendChild(bgRect);

    // tooltip
    var tip = document.createElement('div');
    tip.style.position = 'fixed';
    tip.style.pointerEvents = 'none';
    tip.style.zIndex = '9999';
    tip.style.background = '#111';
    tip.style.color = '#fff';
    tip.style.fontSize = '12px';
    tip.style.padding = '6px 8px';
    tip.style.borderRadius = '8px';
    tip.style.boxShadow = '0 2px 8px #0004';
    tip.style.display = 'none';
    document.body.appendChild(tip);
    function showTip(text, x, y) { tip.textContent = text; tip.style.left = (x + 12) + 'px'; tip.style.top = (y - 40) + 'px'; tip.style.display = 'block'; }
    function hideTip() { tip.style.display = 'none'; }

    // セル描画
    for (var n = 1; n <= maxNumber; n++) {
      (function (n) {
        var idx = n - 1;
        var col = idx % cols;
        var row = Math.floor(idx / cols);
        var x = pad + col * cellW;
        var y = pad + row * cellH;

        var freq = stats.freqMap[n] || 0;
        var streak = stats.streakMap[n] || 0;
        var gap = stats.gapMap[n] || 0;
        var rejoin = !!stats.rejoinMap[n];
        var style = cellStyle(freq, gap, streak, rejoin);

        var rect = document.createElementNS(svg.namespaceURI, 'rect');
        rect.setAttribute('x', String(x));
        rect.setAttribute('y', String(y));
        rect.setAttribute('width', String(cellW - 2));
        rect.setAttribute('height', String(cellH - 2));
        rect.setAttribute('fill', style.bg);
        rect.setAttribute('stroke', '#dfe5ef');
        rect.setAttribute('rx', '6');
        rect.addEventListener('mousemove', function (ev) {
          showTip('#' + n + ' 出現率:' + (freq * 100).toFixed(1) + '%  連続:' + streak + '  未出:' + gap + '回' + (rejoin ? ' / 新(復帰)' : ''), ev.clientX, ev.clientY);
        });
        rect.addEventListener('mouseleave', hideTip);
        svg.appendChild(rect);

        var text = document.createElementNS(svg.namespaceURI, 'text');
        text.setAttribute('x', String(x + (cellW - 2) / 2));
        text.setAttribute('y', String(y + Math.round(cellH * 0.55)));
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('font-size', String(Math.max(11, Math.round(cellW * 0.45))));
        text.setAttribute('fill', '#222');
        text.setAttribute('font-weight', '600');
        text.textContent = String(n);
        text.addEventListener('mousemove', function (ev) {
          showTip('#' + n + ' 出現率:' + (freq * 100).toFixed(1) + '%  連続:' + streak + '  未出:' + gap + '回' + (rejoin ? ' / 新(復帰)' : ''), ev.clientX, ev.clientY);
        });
        text.addEventListener('mouseleave', hideTip);
        svg.appendChild(text);

        if (style.label) {
          var badge = document.createElementNS(svg.namespaceURI, 'rect');
          badge.setAttribute('x', String(x + 4));
          badge.setAttribute('y', String(y + 4));
          badge.setAttribute('width', String(Math.max(16, Math.round(cellW * 0.64))));
          badge.setAttribute('height', String(Math.max(14, Math.round(cellH * 0.36))));
          badge.setAttribute('rx', '4');
          badge.setAttribute('fill', (style.label === '新') ? '#b370ff' : '#2bb4d6');
          svg.appendChild(badge);

          var btxt = document.createElementNS(svg.namespaceURI, 'text');
          btxt.setAttribute('x', String(x + 4 + Math.max(16, Math.round(cellW * 0.64)) / 2));
          btxt.setAttribute('y', String(y + 4 + Math.max(14, Math.round(cellH * 0.36)) - 4));
          btxt.setAttribute('text-anchor', 'middle');
          btxt.setAttribute('font-size', String(Math.max(10, Math.round(cellW * 0.36))));
          btxt.setAttribute('fill', '#fff');
          btxt.setAttribute('font-weight', '800');
          btxt.textContent = String(style.label);
          svg.appendChild(btxt);
        }
      })(n);
    }

    // 目盛り
    var t1 = document.createElementNS(svg.namespaceURI, 'text');
    t1.setAttribute('x', String(pad));
    t1.setAttribute('y', String(height - 4));
    t1.setAttribute('font-size', '11');
    t1.setAttribute('fill', '#75839b');
    t1.textContent = '1';
    svg.appendChild(t1);
    var t2 = document.createElementNS(svg.namespaceURI, 'text');
    t2.setAttribute('x', String(width - pad - 10));
    t2.setAttribute('y', String(height - 4));
    t2.setAttribute('font-size', '11');
    t2.setAttribute('fill', '#75839b');
    t2.textContent = String(maxNumber);
    svg.appendChild(t2);

    container.appendChild(svg);

    // 凡例
    var legend = document.createElement('div');
    legend.style.display = 'flex';
    legend.style.gap = '12px';
    legend.style.flexWrap = 'wrap';
    legend.style.marginTop = '10px';
    legend.style.fontSize = '13px';
    legend.style.color = '#333';

    function chip(color, border) {
      var s = document.createElement('span');
      s.style.width = '14px'; s.style.height = '14px';
      s.style.background = color; s.style.border = '1px solid ' + border;
      s.style.borderRadius = '3px'; s.style.display = 'inline-block';
      return s;
    }

    var item1 = document.createElement('span');
    item1.style.display = 'inline-flex'; item1.style.alignItems = 'center'; item1.style.gap = '6px';
    item1.appendChild(chip('#ffebe8', '#e7b5ad'));
    item1.appendChild(document.createTextNode(' HOT（直近出現率↑）'));

    var item2 = document.createElement('span');
    item2.style.display = 'inline-flex'; item2.style.alignItems = 'center'; item2.style.gap = '6px';
    item2.appendChild(chip('#eaf3ff', '#bcd4f3'));
    item2.appendChild(document.createTextNode(' COLD（未出長期）'));

    var item3 = document.createElement('span');
    item3.style.display = 'inline-flex'; item3.style.alignItems = 'center'; item3.style.gap = '6px';
    var r3 = document.createElement('span'); r3.style.width = '18px'; r3.style.height = '16px'; r3.style.background = '#2bb4d6'; r3.style.borderRadius = '4px'; r3.style.display = 'inline-block';
    item3.appendChild(r3); item3.appendChild(document.createTextNode(' 数字バッジ＝連続回数'));

    var item4 = document.createElement('span');
    item4.style.display = 'inline-flex'; item4.style.alignItems = 'center'; item4.style.gap = '6px';
    var r4 = document.createElement('span'); r4.style.width = '18px'; r4.style.height = '16px'; r4.style.background = '#b370ff'; r4.style.borderRadius = '4px'; r4.style.display = 'inline-block';
    item4.appendChild(r4); item4.appendChild(document.createTextNode(' 「新」＝空白長10回以上→直近で復帰'));

    legend.appendChild(item1); legend.appendChild(item2); legend.appendChild(item3); legend.appendChild(item4);
    container.appendChild(legend);

    // 狙い目 Top
    var listWrap = document.createElement('div');
    listWrap.style.marginTop = '16px';
    listWrap.style.padding = '10px 12px';
    listWrap.style.border = '1px solid #e6ebf4';
    listWrap.style.borderRadius = '10px';
    listWrap.style.background = '#fbfdff';

    var ttl = document.createElement('div');
    ttl.style.fontWeight = '700'; ttl.style.marginBottom = '8px';
    ttl.textContent = '狙い目候補（自動抽出）';
    listWrap.appendChild(ttl);

    var arr = [];
    for (var n5 = 1; n5 <= maxNumber; n5++) arr.push({ n: n5, score: stats.scoreMap[n5] || 0 });
    arr.sort(function (a, b) { return b.score - a.score; });
    var top = arr.slice(0, 7);

    var ol = document.createElement('ol'); ol.style.margin = '0'; ol.style.paddingLeft = '20px';
    top.forEach(function (item) {
      var li = document.createElement('li'); li.style.margin = '4px 0';
      var strong = document.createElement('strong'); strong.style.marginRight = '6px'; strong.textContent = '#' + item.n;
      var span1 = document.createElement('span'); span1.style.color = '#60708b'; span1.textContent = 'Score';
      var span2 = document.createElement('span'); span2.style.color = '#9aa7bc'; span2.style.marginLeft = '10px';
      span2.textContent = '出現率' + (stats.freqMap[item.n] * 100).toFixed(1) + '% / 連続' + (stats.streakMap[item.n] || 0) + ' / 未出' + (stats.gapMap[item.n] || 0) + '回' + (stats.rejoinMap[item.n] ? ' / 新(復帰)' : '');
      li.appendChild(strong); li.appendChild(span1); li.appendChild(document.createTextNode(' ' + item.score)); li.appendChild(span2);
      ol.appendChild(li);
    });
    listWrap.appendChild(ol);

    container.appendChild(listWrap);
    root.appendChild(container);
  }

  function fetchAndRender(root, options) {
    var url = options.jsonUrl;
    var lotoType = options.lotoType;
    var windowSize = options.windowSize || DEFAULT_WINDOW;
    var maxNumber = MAX_BY_TYPE[lotoType] || 43;

    root.textContent = '読み込み中...';

    fetch(url, { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        var data = normalizeFromJP(j, lotoType) || j;
        if (!data || !data.draws || !data.draws.length) throw new Error('JSON形式が不正、またはデータが空です。');
        var stats = computeStats(data.draws, maxNumber, windowSize);
        buildUI(root, options, stats, maxNumber);
      })
      .catch(function (e) {
        root.textContent = '読み込みエラー：' + e;
      });
  }

  window.createLogicMap = function (options) {
    if (!options || !options.targetId || !options.jsonUrl || !options.lotoType) {
      throw new Error('createLogicMap: targetId/jsonUrl/lotoType は必須です');
    }
    var root = document.getElementById(options.targetId);
    if (!root) throw new Error('createLogicMap: 指定IDの要素が見つかりません: #' + options.targetId);
    fetchAndRender(root, options);
  };

  console.log('LogicMap v1.3 loaded', { supportsColsPerRow: true });
})();
