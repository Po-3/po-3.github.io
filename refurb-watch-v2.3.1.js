(() => {
  // === 設定項目 ===
  const FEED_URL = 'https://script.google.com/macros/s/AKfycbxH9abvykBsK5DJwIDDpXWV9qZ7HCf_GwUIysGqMcly-meanUR_teKLP9YaHCJua_OAwQ/exec';
  const AMAZON_TAG = 'k09cf-22';
  const CACHE_KEY = 'refurbCache_v2';
  const HEIGHT_KEY = 'rw_last_height'; // CLS対策：前回の高さを記憶
  const CACHE_AGE = 5 * 60 * 1000;
  const STALE_MAX_AGE = 24 * 60 * 60 * 1000;
  const FETCH_TIMEOUT = 6000;
  const MAX_ATTEMPTS = 3;

  const root = document.getElementById('refurb-watch');
  const list = document.getElementById('rw-list');
  const MAX_ITEMS = +(root?.dataset.maxItems || 5);

  let fetching = false;

  // --- CLS対策: 実行前に前回の高さを復元 ---
  const lastHeight = localStorage.getItem(HEIGHT_KEY);
  if (lastHeight && list) {
    list.style.minHeight = lastHeight;
  }

  // 軽量化: Intlを使わずシンプルにフォーマット
  const toJST = iso => {
    const d = new Date(iso);
    if (isNaN(d)) return '';
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
  };

  const readCache = () => {
    try { return JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null'); } catch { return null; }
  };

  /**
   * DOMレンダリング関数
   */
  function render(data) {
    if (!list) return;
    if (!Array.isArray(data) || data.length === 0) {
      list.replaceChildren(liText('最近の更新は見つかりませんでした。'));
      return;
    }

    const items = data
      .map(x => ({ ...x, _ts: Date.parse(x?.date || '') || 0 }))
      .sort((a, b) => b._ts - a._ts)
      .slice(0, MAX_ITEMS);

    const frag = document.createDocumentFragment();

    items.forEach(item => {
      const li = document.createElement('li');
      li.className = 'rw-item';

      // 1. 商品名エリア（textContentで安全・高速に）
      const aName = document.createElement('a');
      aName.className = 'rw-name';
      aName.href = item.url || 'https://www.apple.com/jp/shop/refurbished';
      aName.target = '_blank';
      aName.rel = 'noopener';
      aName.textContent = (item.title || '整備済み製品');

      if (item._ts) {
        const sm = document.createElement('small');
        sm.className = 'rw-date';
        sm.textContent = ` (${toJST(item.date)})`;
        aName.appendChild(sm);
      }
      li.appendChild(aName);

      // 2. Amazonボタン
      if (AMAZON_TAG) {
        const aAmz = document.createElement('a');
        aAmz.className = 'rw-amazon-btn';
        const query = encodeURIComponent(`${item.title || 'Apple'} 整備済み`);
        aAmz.href = `https://www.amazon.co.jp/s?k=${query}&tag=${AMAZON_TAG}`;
        aAmz.textContent = 'Amazonで探す';
        aAmz.target = '_blank';
        aAmz.rel = 'noopener sponsored nofollow';
        li.appendChild(aAmz);
      }
      frag.appendChild(li);
    });

    list.replaceChildren(frag);

    // --- CLS対策: 描画後の高さを次回のために保存 ---
    requestAnimationFrame(() => {
      const h = list.offsetHeight;
      if (h > 100) { // 異常値を除いて保存
        localStorage.setItem(HEIGHT_KEY, h + 'px');
      }
    });
  }

  function liText(t) {
    const li = document.createElement('li');
    li.textContent = t;
    li.style.listStyle = 'none';
    return li;
  }

  /**
   * 最新データの取得
   */
  async function fetchLatest({ silent = false } = {}) {
    if (fetching || ('onLine' in navigator && !navigator.onLine)) return;
    fetching = true;

    try {
      const data = await fetchJSONWithRetry(FEED_URL, { attempts: MAX_ATTEMPTS, timeoutMs: FETCH_TIMEOUT });
      if (!Array.isArray(data)) throw new Error();

      render(data);
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
    } catch (e) {
      const stale = readCache();
      if (!silent && (!stale || (Date.now() - stale.ts) > STALE_MAX_AGE)) {
        list.replaceChildren(liText('情報の取得に失敗しました。'));
      }
    } finally {
      fetching = false;
    }
  }

  /**
   * タイムアウト・リトライ付きfetch
   */
  async function fetchJSONWithRetry(url, { attempts, timeoutMs }) {
    let lastErr;
    for (let i = 0; i < attempts; i++) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);
      try {
        const res = await fetch(url, { cache: 'no-store', mode: 'cors', signal: ctrl.signal });
        clearTimeout(timer);
        if (!res.ok) throw new Error(res.status);
        return await res.json();
      } catch (err) {
        clearTimeout(timer);
        lastErr = err;
        if (i < attempts - 1) await new Promise(r => setTimeout(r, 400 * Math.pow(2, i)));
      }
    }
    throw lastErr;
  }

  // === 実行フロー ===
  const cached = readCache();
  
  // 1. キャッシュがあれば即座に表示（CLS抑制と体感速度向上）
  if (cached && (Date.now() - cached.ts) < CACHE_AGE) {
    render(cached.data);
  }

  // 2. アイドル時に最新情報を取得
  const idle = window.requestIdleCallback || (cb => setTimeout(cb, 1));
  idle(() => fetchLatest({ silent: !!cached }));

})();
