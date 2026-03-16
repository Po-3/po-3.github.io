#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ロト6実データ取得スクリプト（最適化版）
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
MIZUHO_URL = "https://www.mizuhobank.co.jp/retail/takarakuji/loto/loto6/index.html"

def safe_request():
    """人間らしいHTTPリクエスト"""
    print("🌐 みずほ銀行公式サイトにアクセス中...")
    
    # 【改善1】リアルなブラウザUser-Agent
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
        'Referer': 'https://www.google.com/',
        'Connection': 'keep-alive'
    }
    
    # サーバー負荷軽減（必須）
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
    """改良されたデータ抽出"""
    try:
        page_text = soup.get_text()
        print("📄 データ抽出開始...")
        
        # 【改善2】空白対応の正規表現
        draw_number = None
        # 特定要素から優先検索
        for elem in soup.select('h1, h2, h3, .title, strong, span'):
            match = re.search(r'第\s*(\d+)\s*回', elem.get_text())
            if match:
                draw_number = int(match.group(1))
                break
        
        # ページ全体からのフォールバック
        if not draw_number:
            match = re.search(r'第\s*(\d+)\s*回', page_text)
            if match:
                draw_number = int(match.group(1))
        
        if not draw_number:
            print("❌ 回号が見つかりません")
            return None
        
        print(f"✅ 回号取得: 第{draw_number}回")
        
        # 抽選日の抽出
        draw_date = datetime.now().strftime('%Y-%m-%d')
        date_match = re.search(r'(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日', page_text)
        if date_match:
            y, m, d = date_match.groups()
            draw_date = f"{y}-{m.zfill(2)}-{d.zfill(2)}"
        
        print(f"✅ 抽選日: {draw_date}")
        
        # 【改善3】拡張セレクタによる当選番号抽出
        numbers = []
        selectors = [
            'strong.js-lottery-number-pc',
            '.js-lottery-number-pc',
            '.lottery-number strong',
            '.number strong',
            'span.num',
            'td.alnCenter strong',
            'table td strong',
            '.winning-numbers span'
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
        
        # 全strongタグからのフォールバック
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
        
        # ボーナス数字の抽出
        bonus_number = 0
        for selector in ['strong.js-lottery-bonus-pc', '.bonus strong', '.bonus-number']:
            elem = soup.select_one(selector)
            if elem and elem.get_text(strip=True).isdigit():
                bonus_number = int(elem.get_text(strip=True))
                break
        
        if not bonus_number:
            bonus_match = re.search(r'ボーナス[数字]*[：:\s]*(\d+)', page_text)
            if bonus_match:
                bonus_number = int(bonus_match.group(1))
        
        print(f"✅ ボーナス数字: {bonus_number}")
        
        # キャリーオーバーの抽出
        carry_over = 0
        carry_match = re.search(r'キャリーオーバー[：:\s]*([\d,]+)\s*円', page_text)
        if carry_match:
            try:
                carry_over = int(carry_match.group(1).replace(',', ''))
            except ValueError:
                pass
        
        print(f"✅ キャリーオーバー: {carry_over:,}円")
        
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
        # デバッグ用トレースバック
        import traceback
        traceback.print_exc()
        return None

def save_data(new_data):
    """データ保存処理"""
    try:
        os.makedirs(DATA_DIR, exist_ok=True)
        
        # 既存履歴読み込み
        history = []
        if os.path.exists(HISTORY_FILE):
            with open(HISTORY_FILE, 'r', encoding='utf-8') as f:
                history = json.load(f)
        
        # 重複回避・更新
        history = [h for h in history if h.get('drawNumber') != new_data['drawNumber']]
        history.insert(0, new_data)
        history.sort(key=lambda x: x.get('drawNumber', 0), reverse=True)
        
        # ファイル保存
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
    print("🎱 ロト6実データ取得開始")
    print("⚖️ 利用規約遵守・適切な間隔でアクセス")
    
    soup = safe_request()
    if not soup:
        sys.exit(1)
    
    data = extract_draw_data(soup)
    if not data:
        sys.exit(1)
    
    if save_data(data):
        print("✅ 処理完了")
        sys.exit(0)
    else:
        sys.exit(1)

if __name__ == "__main__":
    main()
