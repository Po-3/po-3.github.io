#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ロト6実データ取得スクリプト（精度向上版）
回号と日付の抽出精度を大幅に改善
"""

import requests
from bs4 import BeautifulSoup
import json
import re
import os
import time
from datetime import datetime
import sys

# 設定
DATA_DIR = "assets/data"
LATEST_FILE = os.path.join(DATA_DIR, "latest.json")
HISTORY_FILE = os.path.join(DATA_DIR, "history.json")
MIZUHO_URL = "https://www.mizuhobank.co.jp/retail/takarakuji/loto/loto6/index.html"

def safe_request():
    """人間らしいHTTPリクエスト"""
    print("🌐 みずほ銀行公式サイト（ロト6専用）にアクセス中...")
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.9',
        'Referer': 'https://www.google.com/',
        'Connection': 'keep-alive'
    }
    
    time.sleep(5)
    
    try:
        response = requests.get(MIZUHO_URL, headers=headers, timeout=30)
        response.raise_for_status()
        response.encoding = response.apparent_encoding or 'utf-8'
        
        soup = BeautifulSoup(response.text, 'html.parser')
        print(f"✅ アクセス成功 ({len(response.text)} bytes)")
        return soup
        
    except Exception as e:
        print(f"❌ アクセスエラー: {e}")
        return None

def extract_draw_data(soup):
    """改良版データ抽出（回号・日付の精度向上）"""
    try:
        page_text = soup.get_text()
        print("📄 データ抽出開始...")
        
        # 【改善1】回号の精密抽出
        draw_number = None
        
        # 戦略1: 最新の結果テーブルから回号を抽出
        table_rows = soup.find_all('tr')
        for row in table_rows:
            cells = row.find_all(['td', 'th'])
            for cell in cells:
                text = cell.get_text(strip=True)
                match = re.search(r'第\s*(\d+)\s*回', text)
                if match:
                    num = int(match.group(1))
                    # 現実的な回号範囲（2000-2200）
                    if 2000 <= num <= 2200:
                        if not draw_number or num > draw_number:
                            draw_number = num
        
        # 戦略2: ページ全体から最大の回号を取得
        if not draw_number:
            all_numbers = re.findall(r'第\s*(\d+)\s*回', page_text)
            valid_numbers = [int(n) for n in all_numbers if 2000 <= int(n) <= 2200]
            if valid_numbers:
                draw_number = max(valid_numbers)
        
        if not draw_number:
            print("❌ 回号が見つかりません")
            return None
        
        print(f"✅ 回号取得: 第{draw_number}回")
        
        # 【改善2】抽選日の精密抽出
        draw_date = None
        
        # 戦略1: 回号と同じ行またはセルから日付を取得
        for row in table_rows:
            row_text = row.get_text()
            if f"第{draw_number}回" in row_text or str(draw_number) in row_text:
                date_match = re.search(r'(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日', row_text)
                if date_match:
                    y, m, d = date_match.groups()
                    date_obj = datetime(int(y), int(m), int(d))
                    # ロト6は月曜(0)・木曜(3)のみ
                    if date_obj.weekday() in [0, 3]:
                        draw_date = f"{y}-{m.zfill(2)}-{d.zfill(2)}"
                        print(f"✅ 抽選日取得: {draw_date}")
                        break
        
        # 戦略2: 最新の日付を取得
        if not draw_date:
            all_dates = re.findall(r'(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日', page_text)
            for y, m, d in reversed(all_dates):  # 後ろから検索（最新優先）
                try:
                    date_obj = datetime(int(y), int(m), int(d))
                    if date_obj.weekday() in [0, 3]:  # 月曜・木曜チェック
                        draw_date = f"{y}-{m.zfill(2)}-{d.zfill(2)}"
                        print(f"✅ 抽選日取得（推定）: {draw_date}")
                        break
                except ValueError:
                    continue
        
        if not draw_date:
            draw_date = datetime.now().strftime('%Y-%m-%d')
            print(f"⚠️ 抽選日フォールバック: {draw_date}")
        
        # 【改善3】当選番号の抽出（既存ロジック改良）
        numbers = []
        
        # ロト6専用セレクタ
        selectors = [
            'strong.js-lottery-number-pc',
            '.js-lottery-number-pc',
            '.lottery-number strong',
            '.number strong',
            'span.num',
            'td.alnCenter strong',
            'table td strong'
        ]
        
        for selector in selectors:
            for elem in soup.select(selector):
                text = elem.get_text(strip=True)
                if text.isdigit():
                    num = int(text)
                    if 1 <= num <= 43 and num not in numbers:
                        numbers.append(num)
            if len(numbers) >= 6:
                break
        
        # フォールバック: 全strongタグ
        if len(numbers) < 6:
            print("⚠️ フォールバック: 全strongタグ検索")
            for elem in soup.find_all('strong'):
                text = elem.get_text(strip=True)
                if text.isdigit():
                    num = int(text)
                    if 1 <= num <= 43 and num not in numbers:
                        numbers.append(num)
                if len(numbers) >= 6:
                    break
        
        numbers = sorted(numbers[:6])
        print(f"✅ 当選番号: {numbers}")
        
        # ボーナス数字
        bonus_number = 0
        for selector in ['strong.js-lottery-bonus-pc', '.bonus strong']:
            elem = soup.select_one(selector)
            if elem and elem.get_text(strip=True).isdigit():
                num = int(elem.get_text(strip=True))
                if 1 <= num <= 43 and num not in numbers:
                    bonus_number = num
                    break
        
        if not bonus_number:
            bonus_match = re.search(r'ボーナス[数字]*[：:\s]*(\d+)', page_text)
            if bonus_match:
                num = int(bonus_match.group(1))
                if 1 <= num <= 43 and num not in numbers:
                    bonus_number = num
        
        print(f"✅ ボーナス数字: {bonus_number}")
        
        # キャリーオーバー（上限なし - 実際のロト6には法的上限がない）
        carry_over = 0
        carry_match = re.search(r'キャリーオーバー[：:\s]*([\d,]+)\s*円', page_text)
        if carry_match:
            try:
                carry_over = int(carry_match.group(1).replace(',', ''))
            except ValueError:
                pass
        
        print(f"✅ キャリーオーバー: {carry_over:,}円")
        
        # データ検証
        if len(numbers) < 6:
            print(f"❌ 当選番号不足: {numbers}")
            return None
        
        return {
            "drawNumber": draw_number,
            "drawDate": draw_date,
            "numbers": numbers,
            "bonusNumber": bonus_number,
            "prizes": {
                "1": {"winners": 0, "amount": 0},
                "2": {"winners": 0, "amount": 0},
                "3": {"winners": 0, "amount": 0},
                "4": {"winners": 0, "amount": 0},
                "5": {"winners": 0, "amount": 0}
            },
            "carryOver": carry_over
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
            with open(HISTORY_FILE, 'r', encoding='utf-8') as f:
                history = json.load(f)
        
        history = [h for h in history if h.get('drawNumber') != new_data['drawNumber']]
        history.insert(0, new_data)
        history.sort(key=lambda x: x.get('drawNumber', 0), reverse=True)
        
        with open(HISTORY_FILE, 'w', encoding='utf-8') as f:
            json.dump(history, f, ensure_ascii=False, indent=2)
        with open(LATEST_FILE, 'w', encoding='utf-8') as f:
            json.dump(history[:10], f, ensure_ascii=False, indent=2)
        
        print(f"✅ 保存完了 (履歴: {len(history)}件)")
        return True
        
    except Exception as e:
        print(f"❌ 保存エラー: {e}")
        return False

def main():
    """メイン処理"""
    print("🎱 ロト6実データ取得（精度向上版）")
    
    soup = safe_request()
    if not soup:
        sys.exit(1)
    
    data = extract_draw_data(soup)
    if not data:
        sys.exit(1)
    
    print(f"\n📊 取得データ確認:")
    print(f"回号: 第{data['drawNumber']}回")
    print(f"日付: {data['drawDate']}")
    print(f"番号: {data['numbers']}")
    print(f"ボーナス: {data['bonusNumber']}")
    print(f"キャリーオーバー: {data['carryOver']:,}円")
    
    if save_data(data):
        print("✅ 処理完了")
        sys.exit(0)
    else:
        sys.exit(1)

if __name__ == "__main__":
    main()
