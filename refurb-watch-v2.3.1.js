(() => {
  // === 設定項目 ===
  const FEED_URL = 'https://script.google.com/macros/s/AKfycbxH9abvykBsK5DJwIDDpXWV9qZ7HCf_GwUIysGqMcly-meanUR_teKLP9YaHCJua_OAwQ/exec';
  const AMAZON_TAG = 'k09cf-22'; // アソシエイトタグ
  const CACHE_KEY = 'refurbCache_v2';
  const CACHE_AGE = 5 * 60 * 1000;         // キャッシュの鮮度（5分）
  const STALE_MAX_AGE = 24 * 60 * 60 * 1000; // 許容する古さ（24時間）
  const FETCH_TIMEOUT = 6000;              // タイムアウト（6秒）
  const MAX_ATTEMPTS = 3;                  // 最大リトライ回数

  const root = document.getElementById('refurb-watch');
  const list = document.getElementById('rw-list');
  const MAX_ITEMS = +(root?.dataset.maxItems || 5);

  let fetching = false;

  // 日付フォーマット設定 (JST)
  const fmt = new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' });
  const toJST = iso => {
    const d = new Date(iso);
    if (isNaN(d)) return '';
    const [{ value: y }, , { value: m }, , { value: day }] = fmt.formatToParts(d);
    return `${y}/${m}/${day}`;
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

    // 日付順にソートして最大件数で切り出し
    const items = data
      .map(x => ({ ...x, _ts: Date.parse(x?.date || '') || 0 }))
      .sort((a, b) => b._ts - a._ts)
      .slice(0, MAX_ITEMS);

    const frag = document.createDocumentFragment();

    items.forEach(item => {
      const li = document.createElement('li');
      li.className = 'rw-item';

      // 1. 商品名エリア（Apple公式リンク）
      const aName = document.createElement('a');
      aName.className = 'rw-name';
      aName.href = item.url || 'https://www.apple.com/jp/shop/refurbished';
      aName.target = '_blank';
      aName.rel = 'noopener';

      const dateStr = item._ts ? `<small class="rw-date">（${toJST(item.date)}）</small>` : '';
      aName.innerHTML = `${item.title || '整備済み更新'} ${dateStr}`;
      li.appendChild(aName);

      // 2. Amazonで探すボタンの追加
      if (AMAZON_TAG) {
        const query = encodeURIComponent(`${item.title || 'Apple'} 整備済み`);
        const aAmz = document.createElement('a');
        aAmz.className = 'rw-amazon-btn';
        aAmz.href = `https://www.amazon.co.jp/s?k=${query}&tag=${encodeURIComponent(AMAZON_TAG)}`;
        aAmz.textContent = 'Amazonで探す';
        aAmz.target = '_blank';
        aAmz.rel = 'noopener sponsored nofollow';
        li.appendChild(aAmz);
      }

      frag.appendChild(li);
    });

    list.replaceChildren(frag);
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
    if (fetching) return;
    fetching = true;

    // オフライン時は何もしない
    if ('onLine' in navigator && !navigator.onLine) {
      fetching = false;
      return;
    }

    try {
      const data = await fetchJSONWithRetry(FEED_URL, { attempts: MAX_ATTEMPTS, timeoutMs: FETCH_TIMEOUT });
      if (!Array.isArray(data)) throw new Error('Invalid payload');

      render(data);
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
    } catch (e) {
      console.warn('RefurbWatch fetch failed:', e);
      const stale = readCache();
      // キャッシュが全くない、または非常に古い場合のみエラー表示
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
  async function fetchJSONWithRetry(url, { attempts = 3, timeoutMs = 6000 } = {}) {
    let lastErr;
    for (let i = 0; i < attempts; i++) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);

      try {
        const res = await fetch(url, { cache: 'no-store', mode: 'cors', signal: ctrl.signal });
        clearTimeout(timer);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
      } catch (err) {
        clearTimeout(timer);
        lastErr = err;
        // 指数バックオフで待機してリトライ
        if (i < attempts - 1) {
          await new Promise(r => setTimeout(r, 400 * Math.pow(2, i)));
        }
      }
    }
    throw lastErr;
  }

  // === 実行フロー ===
  const cached = readCache();
  
  // 1. キャッシュがあれば即座に表示（表示速度優先）
  if (cached && (Date.now() - cached.ts) < CACHE_AGE) {
    render(cached.data);
  }

  // 2. アイドル時にバックグラウンドで最新情報を取得
  const idle = window.requestIdleCallback || (cb => setTimeout(cb, 1));
  idle(() => {
    fetchLatest({ silent: !!cached });
  });

})();
