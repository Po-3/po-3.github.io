#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ロト6データ取得スクリプト
みずほ銀行公式サイトから数値データのみを適切に取得し、JSONファイルを更新
"""

import json
import os
import re
import sys
import time
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Union
import logging

import requests
from bs4 import BeautifulSoup

# ログ設定
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('loto6_fetch.log', encoding='utf-8'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

# 設定
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "assets" / "data"
LATEST_JSON = DATA_DIR / "latest.json"
HISTORY_JSON = DATA_DIR / "history.json"
STATS_JSON = DATA_DIR / "stats.json"

# みずほ銀行公式URL（実際のサイト構造に合わせて調整が必要）
TARGET_URL = "https://www.mizuhobank.co.jp/retail/takarakuji/loto/loto6/index.html"
RESULTS_LIST_URL = "https://www.mizuhobank.co.jp/retail/takarakuji/loto/loto6/list.html"

# ヘッダー設定（適切な身元明示）
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (compatible; Loto6DataBot/1.0; Educational Purpose)',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'ja,en-US;q=0.5',
    'Accept-Encoding': 'gzip, deflate',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
}

# リクエスト制限
REQUEST_DELAY = 5  # 秒
MAX_RETRIES = 3
TIMEOUT = 30

class Loto6DataFetcher:
    """ロト6データ取得クラス"""
    
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update(HEADERS)
        
    def safe_request(self, url: str, retries: int = MAX_RETRIES) -> Optional[BeautifulSoup]:
        """安全なHTTPリクエスト実行"""
        for attempt in range(retries):
            try:
                logger.info(f"リクエスト実行: {url} (試行 {attempt + 1}/{retries})")
                time.sleep(REQUEST_DELAY)  # レート制限
                
                response = self.session.get(url, timeout=TIMEOUT)
                response.raise_for_status()
                response.encoding = response.apparent_encoding or 'utf-8'
                
                soup = BeautifulSoup(response.text, 'html.parser')
                logger.info("リクエスト成功")
                return soup
                
            except requests.exceptions.RequestException as e:
                logger.warning(f"リクエスト失敗 (試行 {attempt + 1}): {e}")
                if attempt < retries - 1:
                    time.sleep(REQUEST_DELAY * (attempt + 1))  # 指数バックオフ
                else:
                    logger.error(f"最大試行回数に達しました: {url}")
                    
        return None
    
    def parse_draw_number(self, text: str) -> Optional[int]:
        """回号の抽出"""
        match = re.search(r'第(\d+)回', text)
        return int(match.group(1)) if match else None
    
    def parse_date(self, text: str) -> Optional[str]:
        """日付の抽出・正規化"""
        # 様々な日付形式に対応
        patterns = [
            r'(\d{4})年(\d{1,2})月(\d{1,2})日',
            r'(\d{1,2})月(\d{1,2})日',
            r'(\d{4})/(\d{1,2})/(\d{1,2})',
            r'(\d{1,2})/(\d{1,2})'
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text)
            if match:
                groups = match.groups()
                if len(groups) == 3:
                    year, month, day = groups
                    return f"{year}-{month.zfill(2)}-{day.zfill(2)}"
                elif len(groups) == 2:
                    month, day = groups
                    current_year = datetime.now().year
                    return f"{current_year}-{month.zfill(2)}-{day.zfill(2)}"
        
        return None
    
    def parse_numbers(self, element) -> List[int]:
        """当選番号の抽出"""
        numbers = []
        
        # 様々なセレクタパターンを試行
        selectors = [
            'span.num',
            '.number',
            'strong',
            'span'
        ]
        
        for selector in selectors:
            found_elements = element.select(selector)
            for elem in found_elements:
                text = elem.get_text(strip=True)
                if text.isdigit():
                    num = int(text)
                    if 1 <= num <= 43 and num not in numbers:
                        numbers.append(num)
        
        return sorted(numbers) if len(numbers) == 6 else []
    
    def parse_bonus_number(self, element) -> Optional[int]:
        """ボーナス数字の抽出"""
        # ボーナス数字の様々な表現に対応
        patterns = [
            r'ボーナス[：:\s]*(\d+)',
            r'\((\d+)\)',
            r'bonus[：:\s]*(\d+)',
        ]
        
        text = element.get_text()
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                num = int(match.group(1))
                if 1 <= num <= 43:
                    return num
        
        return None
    
    def parse_carry_over(self, soup: BeautifulSoup) -> int:
        """キャリーオーバー金額の抽出"""
        carry_over_patterns = [
            r'キャリーオーバー[：:\s]*([0-9,]+)円',
            r'([0-9,]+)円.*キャリーオーバー',
        ]
        
        text = soup.get_text()
        for pattern in carry_over_patterns:
            match = re.search(pattern, text)
            if match:
                amount_str = match.group(1).replace(',', '')
                try:
                    return int(amount_str)
                except ValueError:
                    continue
        
        return 0
    
    def fetch_latest_draw(self) -> Optional[Dict]:
        """最新の抽選結果を取得"""
        soup = self.safe_request(TARGET_URL)
        if not soup:
            return None
        
        try:
            # 実際のサイト構造に合わせてセレクタを調整
            # ここは一般的なパターンを想定した実装
            
            # 回号の取得
            draw_number = None
            for selector in ['h2', 'h3', '.title', '.draw-number']:
                elements = soup.select(selector)
                for elem in elements:
                    draw_number = self.parse_draw_number(elem.get_text())
                    if draw_number:
                        break
                if draw_number:
                    break
            
            if not draw_number:
                logger.error("回号が見つかりません")
                return None
            
            # 抽選日の取得
            draw_date = None
            for selector in ['.date', '.draw-date', 'time']:
                elements = soup.select(selector)
                for elem in elements:
                    draw_date = self.parse_date(elem.get_text())
                    if draw_date:
                        break
                if draw_date:
                    break
            
            if not draw_date:
                # デフォルトで今日の日付を使用
                draw_date = datetime.now().strftime('%Y-%m-%d')
                logger.warning(f"抽選日が見つからないため、今日の日付を使用: {draw_date}")
            
            # 当選番号の取得
            numbers = []
            bonus_number = None
            
            for selector in ['.numbers', '.winning-numbers', '.result']:
                container = soup.select_one(selector)
                if container:
                    numbers = self.parse_numbers(container)
                    bonus_number = self.parse_bonus_number(container)
                    if numbers:
                        break
            
            if not numbers:
                logger.error("当選番号が見つかりません")
                return None
            
            # キャリーオーバーの取得
            carry_over = self.parse_carry_over(soup)
            
            # データ構築
            draw_data = {
                "drawNumber": draw_number,
                "drawDate": draw_date,
                "numbers": numbers,
                "bonusNumber": bonus_number or 0,
                "prizes": {
                    "1": {"winners": 0, "amount": 0},
                    "2": {"winners": 0, "amount": 0},
                    "3": {"winners": 0, "amount": 0},
                    "4": {"winners": 0, "amount": 0},
                    "5": {"winners": 0, "amount": 0}
                },
                "carryOver": carry_over
            }
            
            logger.info(f"抽選データ取得成功: 第{draw_number}回")
            return draw_data
            
        except Exception as e:
            logger.error(f"データ解析エラー: {e}")
            return None
    
    def load_json(self, path: Path) -> Union[List, Dict]:
        """JSONファイル読み込み"""
        if not path.exists():
            return []
        
        try:
            with open(path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError) as e:
            logger.error(f"JSONファイル読み込みエラー {path}: {e}")
            return []
    
    def save_json(self, path: Path, data: Union[List, Dict]) -> bool:
        """JSONファイル保存"""
        try:
            # ディレクトリ作成
            path.parent.mkdir(parents=True, exist_ok=True)
            
            # バックアップ作成
            if path.exists():
                backup_path = path.with_suffix(f'.backup.{int(time.time())}.json')
                path.rename(backup_path)
                logger.info(f"バックアップ作成: {backup_path}")
            
            # 保存
            with open(path, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            
            logger.info(f"JSONファイル保存完了: {path}")
            return True
            
        except IOError as e:
            logger.error(f"JSONファイル保存エラー {path}: {e}")
            return False
    
    def update_data(self) -> bool:
        """データ更新メイン処理"""
        logger.info("データ更新開始")
        
        # 最新データ取得
        new_data = self.fetch_latest_draw()
        if not new_data:
            logger.error("新しいデータの取得に失敗しました")
            return False
        
        # 既存データ読み込み
        history = self.load_json(HISTORY_JSON)
        if not isinstance(history, list):
            history = []
        
        # 重複チェック
        if history and history[0].get('drawNumber') == new_data['drawNumber']:
            logger.info(f"第{new_data['drawNumber']}回のデータは既に存在します")
            return False
        
        # データ更新
        history.insert(0, new_data)
        logger.info(f"新しいデータを追加: 第{new_data['drawNumber']}回")
        
        # 保存
        success = True
        success &= self.save_json(HISTORY_JSON, history)
        success &= self.save_json(LATEST_JSON, history[:10])
        
        if success:
            logger.info("データ更新完了")
            return True
        else:
            logger.error("データ保存中にエラーが発生しました")
            return False

def main():
    """メイン実行関数"""
    try:
        fetcher = Loto6DataFetcher()
        success = fetcher.update_data()
        
        if success:
            logger.info("=== データ更新成功 ===")
            sys.exit(0)
        else:
            logger.error("=== データ更新失敗 ===")
            sys.exit(1)
            
    except KeyboardInterrupt:
        logger.info("処理が中断されました")
        sys.exit(1)
    except Exception as e:
        logger.error(f"予期しないエラー: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
