(function () {
  'use strict';

  var WIDGET_ID = 'tnr-fixed-amazon-links';
  var STYLE_ID = 'tnr-fal-style';
  var RENDERED_FLAG = 'data-tnr-fal-rendered';

  var items = [
    {
      label: 'おすすめ商品',
      desc: 'iPhoneやMac、AirPodsまで、いま選ばれているApple製品をまとめてチェックできます。',
      url: 'https://www.amazon.co.jp/stores/page/E2802B6E-C80B-49EB-8240-1032DA9DC503?ingress=2&lp_context_asin=B0FQG9JJ2G&lp_context_query=apple&visitId=fbc46802-1f4a-4cf0-880a-391fc54329d4&linkCode=ll2&tag=k09cf-22&linkId=02715097e39cd51d55d915871388e047&ref_=as_li_ss_tl',
      image: 'https://cdn-ak.f.st-hatena.com/images/fotolife/n/numberhunter/20260326/20260326211220.jpg'
    },
    {
      label: '相性のいい周辺機器',
      desc: '充電器やケーブルなど、あとから揃えたくなる定番アクセサリをまとめて見られます。',
      url: 'https://www.amazon.co.jp/stores/page/F4AAC411-D8F4-43D4-92BC-FCF95AEE7914?ingress=2&lp_context_asin=B0FQG9JJ2G&lp_context_query=apple&visitId=fbc46802-1f4a-4cf0-880a-391fc54329d4&linkCode=ll2&tag=k09cf-22&linkId=cb260fa883e9d0826cfd32e7fe3c7993&ref_=as_li_ss_tl',
      image: 'https://cdn-ak.f.st-hatena.com/images/fotolife/n/numberhunter/20260326/20260326210346.jpg'
    },
    {
      label: '新着商品',
      desc: '最近追加されたApple関連アイテムを中心に、新しい選択肢をまとめてチェックできます。',
      url: 'https://www.amazon.co.jp/stores/page/4E2B3D23-7AFF-410E-A05F-A11A86063BFC?ingress=2&lp_context_asin=B0FQG9JJ2G&lp_context_query=apple&visitId=fbc46802-1f4a-4cf0-880a-391fc54329d4&linkCode=ll2&tag=k09cf-22&linkId=48769df92b9410c4402442371c7f2a0f&ref_=as_li_ss_tl',
      image: 'https://cdn-ak.f.st-hatena.com/images/fotolife/n/numberhunter/20260326/20260326210138.jpg'
    },
    {
      label: 'セール',
      desc: '価格が動いているApple関連アイテムをまとめて確認できます。タイミング次第で掘り出し物もあります。',
      url: 'https://www.amazon.co.jp/stores/page/FBA45248-AB65-4A13-B20F-915E14541501?ingress=2&lp_context_asin=B0FQG9JJ2G&lp_context_query=apple&visitId=21076776-cebf-435c-b6ec-f7079c7a14e2&linkCode=ll2&tag=k09cf-22&linkId=fdc87e0bb8a94e26ff597f18b31800f7&ref_=as_li_ss_tl',
      image: 'https://cdn-ak.f.st-hatena.com/images/fotolife/n/numberhunter/20260326/20260326210756.jpg'
    }
  ];

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;

    var css = [
      '#' + WIDGET_ID + ' .tnr-fal-wrap{',
      'margin:32px 0;',
      'padding:22px;',
      'border:1px solid #e5e7eb;',
      'border-radius:16px;',
      'background:#fff;',
      'box-sizing:border-box;',
      '}',

      '#' + WIDGET_ID + ' .tnr-fal-head{',
      'margin-bottom:18px;',
      '}',

      '#' + WIDGET_ID + ' .tnr-fal-title{',
      'margin:0 0 6px;',
      'font-size:1.05em;',
      'font-weight:700;',
      'line-height:1.6;',
      'color:#111827;',
      '}',

      '#' + WIDGET_ID + ' .tnr-fal-sub{',
      'margin:0;',
      'font-size:.93em;',
      'line-height:1.8;',
      'color:#6b7280;',
      '}',

      '#' + WIDGET_ID + ' .tnr-fal-grid{',
      'display:grid;',
      'grid-template-columns:repeat(2,minmax(0,1fr));',
      'gap:16px;',
      'align-items:stretch;',
      '}',

      '#' + WIDGET_ID + ' .tnr-fal-card{',
      'display:flex;',
      'flex-direction:column;',
      'justify-content:flex-start;',
      'min-height:220px;',
      'padding:16px;',
      'border:1px solid #e5e7eb;',
      'border-radius:14px;',
      'background:#fafafa;',
      'box-sizing:border-box;',
      'overflow:hidden;',
      'transition:.15s ease;',
      '}',

      '#' + WIDGET_ID + ' .tnr-fal-card:hover{',
      'background:#f5f7fb;',
      '}',

      '#' + WIDGET_ID + ' .tnr-fal-thumb{',
      'display:block;',
      'width:100%;',
      'aspect-ratio:16 / 9;',
      'object-fit:cover;',
      'object-position:center;',
      'border-radius:10px;',
      'margin-bottom:12px;',
      'background:#f3f4f6;',
      '}',

      '#' + WIDGET_ID + ' .tnr-fal-badge{',
      'display:inline-block;',
      'align-self:flex-start;',
      'margin-bottom:10px;',
      'padding:6px 10px;',
      'border-radius:999px;',
      'background:#eff6ff;',
      'color:#2563eb;',
      'font-size:.78em;',
      'font-weight:700;',
      'line-height:1.2;',
      '}',

      '#' + WIDGET_ID + ' .tnr-fal-name{',
      'margin:0 0 10px;',
      'font-size:1em;',
      'font-weight:700;',
      'line-height:1.6;',
      'color:#111827;',
      '}',

      '#' + WIDGET_ID + ' .tnr-fal-desc{',
      'margin:0 0 14px;',
      'font-size:.92em;',
      'line-height:1.75;',
      'color:#4b5563;',
      'flex:1;',
      '}',

      '#' + WIDGET_ID + ' .tnr-fal-btn{',
      'display:inline-block;',
      'text-decoration:none;',
      'text-align:center;',
      'padding:12px 14px;',
      'font-size:.92em;',
      'font-weight:700;',
      'line-height:1.2;',
      'color:#111 !important;',
      'border-radius:8px;',
      'border:1px solid #a88734;',
      'background:linear-gradient(to bottom,#f7dfa5,#f0c14b);',
      'box-shadow:0 1px 0 rgba(255,255,255,.45) inset,0 1px 0 rgba(0,0,0,.05);',
      'transition:background .12s ease,border-color .12s ease,transform .04s ease;',
      '}',

      '#' + WIDGET_ID + ' .tnr-fal-btn:hover{',
      'background:linear-gradient(to bottom,#f5d78e,#eeb933);',
      'border-color:#9c7e31;',
      'opacity:1;',
      '}',

      '#' + WIDGET_ID + ' .tnr-fal-btn:active{',
      'background:linear-gradient(to bottom,#eeb933,#f5d78e);',
      'transform:translateY(1px);',
      '}',

      '@media (max-width:768px){',
      '  #' + WIDGET_ID + ' .tnr-fal-wrap{padding:18px;}',
      '  #' + WIDGET_ID + ' .tnr-fal-grid{grid-template-columns:1fr;}',
      '  #' + WIDGET_ID + ' .tnr-fal-card{min-height:auto;}',
      '}'
    ].join('');

    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = css;
    document.head.appendChild(style);
  }

  function renderCard(item) {
    var imageHtml = item.image
      ? '<img class="tnr-fal-thumb" src="' + escapeHtml(item.image) + '" alt="' + escapeHtml(item.name) + '" loading="lazy" decoding="async">'
      : '';

    return (
      '<div class="tnr-fal-card">' +
        imageHtml +
        '<div class="tnr-fal-badge">' + escapeHtml(item.label) + '</div>' +
        '<p class="tnr-fal-name">' + escapeHtml(item.name) + '</p>' +
        '<p class="tnr-fal-desc">' + escapeHtml(item.desc) + '</p>' +
        '<a class="tnr-fal-btn" href="' + escapeHtml(item.url) + '" target="_blank" rel="sponsored nofollow noopener noreferrer">Amazonで見る</a>' +
      '</div>'
    );
  }

  function render() {
    var mount = document.getElementById(WIDGET_ID);
    if (!mount) return false;
    if (mount.getAttribute(RENDERED_FLAG) === '1') return true;

    injectStyle();

    mount.innerHTML =
      '<div class="tnr-fal-wrap">' +
        '<div class="tnr-fal-head">' +
          '<p class="tnr-fal-title">この記事とあわせて見たいアイテム</p>' +
          '<p class="tnr-fal-sub">Apple製品や周辺機器、セール情報を見やすい4つの入口にまとめています。</p>' +
        '</div>' +
        '<div class="tnr-fal-grid">' +
          items.map(renderCard).join('') +
        '</div>' +
      '</div>';

    mount.setAttribute(RENDERED_FLAG, '1');
    return true;
  }

  function boot() {
    if (render()) return;

    var retryCount = 0;
    var timer = setInterval(function () {
      retryCount += 1;
      if (render() || retryCount >= 20) {
        clearInterval(timer);
      }
    }, 300);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
