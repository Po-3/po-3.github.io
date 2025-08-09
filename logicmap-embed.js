// ===== レイアウト計算（折返し） =====
var pad = 6;
var baseCellW = options.baseCellW || 28;
var layout = options.layout || 'wrap';
var viewportW = Math.max(0, (root.clientWidth || 360) - 24);
var cellW = baseCellW;
var cellH = Math.max(32, Math.round(cellW * 1.4));

// ★ ここが固定列数ポイント
var cols;
if (layout === 'wrap') {
  // colsPerRow があればそれを優先、なければ幅から自動算出
  cols = Math.min(maxNumber, options.colsPerRow || Math.max(
    8,
    Math.floor((viewportW - pad * 2) / cellW)
  ));
  if (!isFinite(cols) || cols < 1) cols = Math.min(maxNumber, 10);
} else {
  cols = maxNumber; // single行
}
var rows = Math.ceil(maxNumber / cols);

var width  = pad * 2 + cellW * cols;
var height = pad * 2 + cellH * rows;
if (layout !== 'wrap' && width > viewportW) container.style.overflowX = 'auto';

// ===== SVG（省略可：既存のまま） =====
// ... SVG作成・bgRect 追加までは既存のまま ...

// ===== 数字セルの描画（x,yを列/行で計算） =====
for (var n = 1; n <= maxNumber; n++) {
  (function (n) {
    var idx = n - 1;
    var col = idx % cols;
    var row = Math.floor(idx / cols);
    var x = pad + col * cellW;
    var y = pad + row * cellH;

    var freq   = stats.freqMap[n]   || 0;
    var streak = stats.streakMap[n] || 0;
    var gap    = stats.gapMap[n]    || 0;
    var rejoin = !!stats.rejoinMap[n];
    var style  = cellStyle(freq, gap, streak, rejoin);

    // ここから下は既存の rect/text/badge をそのまま使用
    var rect = document.createElementNS(svg.namespaceURI, 'rect');
    rect.setAttribute('x', x); rect.setAttribute('y', y);
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
    text.setAttribute('x', x + (cellW - 2) / 2);
    text.setAttribute('y', y + Math.round(cellH * 0.55));
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('font-size', '13');
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
      badge.setAttribute('x', x + 4);
      badge.setAttribute('y', y + 4);
      badge.setAttribute('width', '18');
      badge.setAttribute('height', '16');
      badge.setAttribute('rx', '4');
      badge.setAttribute('fill', (style.label === '新') ? '#b370ff' : '#2bb4d6');
      svg.appendChild(badge);

      var btxt = document.createElementNS(svg.namespaceURI, 'text');
      btxt.setAttribute('x', x + 13);
      btxt.setAttribute('y', y + 16);
      btxt.setAttribute('text-anchor', 'middle');
      btxt.setAttribute('font-size', '12');
      btxt.setAttribute('fill', '#fff');
      btxt.setAttribute('font-weight', '800');
      btxt.textContent = String(style.label);
      svg.appendChild(btxt);
    }
  })(n);
}
