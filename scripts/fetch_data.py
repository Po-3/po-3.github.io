#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ロト6実データ取得スクリプト（check系ページ優先版）
最新回のデータのみを正確に取得
"""

import requests
from bs4 import BeautifulSoup
import json
import re
import os
import time
import sys

DATA_DIR = "assets/data"
LATEST_FILE = os.path.join(DATA_DIR, "latest.json")
HISTORY_FILE = os.path.join(DATA_DIR, "history.json")
MIZUHO_CHECK_URL = "https://www.mizuhobank.co.jp/takarakuji/check/loto/loto6/index.html"


def parse_int(text, default=0):
    """数値文字列を int に変換"""
    if text is None:
        return default
    try:
        return int(str(text).replace(',', '').strip())
    except (TypeError, ValueError):
        return default


def normalize_text(text):
    """空白・全角空白を吸収した比較用テキスト"""
    if text is None:
        return ""
    return re.sub(r"\s+", " ", str(text)).replace("\u3000", " ").strip()


def extract_numbers(text):
    """1-43 の数字だけを順序維持で抽出"""
    found = []
    for m in re.findall(r"(?<!\d)(\d{1,2})(?!\d)", normalize_text(text)):
        num = int(m)
        if 1 <= num <= 43 and num not in found:
            found.append(num)
    return found


def extract_prize_data(compact_text):
    """ページ本文から等級別の口数・金額を抽出"""
    prizes = {
        "1": {"winners": 0, "amount": 0},
        "2": {"winners": 0, "amount": 0},
        "3": {"winners": 0, "amount": 0},
        "4": {"winners": 0, "amount": 0},
        "5": {"winners": 0, "amount": 0},
    }

    normalized = normalize_text(compact_text).replace("当せん", "当選")

    for rank in range(1, 6):
        patterns = [
            rf"{rank}等[^\d]{{0,20}}([\d,]+)\s*口[^\d]{{0,20}}([\d,]+)\s*円",
            rf"{rank}等[\s\S]{{0,40}}?([\d,]+)\s*口[\s\S]{{0,40}}?([\d,]+)\s*円",
        ]

        for pattern in patterns:
            match = re.search(pattern, normalized)
            if match:
                prizes[str(rank)] = {
                    "winners": parse_int(match.group(1)),
                    "amount": parse_int(match.group(2)),
                }
                break

        if prizes[str(rank)]["winners"] == 0 and prizes[str(rank)]["amount"] == 0:
            no_win_match = re.search(
                rf"{rank}等[\s\S]{{0,40}}?(該当なし|0\s*口)",
                normalized,
            )
            if no_win_match:
                prizes[str(rank)] = {"winners": 0, "amount": 0}

    return prizes


def safe_request():
    """HTTPリクエスト（check系URLを取得）"""
    print("🌐 みずほ銀行公式サイトアクセス中...")

    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        ),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "ja,en-US;q=0.9",
        "Referer": "https://www.google.com/",
        "Connection": "keep-alive",
    }

    time.sleep(3)

    try:
        response = requests.get(MIZUHO_CHECK_URL, headers=headers, timeout=30)
        response.raise_for_status()
        response.encoding = "utf-8"
        print(f"✅ アクセス成功: {response.url} ({len(response.text)} bytes)")
        soup = BeautifulSoup(response.text, "html.parser")
        if "表示に時間がかかっております" in response.text:
            print("⚠️ 取得HTMLがプレースホルダーです。後続処理で補完を試みます")
        return soup
    except Exception as e:
        print(f"❌ アクセス失敗: {MIZUHO_CHECK_URL} -> {e}")
        return None


def extract_draw_data_from_check_table(soup):
    """check系ページの結果テーブルから最新回を抽出"""
    try:
        tables = soup.find_all("table")
        if not tables:
            print("⚠️ table 要素が見つかりません")
            return None

        best_data = None

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
                value_text = normalize_text(
                    " ".join(cell.get_text(" ", strip=True) for cell in cells[1:])
                )

                if "回別" in label:
                    match = re.search(r"第\s*(\d+)\s*回", value_text)
                    if match:
                        record["drawNumber"] = int(match.group(1))

                elif "抽せん日" in label:
                    match = re.search(r"(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日", value_text)
                    if match:
                        y, m, d = match.groups()
                        record["drawDate"] = f"{y}-{m.zfill(2)}-{d.zfill(2)}"

                elif "本数字" in label:
                    record["numbers"] = extract_numbers(value_text)[:6]

                elif "ボーナス数字" in label:
                    bonus_candidates = extract_numbers(value_text)
                    if bonus_candidates:
                        record["bonusNumber"] = bonus_candidates[0]

                elif re.fullmatch(r"[1-5]等", label):
                    rank = label.replace("等", "")
                    winners_match = re.search(r"([\d,]+)\s*口", value_text)
                    amount_match = re.search(r"([\d,]+)\s*円", value_text)
                    record["prizes"][rank] = {
                        "winners": parse_int(winners_match.group(1)) if winners_match else 0,
                        "amount": parse_int(amount_match.group(1)) if amount_match else 0,
                    }

                elif "キャリーオーバー" in label:
                    amount_match = re.search(r"([\d,]+)\s*円", value_text)
                    if amount_match:
                        record["carryOver"] = parse_int(amount_match.group(1))

            if record["drawNumber"] and record["drawDate"] and len(record["numbers"]) == 6:
                if best_data is None or record["drawNumber"] > best_data["drawNumber"]:
                    best_data = record

        if best_data:
            print(f"✅ check系テーブル抽出成功: 第{best_data['drawNumber']}回")
            return best_data

        print("⚠️ check系テーブルから有効な回を抽出できませんでした")
        return None

    except Exception as e:
        print(f"⚠️ check系テーブル抽出失敗: {e}")
        return None


def extract_draw_data(soup):
    """最新回データの抽出"""
    try:
        table_result = extract_draw_data_from_check_table(soup)
        if table_result:
            return table_result

        page_text = soup.get_text()
        compact_text = normalize_text(page_text)

        draw_number = None
        latest_match = re.search(r"最新[\s\S]{0,200}?第\s*(\d+)\s*回", compact_text)
        if latest_match:
            draw_number = int(latest_match.group(1))
        else:
            matches = re.findall(r"第\s*(\d+)\s*回", compact_text)
            if matches:
                draw_number = max(int(m) for m in matches)

        if not draw_number:
            print("❌ 回号が見つかりません")
            return None

        print(f"✅ 回号: 第{draw_number}回")

        draw_date = None
        date_match = re.search(r"(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日", compact_text)
        if date_match:
            y, m, d = date_match.groups()
            draw_date = f"{y}-{m.zfill(2)}-{d.zfill(2)}"
        else:
            print("❌ 抽せん日が見つかりません")
            return None

        print(f"✅ 抽選日: {draw_date}")

        numbers = []
        bonus_number = 0

        target_row = None
        for row in soup.find_all("tr"):
            row_text = normalize_text(row.get_text(" ", strip=True))
            if f"第{draw_number}回" in row_text or re.search(fr"\b{draw_number}\b", row_text):
                nums_in_row = extract_numbers(row_text)
                if len(nums_in_row) >= 6:
                    target_row = row
                    break

        if target_row:
            candidates = []
            for cell in target_row.find_all(["td", "th", "span", "strong", "div"]):
                for num in extract_numbers(cell.get_text(" ", strip=True)):
                    if num not in candidates:
                        candidates.append(num)

            if len(candidates) >= 6:
                numbers = sorted(candidates[:6])
                extras = [n for n in candidates if n not in numbers]
                if extras:
                    bonus_number = extras[0]

        if len(numbers) < 6:
            number_context_match = re.search(r"本数字[\s\S]{0,200}", compact_text)
            if number_context_match:
                valid_nums = extract_numbers(number_context_match.group(0))
                if len(valid_nums) >= 6:
                    numbers = sorted(valid_nums[:6])
                    extras = [n for n in valid_nums if n not in numbers]
                    if extras and not bonus_number:
                        bonus_number = extras[0]

        if len(numbers) < 6:
            print(f"❌ 番号不足: {numbers}")
            return None

        print(f"✅ 当選番号: {numbers}")

        if not bonus_number:
            bonus_match = re.search(r"ボーナス[数字]*[：:\s]*(\d+)", compact_text)
            if bonus_match:
                candidate = int(bonus_match.group(1))
                if candidate not in numbers:
                    bonus_number = candidate

        print(f"✅ ボーナス数字: {bonus_number}")

        prizes = extract_prize_data(compact_text)
        print(f"✅ 1等: {prizes['1']['winners']}口 / {prizes['1']['amount']:,}円")

        carry_over = 0
        carry_match = re.search(r"キャリーオーバー[：:\s]*([\d,]+)\s*円", compact_text)
        if carry_match:
            carry_over = parse_int(carry_match.group(1))

        print(f"✅ キャリーオーバー: {carry_over:,}円")

        return {
            "drawNumber": draw_number,
            "drawDate": draw_date,
            "numbers": numbers,
            "bonusNumber": bonus_number,
            "prizes": prizes,
            "carryOver": carry_over,
        }

    except Exception as e:
        print(f"❌ 抽出エラー: {e}")
        import traceback
        traceback.print_exc()
        return None


def save_data(new_data):
    """データ保存処理"""
    try:
        os.makedirs(DATA_DIR, exist_ok=True)

        history = []
        if os.path.exists(HISTORY_FILE):
            with open(HISTORY_FILE, "r", encoding="utf-8") as f:
                loaded = json.load(f)
                history = loaded if isinstance(loaded, list) else []

        history = [h for h in history if isinstance(h, dict) and h.get("drawNumber")]
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
    print("🎱 ロト6実データ取得（check系ページ優先版）")
    print(f"📁 保存先: {DATA_DIR}")
    soup = safe_request()
    if soup:
        data = extract_draw_data(soup)
        if data:
            print("🧾 取得データ確認:")
            print(json.dumps(data, ensure_ascii=False, indent=2))
        if data and save_data(data):
            print("✅ 処理完了")
            sys.exit(0)
    sys.exit(1)


if __name__ == "__main__":
    main()
