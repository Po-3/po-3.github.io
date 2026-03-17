#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
ロト6最新結果取得スクリプト（楽天テーブル版）
https://takarakuji.rakuten.co.jp/backnumber/loto6/
から最新回を取得して JSON を更新する
"""

import json
import os
import re
import sys
import time

import requests
from bs4 import BeautifulSoup

DATA_DIR = "assets/data"
LATEST_FILE = os.path.join(DATA_DIR, "latest.json")
HISTORY_FILE = os.path.join(DATA_DIR, "history.json")

RAKUTEN_URL = "https://takarakuji.rakuten.co.jp/backnumber/loto6/"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "ja,en-US;q=0.9",
    "Referer": "https://www.google.com/",
    "Connection": "keep-alive",
}


def parse_int(text, default=0):
    if text is None:
        return default
    try:
        return int(str(text).replace(",", "").strip())
    except (TypeError, ValueError):
        return default


def normalize_text(text):
    if text is None:
        return ""
    return re.sub(r"\s+", " ", str(text)).replace("\u3000", " ").strip()


def fetch_soup():
    print("🌐 楽天ロト6ページにアクセス中...")
    time.sleep(2)

    response = requests.get(RAKUTEN_URL, headers=HEADERS, timeout=30)
    response.raise_for_status()
    response.encoding = response.apparent_encoding or "utf-8"

    print(f"✅ アクセス成功: {response.url} ({len(response.text)} bytes)")
    return BeautifulSoup(response.text, "html.parser")


def extract_latest_data_from_tables(soup):
    """
    楽天の各回テーブルから最新回を抽出する
    画面の表構造に合わせて tr/th/td をそのまま読む
    """
    tables = soup.find_all("table")
    if not tables:
        print("❌ table が見つかりません")
        return None

    best = None

    for table in tables:
        rows = table.find_all("tr")
        if not rows:
            continue

        record = {
            "drawNumber": None,
            "drawDate": None,
            "numbers": [],
            "bonusNumber": 0,
            "prizes": {
                "1": {"winners": 0, "amount": 0},
                "2": {"winners": 0, "amount": 0},
                "3": {"winners": 0, "amount": 0},
                "4": {"winners": 0, "amount": 0},
                "5": {"winners": 0, "amount": 0},
            },
            "carryOver": 0,
        }

        for row in rows:
            cells = row.find_all(["th", "td"])
            if len(cells) < 2:
                continue

            label = normalize_text(cells[0].get_text(" ", strip=True))
            tail_cells = cells[1:]
            tail_text = normalize_text(" ".join(c.get_text(" ", strip=True) for c in tail_cells))

            # 回号
            if "回号" in label:
                m = re.search(r"第\s*(\d+)\s*回", tail_text)
                if m:
                    record["drawNumber"] = int(m.group(1))

            # 抽せん日
            elif "抽せん日" in label:
                m = re.search(r"(\d{4})/(\d{1,2})/(\d{1,2})", tail_text)
                if not m:
                    m = re.search(r"(\d{4})年(\d{1,2})月(\d{1,2})日", tail_text)
                if m:
                    y, mo, d = m.groups()
                    record["drawDate"] = f"{y}-{mo.zfill(2)}-{d.zfill(2)}"

            # 本数字（セル順そのままで取る）
            elif "本数字" in label:
                nums = []
                for cell in tail_cells:
                    t = normalize_text(cell.get_text(" ", strip=True))
                    if re.fullmatch(r"\d{1,2}", t):
                        n = int(t)
                        if 1 <= n <= 43:
                            nums.append(n)
                record["numbers"] = nums[:6]

            # ボーナス数字
            elif "ボーナス数字" in label:
                m = re.search(r"(\d{1,2})", tail_text)
                if m:
                    record["bonusNumber"] = int(m.group(1))

            # 1〜5等
            elif re.fullmatch(r"[1-5]等", label):
                rank = label.replace("等", "")
                winners_match = re.search(r"([\d,]+)\s*口", tail_text)
                amount_match = re.search(r"([\d,]+)\s*円", tail_text)
                record["prizes"][rank] = {
                    "winners": parse_int(winners_match.group(1)) if winners_match else 0,
                    "amount": parse_int(amount_match.group(1)) if amount_match else 0,
                }

            # キャリーオーバー
            elif "キャリーオーバー" in label:
                amount_match = re.search(r"([\d,]+)\s*円", tail_text)
                if amount_match:
                    record["carryOver"] = parse_int(amount_match.group(1))

        if record["drawNumber"] and record["drawDate"] and len(record["numbers"]) == 6:
            if best is None or record["drawNumber"] > best["drawNumber"]:
                best = record

    if not best:
        print("❌ 有効な回データを抽出できませんでした")
        return None

    print(f"✅ 最新回抽出成功: 第{best['drawNumber']}回")
    print(f"✅ 抽せん日: {best['drawDate']}")
    print(f"✅ 本数字: {best['numbers']}")
    print(f"✅ ボーナス数字: {best['bonusNumber']}")
    print(f"✅ 1等: {best['prizes']['1']['winners']}口 / {best['prizes']['1']['amount']:,}円")
    print(f"✅ キャリーオーバー: {best['carryOver']:,}円")

    return best


def load_history():
    if not os.path.exists(HISTORY_FILE):
        return []

    try:
        with open(HISTORY_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            if isinstance(data, list):
                return [x for x in data if isinstance(x, dict) and x.get("drawNumber")]
            return []
    except Exception as e:
        print(f"⚠️ history.json 読み込み失敗: {e}")
        return []


def save_data(new_data):
    try:
        os.makedirs(DATA_DIR, exist_ok=True)

        history = load_history()
        history = [h for h in history if h.get("drawNumber") != new_data["drawNumber"]]
        history.insert(0, new_data)
        history.sort(key=lambda x: x.get("drawNumber", 0), reverse=True)

        with open(HISTORY_FILE, "w", encoding="utf-8") as f:
            json.dump(history, f, ensure_ascii=False, indent=2)

        with open(LATEST_FILE, "w", encoding="utf-8") as f:
            json.dump(history[:1], f, ensure_ascii=False, indent=2)

        print("✅ 保存完了")
        return True

    except Exception as e:
        print(f"❌ 保存エラー: {e}")
        return False


def main():
    print("🎱 ロト6取得開始（楽天テーブル版）")
    print(f"📁 保存先: {DATA_DIR}")

    try:
        soup = fetch_soup()
        data = extract_latest_data_from_tables(soup)

        if data:
            print("🧾 取得データ確認:")
            print(json.dumps(data, ensure_ascii=False, indent=2))

        if data and save_data(data):
            print("✅ 処理完了")
            sys.exit(0)

        sys.exit(1)

    except Exception as e:
        print(f"❌ 全体エラー: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
