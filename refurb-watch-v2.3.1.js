(() => {
  // === 設定 ===
  const FEED_URL = 'https://script.google.com/macros/s/AKfycbxH9abvykBsK5DJwIDDpXWV9qZ7HCf_GwUIysGqMcly-meanUR_teKLP9YaHCJua_OAwQ/exec';
  const AMAZON_TAG = 'k09cf-22'; // 空文字で非表示
  const CACHE_KEY = 'refurbCache_v2';
  const CACHE_AGE = 5*60*1000;        // 新鮮（5分）
  const STALE_MAX_AGE = 24*60*60*1000;// stale許容（24時間）
  const FETCH_TIMEOUT = 6000;         // PSI配慮で6秒
  const MAX_ATTEMPTS = 3;

  const root = document.getElementById('refurb-watch');
  const list = document.getElementById('rw-list');
  const MAX_ITEMS = +(root?.dataset.maxItems || 5);

  let fetching = false;

  const fmt = new Intl.DateTimeFormat('ja-JP', { timeZone:'Asia/Tokyo', year:'numeric', month:'2-digit', day:'2-digit' });
  const toJST = iso => { const d=new Date(iso); if(isNaN(d)) return ''; const [{value:y},,{value:m},,{value:day}]=fmt.formatToParts(d); return `${y}/${m}/${day}`; };

  const cached = readCache();
  if (cached && (Date.now() - cached.ts) < CACHE_AGE) render(cached.data);

  // 初期描画を優先：アイドル時間にfetch（fallbackあり）
  const idle = window.requestIdleCallback || (cb => setTimeout(cb, 1));
  idle(() => { if (!fetching) fetchLatest({ silent: !!cached }); });

  // ===== 関数 =====
  function readCache(){
    try { return JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null'); } catch { return null; }
  }

  function render(data){
    if (!Array.isArray(data) || data.length === 0) {
      list.replaceChildren(liText('最近の更新は見つかりませんでした。'));
      return;
    }
    const mapped = data.map(x => ({ ...x, _ts: Date.parse(x?.date || '') || 0 }));
    mapped.sort((a,b)=>b._ts - a._ts);
    const items = mapped.slice(0, MAX_ITEMS);

    const frag = document.createDocumentFragment();
    for (const item of items){
      const li = document.createElement('li');

      const a = document.createElement('a');
      a.href = item.url || 'https://www.apple.com/jp/shop/refurbished';
      a.textContent = item.title || '整備済み更新';
      a.target = '_blank';
      a.rel = 'noopener';
      li.appendChild(a);

      if (item._ts){
        const s = document.createElement('small');
        s.style.marginLeft='6px'; s.style.opacity='.7';
        s.textContent = `（${toJST(item.date)}）`;
        li.appendChild(s);
      }

      if (AMAZON_TAG){
        const q = encodeURIComponent(`${item.title || 'Apple'} 整備済み`);
        const a2 = document.createElement('a');
        a2.href = `https://www.amazon.co.jp/s?k=${q}&tag=${encodeURIComponent(AMAZON_TAG)}`;
        a2.textContent = 'Amazonで探す';
        a2.target = '_blank';
        a2.rel = 'noopener sponsored nofollow';
        a2.style.marginLeft='8px';
        li.appendChild(a2);
      }

      frag.appendChild(li);
    }
    list.replaceChildren(frag);
  }

  function liText(t){ const li=document.createElement('li'); li.textContent=t; return li; }

  async function fetchLatest({ silent=false } = {}){
    if (fetching) return; fetching = true;

    if ('onLine' in navigator && !navigator.onLine){
      if (!cached) list.replaceChildren(liText('オフラインです。前回の情報を表示します。'));
      fetching = false; return;
    }

    try {
      const data = await fetchJSONWithRetry(FEED_URL, { attempts: MAX_ATTEMPTS, timeoutMs: FETCH_TIMEOUT });
      if (!Array.isArray(data)) throw new Error('invalid payload');
      render(data);
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
    } catch (e){
      const stale = readCache();
      if (stale && (Date.now() - stale.ts) < STALE_MAX_AGE){
        if (!silent){
          const note = document.createElement('li');
          note.textContent = '最新の取得に失敗しました（前回の情報を表示中）';
          note.style.opacity='.7'; note.style.listStyle='none';
          list.appendChild(note);
        }
      } else {
        list.replaceChildren(liText('フィードの取得に失敗しました。しばらくして再度お試しください。'));
      }
    } finally { fetching = false; }
  }

  async function fetchJSONWithRetry(url, { attempts=3, timeoutMs=6000 }={}){
    let lastErr;
    for (let i=0; i<attempts; i++){
      const ctrl = new AbortController();
      const timer = setTimeout(()=>ctrl.abort(), timeoutMs);
      try {
        const res = await fetch(url, { cache:'no-store', mode:'cors', signal: ctrl.signal });
        clearTimeout(timer);
        if (!res.ok) throw new Error(`http ${res.status}`);
        return await res.json();
      } catch (err){
        clearTimeout(timer);
        lastErr = err;
        const retriable = (err.name === 'AbortError') || /http (429|5..)/.test(String(err.message));
        if (i < attempts-1 && retriable){
          const base = 400 * Math.pow(2, i);
          const jitter = base * (0.5 + Math.random());
          await new Promise(r => setTimeout(r, jitter));
          continue;
        }
        break;
      }
    }
    throw lastErr || new Error('fetch failed');
  }
})();