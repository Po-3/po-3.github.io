#!/usr/bin/env python3
# かなトク！公式サイトの「新着情報」を巡回し、予算/上限/終了などの告知を検出して
# このスクリプトと同じ場所の notice.json を更新する。
# GitHub Actions（サーバ側）から定期実行する想定（ブラウザのCORS制約を回避するため）。
import urllib.request, json, re, os, datetime

HERE = os.path.dirname(os.path.abspath(__file__))
URL = "https://www.kanatokucpn.pref.kanagawa.jp/index.html"
KW = ["予算", "見込み", "上限", "到達", "終了", "受付終了"]


def main():
    try:
        req = urllib.request.Request(URL, headers={"User-Agent": "Mozilla/5.0"})
        html = urllib.request.urlopen(req, timeout=30).read().decode("utf-8", "ignore")
    except Exception as e:
        print("fetch failed:", e)
        return

    # 「新着情報」見出し以降の最初の <ul>…</ul>（＝新着情報リスト）だけを対象にして誤検知を防ぐ
    i = html.find("新着情報")
    after = html[i:] if i >= 0 else ""
    m = re.search(r"<ul[\s\S]*?</ul>", after)
    seg = m.group(0) if m else after[:4000]

    hit = None
    for li in re.findall(r"<li[\s\S]*?</li>", seg):
        text = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", li)).strip()
        if any(k in text for k in KW):
            hit = text[:160]
            break

    data = {
        "active": bool(hit),
        "title": "キャンペーンに関する重要なお知らせ" if hit else "",
        "detail": hit or "",
        "date": "",
        "url": URL,
        "checkedAt": datetime.datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC"),
    }

    path = os.path.join(HERE, "notice.json")
    old = None
    try:
        with open(path, encoding="utf-8") as f:
            old = json.load(f)
    except Exception:
        pass

    # active 状態か本文が変わった時だけ書き込む（無駄なコミットを避ける）
    if (not old) or old.get("active") != data["active"] or old.get("detail") != data["detail"]:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print("notice.json updated. active=%s detail=%s" % (data["active"], data["detail"][:40]))
    else:
        print("no change. active=%s" % data["active"])


if __name__ == "__main__":
    main()
