#!/usr/bin/env python3
# かなトク！公式サイトの「新着情報」を巡回し、最新の項目（日付＋見出し）を notice.json に保存する。
# 予算/上限/終了 などの語を含む場合は alert=true（アプリ側で強調表示）。
# GitHub Actions（サーバ側）から定期実行する想定（ブラウザのCORS制約を回避するため）。
import urllib.request, json, re, os, datetime

HERE = os.path.dirname(os.path.abspath(__file__))
URL = "https://www.kanatokucpn.pref.kanagawa.jp/index.html"
KW = ["予算", "見込み", "上限", "到達", "終了", "受付終了"]


def parse_news(html):
    """ページ内の <li> のうち、先頭が日付(YYYY/MM/DD)の項目＝新着情報を最大3件抽出。
    日付の無いナビメニュー等は自動的に除外される。"""
    items = []
    for li in re.findall(r"<li[\s\S]*?</li>", html):
        text = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", li)).strip()
        dm = re.match(r"(\d{4}[.\/]\d{1,2}[.\/]\d{1,2})\s*(.+)", text)
        if dm:
            title = dm.group(2).strip()
            title = re.sub(r"([「『（])\s+", r"\1", title)   # 括弧内の余分な空白を除去
            title = re.sub(r"\s+([」』）])", r"\1", title)
            items.append({"date": dm.group(1).replace(".", "/"), "title": title})
            if len(items) >= 3:
                break
    return items


def main():
    try:
        req = urllib.request.Request(URL, headers={"User-Agent": "Mozilla/5.0"})
        html = urllib.request.urlopen(req, timeout=30).read().decode("utf-8", "ignore")
    except Exception as e:
        print("fetch failed:", e)
        return

    news = parse_news(html)
    alert = any(k in (n["title"] or "") for n in news for k in KW)
    data = {
        "news": news,
        "alert": alert,
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

    # 新着情報の内容（news）が変わった時だけ書き込む（無駄なコミットを避ける）
    if (not old) or old.get("news") != data["news"] or old.get("alert") != data["alert"]:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print("notice.json updated. alert=%s items=%d" % (alert, len(news)))
    else:
        print("no change. items=%d" % len(news))


if __name__ == "__main__":
    main()
