#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
ロト6最新結果取得
楽天ページ優先版
"""

import requests
from bs4 import BeautifulSoup
import json
import os
import re
import sys
from datetime import datetime

DATA_DIR = "assets/data"
LATEST_FILE = os.path.join(DATA_DIR, "latest.json")
HISTORY_FILE = os.path.join(DATA_DIR, "history.json")

RAKUTEN_URL = "https://takarakuji.rakuten.co.jp/backnumber/loto6/lastresults/"

HEADERS = {
    "User-Agent": "Mozilla/5.0"
}


def parse_int(v):
    try:
        return int(str(v).replace(",", ""))
    except:
        return 0


def fetch_rakuten():
    print("🌐 楽天ページ取得")

    r = requests.get(RAKUTEN_URL, headers=HEADERS, timeout=20)
    r.raise_for_status()

    soup = BeautifulSoup(r.text, "html.parser")

    text = soup.get_text(" ", strip=True)

    # 回号
    m = re.search(r"第\s*(\d+)\s*回", text)
    if not m:
        print("❌ 回号取得失敗")
        return None

    draw_number = int(m.group(1))

    # 日付
    d = re.search(r"(\d{4})/(\d{1,2})/(\d{1,2})", text)
    draw_date = None
    if d:
        y, m2, d2 = d.groups()
        draw_date = f"{y}-{m2.zfill(2)}-{d2.zfill(2)}"

    # 数字
    nums = re.findall(r"\b([1-9]|[1-3][0-9]|4[0-3])\b", text)

    nums = [int(n) for n in nums]

    numbers = nums[:6]
    bonus = nums[6] if len(nums) > 6 else 0

    print("✅ 回号", draw_number)
    print("✅ 日付", draw_date)
    print("✅ 本数字", numbers)
    print("✅ ボーナス", bonus)

    return {
        "drawNumber": draw_number,
        "drawDate": draw_date,
        "numbers": numbers,
        "bonusNumber": bonus,
        "prizes": {
            "1": {"winners": 0, "amount": 0},
            "2": {"winners": 0, "amount": 0},
            "3": {"winners": 0, "amount": 0},
            "4": {"winners": 0, "amount": 0},
            "5": {"winners": 0, "amount": 0},
        },
        "carryOver": 0
    }


def save_data(new_data):

    os.makedirs(DATA_DIR, exist_ok=True)

    history = []

    if os.path.exists(HISTORY_FILE):
        with open(HISTORY_FILE, "r", encoding="utf-8") as f:
            try:
                history = json.load(f)
            except:
                history = []

    history = [h for h in history if h.get("drawNumber") != new_data["drawNumber"]]

    history.insert(0, new_data)

    history.sort(key=lambda x: x["drawNumber"], reverse=True)

    with open(HISTORY_FILE, "w", encoding="utf-8") as f:
        json.dump(history, f, ensure_ascii=False, indent=2)

    with open(LATEST_FILE, "w", encoding="utf-8") as f:
        json.dump(history[:1], f, ensure_ascii=False, indent=2)

    print("✅ 保存完了")


def main():

    print("🎱 ロト6取得開始")

    data = fetch_rakuten()

    if not data:
        print("❌ 取得失敗")
        sys.exit(1)

    save_data(data)

    print("✅ 完了")


if __name__ == "__main__":
    main()
