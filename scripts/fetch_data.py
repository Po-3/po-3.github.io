#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ロト6実データ取得スクリプト（改良版）
最新回のデータのみを正確に取得、キャリーオーバー上限チェック付き
"""

import requests
from bs4 import BeautifulSoup
import json
import re
import os
import time
from datetime import datetime
import sys

DATA_DIR = "assets/data"
LATEST_FILE = os.path.join(DATA_DIR, "latest.json")
HISTORY_FILE = os.path.join(DATA_DIR, "history.json")
MIZUHO_URL = "https://www.mizuhobank.co.jp/retail/takarakuji/loto/loto6/index.html"

def safe_request():
    """改良されたHTTPリクエスト"""
    print("🌐 みずほ銀行公式サイトアクセス中...")
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.9',
        'Referer': 'https://www.google.com/',
        'Connection': 'keep-alive'
    }
    
    time.sleep(5)  # 必須の待機
    
    try:
        response = requests.get(MIZUHO_URL, headers=headers, timeout=30)
        response.raise_for_status()
        response.encoding = 'utf-8'
        soup = BeautifulSoup(response.text, 'html.parser')
        print(f"✅ アクセス成功 ({len(response.text)} bytes)")
        return soup
    except Exception as e:
        print(f"❌ エラー: {e}")
        return None

def extract_draw_data(soup):
    """最新回データの正確な抽出"""
    try:
        page_text = soup.get_text()
        
        # 回号の抽出（最新回を優先）
        draw_number = None
        # 「最新」キーワード近くから検索
        latest_match = re.search(r'最新.*?第\s*(\d+)\s*回', page_text)
        if latest_match:
            draw_number = int(latest_match.group(1))
        else:
            # フォールバック
            match = re.search(r'第\s*(\d+)\s*回', page_text)
            if match:
                draw_number = int(match.group(1))
        
        if not draw_number:
            print("❌ 回号が見つかりません")
            return None
        
        print(f"✅ 回号: 第{draw_number}回")
        
        # 抽選日の抽出（回号近くから検索）
        draw_date = datetime.now().strftime('%Y-%m-%d')
        context_start = max(0, page_text.find(f'第{draw_number}回') - 200)
        context_end = min(len(page_text), page_text.find(f'第{draw_number}回') + 500)
        context = page_text[context_start:context_end]
        
        date_match = re.search(r'(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日', context)
        if date_match:
            y, m, d = date_match.groups()
            draw_date = f"{y}-{m.zfill(2)}-{d.zfill(2)}"
        
        print(f"✅ 抽選日: {draw_date}")
        
        # 当選番号の抽出（最新回のテーブル行から）
        numbers = []
        
        # 戦略1: 最新回のテーブル行から抽出
        table_rows = soup.find_all('tr')
        for row in table_rows[:10]:  # 上位10行のみ検索
            row_text = row.get_text()
            if str(draw_number) in row_text or '本数字' in row_text:
                for cell in row.find_all(['td', 'th']):
                    text = cell.get_text(strip=True)
                    if text.isdigit():
                        num = int(text)
                        if 1 <= num <= 43 and num not in numbers:
                            numbers.append(num)
                if len(numbers) >= 6:
                    break
        
        # 戦略2: セレクタベースの抽出
        if len(numbers) < 6:
            selectors = [
                'strong.js-lottery-number-pc',
                '.lottery-number strong',
                '.number strong'
            ]
            for selector in selectors:
                for elem in soup.select(selector)[:6]:
                    text = elem.get_text(strip=True)
                    if text.isdigit():
                        num = int(text)
                        if 1 <= num <= 43 and num not in numbers:
                            numbers.append(num)
                if len(numbers) >= 6:
                    break
        
        numbers = sorted(numbers[:6])
        
        if len(numbers) < 6:
            print(f"❌ 番号不足: {numbers}")
            return None
        
        print(f"✅ 当選番号: {numbers}")
        
        # ボーナス数字の抽出
        bonus_number = 0
        for selector in ['strong.js-lottery-bonus-pc', '.bonus strong']:
            elem = soup.select_one(selector)
            if elem and elem.get_text(strip=True).isdigit():
                candidate = int(elem.get_text(strip=True))
                if candidate not in numbers:  # 本数字と重複しないことを確認
                    bonus_number = candidate
                    break
        
        if not bonus_number:
            bonus_match = re.search(r'ボーナス[数字]*[：:\s]*(\d+)', page_text)
            if bonus_match:
                candidate = int(bonus_match.group(1))
                if candidate not in numbers:
                    bonus_number = candidate
        
        print(f"✅ ボーナス数字: {bonus_number}")
        
        # キャリーオーバーの抽出（10億円上限チェック）
        carry_over = 0
        carry_match = re.search(r'キャリーオーバー[：:\s]*([\d,]+)\s*円', page_text)
        if carry_match:
            try:
                amount = int(carry_match.group(1).replace(',', ''))
                # ロト6の上限は10億円
                if amount <= 1000000000:
                    carry_over = amount
                else:
                    print(f"⚠️ キャリーオーバー額が上限超過: {amount:,}円 → 上限適用")
                    carry_over = 1000000000
            except ValueError:
                pass
        
        print(f"✅ キャリーオーバー: {carry_over:,}円")
        
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
        
        # 重複削除・追加
        history = [h for h in history if h.get('drawNumber') != new_data['drawNumber']]
        history.insert(0, new_data)
        history.sort(key=lambda x: x.get('drawNumber', 0), reverse=True)
        
        with open(HISTORY_FILE, 'w', encoding='utf-8') as f:
            json.dump(history, f, ensure_ascii=False, indent=2)
        with open(LATEST_FILE, 'w', encoding='utf-8') as f:
            json.dump(history[:10], f, ensure_ascii=False, indent=2)
        
        print(f"✅ 保存完了")
        return True
    except Exception as e:
        print(f"❌ 保存エラー: {e}")
        return False

def main():
    print("🎱 ロト6実データ取得（改良版）")
    soup = safe_request()
    if soup:
        data = extract_draw_data(soup)
        if data and save_data(data):
            print("✅ 処理完了")
            sys.exit(0)
    sys.exit(1)

if __name__ == "__main__":
    main()
