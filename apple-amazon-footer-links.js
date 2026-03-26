<div id="tnr-fixed-amazon-links"></div>

<style>
  .tnr-fal-wrap{
    margin:32px 0;
    padding:20px;
    border:1px solid #e5e7eb;
    border-radius:16px;
    background:#fff;
  }
  .tnr-fal-head{
    margin-bottom:16px;
  }
  .tnr-fal-title{
    margin:0 0 6px;
    font-size:1.04em;
    font-weight:700;
    line-height:1.6;
    color:#111827;
  }
  .tnr-fal-sub{
    margin:0;
    font-size:.92em;
    line-height:1.8;
    color:#6b7280;
  }
  .tnr-fal-grid{
    display:grid;
    grid-template-columns:repeat(3,minmax(0,1fr));
    gap:14px;
  }
  .tnr-fal-card{
    display:flex;
    flex-direction:column;
    min-height:220px;
    padding:14px;
    border:1px solid #e5e7eb;
    border-radius:14px;
    background:#fafafa;
  }
  .tnr-fal-badge{
    display:inline-block;
    align-self:flex-start;
    margin-bottom:10px;
    padding:6px 10px;
    border-radius:999px;
    background:#eff6ff;
    color:#2563eb;
    font-size:.78em;
    font-weight:700;
    line-height:1.2;
  }
  .tnr-fal-name{
    margin:0 0 10px;
    font-size:1em;
    font-weight:700;
    line-height:1.6;
    color:#111827;
  }
  .tnr-fal-desc{
    margin:0 0 14px;
    font-size:.92em;
    line-height:1.8;
    color:#4b5563;
    flex:1;
  }
  .tnr-fal-btn{
    display:inline-block;
    text-decoration:none;
    text-align:center;
    padding:12px 14px;
    border-radius:10px;
    background:#111827;
    color:#fff !important;
    font-size:.92em;
    font-weight:700;
    line-height:1.2;
  }
  .tnr-fal-btn:hover{
    opacity:.92;
  }
  @media (max-width:768px){
    .tnr-fal-grid{
      grid-template-columns:1fr;
    }
  }
</style>

<script>
(function(){
  var mount = document.getElementById('tnr-fixed-amazon-links');
  if (!mount) return;

  var items = [
    {
      label: 'おすすめ商品',
      name: 'Appleストアを見る',
      desc: 'Apple製品全体をまとめて見たいときの入口として使いやすいリンクです。',
      url: 'https://www.amazon.co.jp/stores/page/E2802B6E-C80B-49EB-8240-1032DA9DC503?ingress=2&lp_context_asin=B0FQG9JJ2G&lp_context_query=apple&visitId=fbc46802-1f4a-4cf0-880a-391fc54329d4&linkCode=ll2&tag=k09cf-22&linkId=02715097e39cd51d55d915871388e047&ref_=as_li_ss_tl'
    },
    {
      label: '売れやすい周辺機器',
      name: 'Apple製品と相性のよい周辺機器',
      desc: '本体記事のあとに置きやすく、ついで買いにもつながりやすい導線です。',
      url: 'https://www.amazon.co.jp/stores/page/F4AAC411-D8F4-43D4-92BC-FCF95AEE7914?ingress=2&lp_context_asin=B0FQG9JJ2G&lp_context_query=apple&visitId=fbc46802-1f4a-4cf0-880a-391fc54329d4&linkCode=ll2&tag=k09cf-22&linkId=cb260fa883e9d0826cfd32e7fe3c7993&ref_=as_li_ss_tl'
    },
    {
      label: '価格を抑えたい方向け',
      name: 'Apple新着商品',
      desc: '新しく追加された製品をざっと見たいときの入口として置きやすい枠です。',
      url: 'https://www.amazon.co.jp/stores/page/4E2B3D23-7AFF-410E-A05F-A11A86063BFC?ingress=2&lp_context_asin=B0FQG9JJ2G&lp_context_query=apple&visitId=fbc46802-1f4a-4cf0-880a-391fc54329d4&linkCode=ll2&tag=k09cf-22&linkId=48769df92b9410c4402442371c7f2a0f&ref_=as_li_ss_tl'
    }
  ];

  function renderCard(item){
    return ''
      + '<div class="tnr-fal-card">'
      +   '<div class="tnr-fal-badge">' + item.label + '</div>'
      +   '<p class="tnr-fal-name">' + item.name + '</p>'
      +   '<p class="tnr-fal-desc">' + item.desc + '</p>'
      +   '<a class="tnr-fal-btn" href="' + item.url + '" target="_blank" rel="sponsored nofollow noopener noreferrer">Amazonで見る</a>'
      + '</div>';
  }

  mount.innerHTML = ''
    + '<div class="tnr-fal-wrap">'
    +   '<div class="tnr-fal-head">'
    +     '<p class="tnr-fal-title">この記事とあわせて見たいアイテム</p>'
    +     '<p class="tnr-fal-sub">記事の内容に関わらず、Apple製品や周辺機器を見やすい3つの入口をまとめています。</p>'
    +   '</div>'
    +   '<div class="tnr-fal-grid">'
    +     items.map(renderCard).join('')
    +   '</div>'
    + '</div>';
})();
</script>
