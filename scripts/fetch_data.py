#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
ロト6最新結果取得スクリプト（楽天版）
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


def fetch_html():
    print("🌐 楽天ロト6ページにアクセス中...")
    time.sleep(2)

    response = requests.get(RAKUTEN_URL, headers=HEADERS, timeout=30)
    response.raise_for_status()
    response.encoding = response.apparent_encoding or "utf-8"

    print(f"✅ アクセス成功: {response.url} ({len(response.text)} bytes)")
    return response.text


def extract_latest_block(text):
    """
    楽天ページ本文から最新回ブロックを切り出す。
    例:
      回号 第2085回
      抽せん日 2026/03/16
      本数字 ...
      ...
      キャリーオーバー ...
    """
    normalized = normalize_text(text)

    all_draws = [int(x) for x in re.findall(r"回号\s*第(\d+)回", normalized)]
    if not all_draws:
        print("❌ 回号が見つかりません")
        return None, None

    latest_draw = max(all_draws)
    print(f"✅ 最新回候補: 第{latest_draw}回")

    start_marker = f"回号 第{latest_draw}回"
    start = normalized.find(start_marker)
    if start == -1:
        print("❌ 最新回ブロック開始位置が見つかりません")
        return None, None

    # 次の「回号 第xxxx回」までを1ブロックとして扱う
    next_match = re.search(r"回号\s*第\d+回", normalized[start + len(start_marker):])
    if next_match:
        end = start + len(start_marker) + next_match.start()
        block = normalized[start:end]
    else:
        block = normalized[start:]

    print(f"✅ 最新回ブロック抽出成功: 第{latest_draw}回")
    return latest_draw, block


def extract_numbers_in_order(block):
    """
    本数字の行だけから、順番を維持して6個取得
    """
    m = re.search(
        r"本数字\s*([0-9０-９\s]+?)\s*ボーナス数字",
        block
    )
    if not m:
        # フォールバック
        m = re.search(r"本数字\s*([0-9０-９\s]+)", block)

    if not m:
        return []

    part = m.group(1)
    nums = [parse_int(x) for x in re.findall(r"\d{1,2}", part)]
    nums = [x for x in nums if 1 <= x <= 43]
    return nums[:6]


def extract_bonus(block):
    m = re.search(r"ボーナス数字\s*\(?\s*(\d{1,2})\s*\)?", block)
    if not m:
        return 0
    return parse_int(m.group(1))


def extract_date(block):
    m = re.search(r"抽せん日\s*(\d{4})/(\d{1,2})/(\d{1,2})", block)
    if not m:
        return None
    y, mth, d = m.groups()
    return f"{y}-{mth.zfill(2)}-{d.zfill(2)}"


def extract_prizes(block):
    prizes = {
        "1": {"winners": 0, "amount": 0},
        "2": {"winners": 0, "amount": 0},
        "3": {"winners": 0, "amount": 0},
        "4": {"winners": 0, "amount": 0},
        "5": {"winners": 0, "amount": 0},
    }

    for rank in range(1, 6):
        pattern = rf"{rank}等\s*([\d,]+)口\s*([\d,]+)円"
        m = re.search(pattern, block)
        if m:
            prizes[str(rank)] = {
                "winners": parse_int(m.group(1)),
                "amount": parse_int(m.group(2)),
            }

    return prizes


def extract_carry_over(block):
    m = re.search(r"キャリーオーバー\s*([\d,]+)円", block)
    if not m:
        return 0
    return parse_int(m.group(1))


def extract_latest_data(html_text):
    draw_number, block = extract_latest_block(html_text)
    if not block:
        return None

    draw_date = extract_date(block)
    numbers = extract_numbers_in_order(block)
    bonus_number = extract_bonus(block)
    prizes = extract_prizes(block)
    carry_over = extract_carry_over(block)

    print(f"✅ 抽せん日: {draw_date}")
    print(f"✅ 本数字: {numbers}")
    print(f"✅ ボーナス数字: {bonus_number}")
    print(f"✅ 1等: {prizes['1']['winners']}口 / {prizes['1']['amount']:,}円")
    print(f"✅ キャリーオーバー: {carry_over:,}円")

    if not draw_number or not draw_date or len(numbers) != 6:
        print("❌ 抽出データが不足しています")
        return None

    return {
        "drawNumber": draw_number,
        "drawDate": draw_date,
        "numbers": numbers,
        "bonusNumber": bonus_number,
        "prizes": prizes,
        "carryOver": carry_over,
    }


def load_history():
    if not os.path.exists(HISTORY_FILE):
        return []

    try:
        with open(HISTORY_FILE, "r", encoding="utf-8") as f:
            loaded = json.load(f)
            if isinstance(loaded, list):
                return [x for x in loaded if isinstance(x, dict) and x.get("drawNumber")]
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
    print("🎱 ロト6取得開始（楽天版）")
    print(f"📁 保存先: {DATA_DIR}")

    try:
        html_text = fetch_html()
        data = extract_latest_data(html_text)

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
