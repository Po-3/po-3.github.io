(() => {
  'use strict';

  // === 設定 ===
  const FEED_URL = 'https://script.google.com/macros/s/AKfycbxH9abvykBsK5DJwIDDpXWV9qZ7HCf_GwUIysGqMcly-meanUR_teKLP9YaHCJua_OAwQ/exec';
  const AMAZON_TAG = 'k09cf-22';
  const CACHE_KEY  = 'refurbCache_v2';
  const HEIGHT_KEY = 'rw_last_height';
  const CACHE_AGE     = 5 * 60 * 1000;        // この鮮度内なら通信せずキャッシュのみ表示
  const STALE_MAX_AGE = 24 * 60 * 60 * 1000;  // これより古いキャッシュは使わない
  const FETCH_TIMEOUT = 6000;
  const MAX_ATTEMPTS  = 3;

  const root = document.getElementById('refurb-watch');
  const list = document.getElementById('rw-list');
  if (!root || !list) return;                 // ウィジェットが無いページでは即終了

  const MAX_ITEMS = +(root.dataset.maxItems || 5);
  let fetching = false;

  // localStorage/sessionStorage は Safari プライベート等で例外を投げるので必ず try で包む
  const sGet = (s, k) => { try { return s.getItem(k); } catch { return null; } };
  const sSet = (s, k, v) => { try { s.setItem(k, v); } catch {} };

  // CLS対策: 前回の高さを先に確保
  const lastH = sGet(localStorage, HEIGHT_KEY);
  if (lastH) list.style.minHeight = lastH;

  const toJST = iso => {
    const d = new Date(iso);
    if (isNaN(d)) return '';
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
  };
  const safeUrl = (u, fb) => (typeof u === 'string' && /^https?:\/\//i.test(u)) ? u : fb;
  const readCache = () => { try { return JSON.parse(sGet(sessionStorage, CACHE_KEY) || 'null'); } catch { return null; } };

  function liText(t) {
    const li = document.createElement('li');
    li.textContent = t;
    li.style.listStyle = 'none';
    return li;
  }

  function render(data) {
    list.removeAttribute('aria-busy');
    if (!Array.isArray(data) || data.length === 0) {
      list.replaceChildren(liText('最近の更新は見つかりませんでした。'));
      return;
    }

    const items = data
      .map(x => ({ x, ts: Date.parse(x?.date || '') || 0 }))
      .sort((a, b) => b.ts - a.ts)
      .slice(0, MAX_ITEMS);

    const frag = document.createDocumentFragment();
    for (const { x, ts } of items) {
      const li = document.createElement('li');
      li.className = 'rw-item';

      const aName = document.createElement('a');
      aName.className = 'rw-name';
      aName.href = safeUrl(x.url, 'https://www.apple.com/jp/shop/refurbished');
      aName.target = '_blank';
      aName.rel = 'noopener';
      aName.textContent = x.title || '整備済み製品';

      if (ts) {
        const sm = document.createElement('small');
        sm.className = 'rw-date';
        sm.textContent = ` (${toJST(x.date)})`;
        aName.appendChild(sm);
      }
      li.appendChild(aName);

      if (AMAZON_TAG) {
        const aAmz = document.createElement('a');
        aAmz.className = 'rw-amazon-btn';
        aAmz.href = `https://www.amazon.co.jp/s?k=${encodeURIComponent(`${x.title || 'Apple'} 整備済み`)}&tag=${AMAZON_TAG}`;
        aAmz.textContent = 'Amazonで探す';
        aAmz.target = '_blank';
        aAmz.rel = 'noopener sponsored nofollow';
        li.appendChild(aAmz);
      }
      frag.appendChild(li);
    }

    list.replaceChildren(frag);

    requestAnimationFrame(() => {
      const h = list.offsetHeight;
      if (h > 100) sSet(localStorage, HEIGHT_KEY, h + 'px');
    });
  }

  async function fetchJSON(url) {
    let lastErr;
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT);
      try {
        const res = await fetch(url, { cache: 'no-store', mode: 'cors', signal: ctrl.signal });
        if (!res.ok) throw new Error(res.status);
        return await res.json();
      } catch (err) {
        lastErr = err;
        if (i < MAX_ATTEMPTS - 1) await new Promise(r => setTimeout(r, 400 * (1 << i)));
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastErr;
  }

  // HTML側で先行fetch（window.__rwEarly）していれば再利用、無ければ自前で取得
  async function getData() {
    const early = window.__rwEarly;
    if (early) {
      window.__rwEarly = null;
      const d = await early.catch(() => null);
      if (Array.isArray(d)) return d;
    }
    return fetchJSON(FEED_URL);
  }

  async function fetchLatest(silent) {
    if (fetching || navigator.onLine === false) return;
    fetching = true;
    list.setAttribute('aria-busy', 'true');
    try {
      const data = await getData();
      if (!Array.isArray(data)) throw new Error('bad payload');
      render(data);
      sSet(sessionStorage, CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
    } catch {
      if (!silent) {
        const stale = readCache();
        if (stale && Array.isArray(stale.data) && Date.now() - stale.ts < STALE_MAX_AGE) {
          render(stale.data);
        } else {
          list.replaceChildren(liText('情報の取得に失敗しました。'));
        }
      }
    } finally {
      fetching = false;
      list.removeAttribute('aria-busy');
    }
  }

  // === 実行（stale-while-revalidate）===
  const cached = readCache();
  const age = cached ? Date.now() - cached.ts : Infinity;
  const usable = cached && Array.isArray(cached.data) && age < STALE_MAX_AGE;

  if (usable) render(cached.data);

  if (age >= CACHE_AGE) {                      // ← 常に最新を取りたい場合は、この if を外す
    const idle = window.requestIdleCallback || (cb => setTimeout(cb, 1));
    idle(() => fetchLatest(usable), { timeout: 2000 });
  }
})();
