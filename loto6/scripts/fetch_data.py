#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ロト6実データ取得スクリプト（自動生成版）
みずほ銀行公式サイトから最新抽選結果を安全に取得
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

# みずほ銀行公式URL
MIZUHO_URL = "https://www.mizuhobank.co.jp/retail/takarakuji/loto/loto6/index.html"

def safe_request():
    """安全なHTTPリクエスト"""
    print("🌐 みずほ銀行公式サイトにアクセス中...")
    
    # 適切なヘッダー設定（利用規約遵守）
    headers = {
        'User-Agent': 'Mozilla/5.0 (compatible; Loto6Bot/1.0; Educational Purpose)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive'
    }
    
    # サーバー負荷軽減のため必須の待機
    time.sleep(5)
    
    try:
        response = requests.get(MIZUHO_URL, headers=headers, timeout=30)
        response.raise_for_status()
        response.encoding = response.apparent_encoding or 'utf-8'
        
        soup = BeautifulSoup(response.text, 'html.parser')
        print("✅ サイトアクセス成功")
        return soup
        
    except Exception as e:
        print(f"❌ サイトアクセスエラー: {e}")
        return None

def extract_draw_data(soup):
    """抽選データの抽出"""
    try:
        # 回号の抽出（複数パターン対応）
        draw_number = None
        selectors = ['h1', 'h2', 'h3', '.title', '.draw-title']
        
        for selector in selectors:
            elements = soup.select(selector)
            for elem in elements:
                text = elem.get_text()
                match = re.search(r'第(\d+)回', text)
                if match:
                    draw_number = int(match.group(1))
                    print(f"✅ 回号取得: 第{draw_number}回")
                    break
            if draw_number:
                break
        
        if not draw_number:
            print("❌ 回号が見つかりません")
            return None
        
        # 抽選日の抽出
        draw_date = datetime.now().strftime('%Y-%m-%d')
        date_patterns = [
            r'(\d{4})年(\d{1,2})月(\d{1,2})日',
            r'(\d{1,2})月(\d{1,2})日',
            r'(\d{4})/(\d{1,2})/(\d{1,2})'
        ]
        
        page_text = soup.get_text()
        for pattern in date_patterns:
            match = re.search(pattern, page_text)
            if match:
                groups = match.groups()
                if len(groups) == 3:
                    year, month, day = groups
                    draw_date = f"{year}-{month.zfill(2)}-{day.zfill(2)}"
                break
        
        print(f"✅ 抽選日取得: {draw_date}")
        
        # 当選番号の抽出（複数セレクタ対応）
        numbers = []
        number_selectors = [
            'strong.js-lottery-number-pc',
            '.lottery-number strong',
            '.number strong',
            'span.num',
            '.winning-numbers span'
        ]
        
        for selector in number_selectors:
            elements = soup.select(selector)
            for elem in elements:
                text = elem.get_text(strip=True)
                if text.isdigit():
                    num = int(text)
                    if 1 <= num <= 43 and num not in numbers:
                        numbers.append(num)
            
            if len(numbers) >= 6:
                break
        
        # 数字が不足している場合の追加取得
        if len(numbers) < 6:
            all_strong = soup.find_all('strong')
            for elem in all_strong:
                text = elem.get_text(strip=True)
                if text.isdigit():
                    num = int(text)
                    if 1 <= num <= 43 and num not in numbers:
                        numbers.append(num)
                if len(numbers) >= 6:
                    break
        
        numbers = sorted(numbers[:6])
        print(f"✅ 当選番号取得: {numbers}")
        
        # ボーナス数字の抽出
        bonus_number = 0
        bonus_selectors = [
            'strong.js-lottery-bonus-pc',
            '.bonus strong',
            '.bonus-number'
        ]
        
        for selector in bonus_selectors:
            elem = soup.select_one(selector)
            if elem and elem.get_text(strip=True).isdigit():
                bonus_number = int(elem.get_text(strip=True))
                break
        
        # ボーナス数字が見つからない場合の処理
        if not bonus_number:
            bonus_match = re.search(r'ボーナス[：:\s]*(\d+)', page_text)
            if bonus_match:
                bonus_number = int(bonus_match.group(1))
        
        print(f"✅ ボーナス数字取得: {bonus_number}")
        
        # キャリーオーバーの抽出
        carry_over = 0
        carry_patterns = [
            r'キャリーオーバー[：:\s]*([\d,]+)円',
            r'([\d,]+)円.*キャリーオーバー'
        ]
        
        for pattern in carry_patterns:
            match = re.search(pattern, page_text)
            if match:
                carry_str = match.group(1).replace(',', '')
                try:
                    carry_over = int(carry_str)
                    break
                except ValueError:
                    continue
        
        print(f"✅ キャリーオーバー取得: {carry_over:,}円")
        
        if len(numbers) < 6:
            print(f"❌ 当選番号が不足: {len(numbers)}個")
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
        print(f"❌ データ抽出エラー: {e}")
        return None

def save_data(new_data):
    """データの保存"""
    try:
        os.makedirs(DATA_DIR, exist_ok=True)
        
        # 既存履歴の読み込み
        history = []
        if os.path.exists(HISTORY_FILE):
            with open(HISTORY_FILE, 'r', encoding='utf-8') as f:
                history = json.load(f)
        
        # 重複チェック
        updated = False
        for i, item in enumerate(history):
            if item.get('drawNumber') == new_data['drawNumber']:
                history[i] = new_data
                updated = True
                print(f"✅ 既存データを更新: 第{new_data['drawNumber']}回")
                break
        
        if not updated:
            history.insert(0, new_data)
            print(f"✅ 新規データを追加: 第{new_data['drawNumber']}回")
        
        # 回号順でソート
        history.sort(key=lambda x: x.get('drawNumber', 0), reverse=True)
        
        # ファイル保存
        with open(HISTORY_FILE, 'w', encoding='utf-8') as f:
            json.dump(history, f, ensure_ascii=False, indent=2)
        
        with open(LATEST_FILE, 'w', encoding='utf-8') as f:
            json.dump(history[:10], f, ensure_ascii=False, indent=2)
        
        print("✅ JSONファイル保存完了")
        return True
        
    except Exception as e:
        print(f"❌ 保存エラー: {e}")
        return False

def main():
    """メイン処理"""
    print("🎱 ロト6実データ取得開始")
    print("⚠️ 利用規約を遵守し、適切な間隔でアクセスします")
    
    soup = safe_request()
    if not soup:
        print("❌ サイトアクセスに失敗しました")
        sys.exit(1)
    
    data = extract_draw_data(soup)
    if not data:
        print("❌ データ抽出に失敗しました")
        sys.exit(1)
    
    if save_data(data):
        print("✅ 処理完了")
        sys.exit(0)
    else:
        print("❌ 処理失敗")
        sys.exit(1)

if __name__ == "__main__":
    main()
