#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ロト6実データ取得スクリプト
みずほ銀行公式サイトから最新の抽選結果を取得
"""

import requests
from bs4 import BeautifulSoup
import json
import re
import os
import time
from datetime import datetime

# 設定
DATA_DIR = "assets/data"
LATEST_FILE = os.path.join(DATA_DIR, "latest.json")
HISTORY_FILE = os.path.join(DATA_DIR, "history.json")

# みずほ銀行公式URL
MIZUHO_URL = "https://www.mizuhobank.co.jp/retail/takarakuji/loto/loto6/index.html"

def fetch_latest_data():
    """みずほ銀行から最新データを取得"""
    print("🌐 みずほ銀行からデータ取得中...")
    
    # サーバー負荷軽減のため待機
    time.sleep(5)
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (compatible; Loto6Bot/1.0; Educational Purpose)',
        'Accept': 'text/html,application/xhtml+xml',
    }
    
    try:
        response = requests.get(MIZUHO_URL, headers=headers, timeout=30)
        response.raise_for_status()
        response.encoding = response.apparent_encoding or 'utf-8'
        
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # 回号の抽出
        draw_number = None
        for element in soup.find_all(['h1', 'h2', 'h3', 'h4']):
            match = re.search(r'第(\d+)回', element.get_text())
            if match:
                draw_number = int(match.group(1))
                break
        
        if not draw_number:
            print("❌ 回号が見つかりません")
            return None
        
        # 抽選日の抽出
        draw_date = datetime.now().strftime('%Y-%m-%d')
        for element in soup.find_all(['td', 'span', 'p']):
            text = element.get_text()
            date_match = re.search(r'(\d{4})年(\d{1,2})月(\d{1,2})日', text)
            if date_match:
                year, month, day = date_match.groups()
                draw_date = f"{year}-{month.zfill(2)}-{day.zfill(2)}"
                break
        
        # 当選番号の抽出
        numbers = []
        # 複数のセレクタパターンを試行
        selectors = [
            'strong.js-lottery-number-pc',
            '.number strong',
            'td strong',
            'span.num'
        ]
        
        for selector in selectors:
            elements = soup.select(selector)
            for elem in elements:
                text = elem.get_text(strip=True)
                if text.isdigit():
                    num = int(text)
                    if 1 <= num <= 43 and num not in numbers:
                        numbers.append(num)
            
            if len(numbers) >= 6:
                break
        
        numbers = sorted(numbers[:6])
        
        # ボーナス数字の抽出
        bonus_number = 0
        bonus_selectors = [
            'strong.js-lottery-bonus-pc',
            '.bonus strong'
        ]
        
        for selector in bonus_selectors:
            elem = soup.select_one(selector)
            if elem and elem.get_text(strip=True).isdigit():
                bonus_number = int(elem.get_text(strip=True))
                break
        
        # 7番目の数字をボーナスとして使用（フォールバック）
        if not bonus_number and len(numbers) > 6:
            bonus_number = numbers[6]
            numbers = numbers[:6]
        
        # キャリーオーバーの抽出
        carry_over = 0
        for element in soup.find_all(text=re.compile(r'キャリーオーバー')):
            parent = element.parent
            if parent:
                carry_match = re.search(r'([\d,]+)円', parent.get_text())
                if carry_match:
                    carry_over = int(carry_match.group(1).replace(',', ''))
                    break
        
        if len(numbers) < 6:
            print(f"❌ 当選番号が不足: {numbers}")
            return None
        
        data = {
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
        
        print(f"✅ データ取得成功: 第{draw_number}回 {numbers} ボーナス:{bonus_number}")
        return data
        
    except Exception as e:
        print(f"❌ エラー: {e}")
        return None

def save_data(data):
    """データをJSONファイルに保存"""
    if not data:
        return False
    
    try:
        # ディレクトリ作成
        os.makedirs(DATA_DIR, exist_ok=True)
        
        # 履歴データの読み込み
        history = []
        if os.path.exists(HISTORY_FILE):
            with open(HISTORY_FILE, 'r', encoding='utf-8') as f:
                history = json.load(f)
        
        # 重複チェック
        updated = False
        for i, item in enumerate(history):
            if item.get('drawNumber') == data['drawNumber']:
                history[i] = data
                updated = True
                break
        
        if not updated:
            history.insert(0, data)
        
        # 回号順でソート（降順）
        history.sort(key=lambda x: x.get('drawNumber', 0), reverse=True)
        
        # ファイル保存
        with open(HISTORY_FILE, 'w', encoding='utf-8') as f:
            json.dump(history, f, ensure_ascii=False, indent=2)
        
        with open(LATEST_FILE, 'w', encoding='utf-8') as f:
            json.dump(history[:10], f, ensure_ascii=False, indent=2)
        
        print("✅ JSONファイル更新完了")
        return True
        
    except Exception as e:
        print(f"❌ 保存エラー: {e}")
        return False

def main():
    """メイン処理"""
    print("🎱 ロト6実データ取得開始")
    
    data = fetch_latest_data()
    if data and save_data(data):
        print("✅ 処理完了")
    else:
        print("❌ 処理失敗")
        exit(1)

if __name__ == "__main__":
    main()
