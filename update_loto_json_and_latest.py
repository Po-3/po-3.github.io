import requests
from bs4 import BeautifulSoup
import json
import os
import re
from datetime import datetime
import subprocess

BASE_DIR = "/Users/po-san/hatena/po-3.github.io"

# --- 設定 ---
CONFIGS = [
    {
        "name": "ロト6",
        "url": "https://takarakuji.rakuten.co.jp/backnumber/loto6/",
        "save_path": os.path.join(BASE_DIR, "loto6-data/loto6.json"),
        "num_cnt": 6,
        "bonus_keys": ["ボーナス数字"],
        "carry_key": "キャリーオーバー",
        "feature_func": "label_loto6"
    },
    {
        "name": "ミニロト",
        "url": "https://takarakuji.rakuten.co.jp/backnumber/mini/",
        "save_path": os.path.join(BASE_DIR, "miniloto-data/miniloto.json"),
        "num_cnt": 5,
        "bonus_keys": ["ボーナス数字"],
        "carry_key": None,
        "feature_func": "label_miniloto"
    },
    {
        "name": "ロト7",
        "url": "https://takarakuji.rakuten.co.jp/backnumber/loto7/",
        "save_path": os.path.join(BASE_DIR, "loto7-data/loto7.json"),
        "num_cnt": 7,
        "bonus_keys": ["BONUS数字1", "BONUS数字2"],
        "carry_key": "キャリーオーバー",
        "feature_func": "label_loto7"
    }
]

# --- ラベル判定ロジック（必ずリスト型で返す） ---
def label_loto6(nums, carry):
    labels = []
    nums_sorted = sorted(nums)
    if any(nums_sorted[i+1]-nums_sorted[i]==1 for i in range(len(nums_sorted)-1)):
        labels.append("連番あり")
    odd = sum(n % 2 == 1 for n in nums)
    even = len(nums) - odd
    if odd >= 4: labels.append("奇数多め")
    if even >= 4: labels.append("偶数多め")
    if odd == even: labels.append("バランス型")
    if len(set(n % 10 for n in nums)) < len(nums): labels.append("下一桁かぶり")
    total = sum(nums)
    if total < 114: labels.append("合計小さめ")
    if total > 151: labels.append("合計大きめ")
    if carry and int(str(carry).replace(',', '')) > 0:
        labels.append("キャリーあり")
    return labels if labels else ["なし"]

def label_miniloto(nums, carry=None):
    labels = []
    nums_sorted = sorted(nums)
    if any(nums_sorted[i+1]-nums_sorted[i]==1 for i in range(len(nums_sorted)-1)):
        labels.append("連番あり")
    odd = sum(n % 2 == 1 for n in nums)
    even = len(nums) - odd
    if odd >= 4: labels.append("奇数多め")
    if even >= 4: labels.append("偶数多め")
    if len(set(n % 10 for n in nums)) < len(nums): labels.append("下一桁かぶり")
    total = sum(nums)
    if total < 60: labels.append("合計小さめ")
    if total >= 80: labels.append("合計大きめ")
    return labels if labels else ["なし"]

def label_loto7(nums, carry):
    labels = []
    nums_sorted = sorted(nums)
    if any(nums_sorted[i+1]-nums_sorted[i]==1 for i in range(len(nums_sorted)-1)):
        labels.append("連番あり")
    odd = sum(n % 2 == 1 for n in nums)
    even = len(nums) - odd
    if odd >= 5: labels.append("奇数多め")
    if even >= 5: labels.append("偶数多め")
    if len(set(n % 10 for n in nums)) < len(nums): labels.append("下一桁かぶり")
    total = sum(nums)
    if total < 160: labels.append("合計小さめ")
    if total >= 160: labels.append("合計大きめ")
    if any(n < 10 for n in nums) and any(n > 30 for n in nums):
        labels.append("高低ミックス")
    if carry and int(str(carry).replace(',', '')) > 0:
        labels.append("キャリーあり")
    return labels if labels else ["なし"]

# --- 最新抽出＋更新処理 ---
def fetch_and_update(config):
    dir_path = os.path.dirname(config['save_path'])
    if not os.path.exists(dir_path):
        os.makedirs(dir_path)
    print(f"▼ {config['name']} データ取得中...")
    r = requests.get(config['url'])
    soup = BeautifulSoup(r.content, 'html.parser')
    table = soup.select_one('table.tblType02.tblNumberGuid')
    if not table:
        print(f"ERROR: テーブルが見つかりません: {config['url']}")
        return None
    trs = table.select('tbody > tr')
    records, i = [], 0
    while i < len(trs):
        if not trs[i].find_all('th'):
            i += 1
            continue
        round_text = trs[i].find_all('th')[1].text
        round_num = re.sub(r"\D", "", round_text)
        i += 1
        date_text = trs[i].find_all('td')[0].text.strip().replace(".", "/")
        i += 1
        tds = trs[i].find_all('td')
        nums = [int(tds[n].text.strip()) for n in range(config['num_cnt'])]
        bonus_nums = []
        if config['name'] == "ミニロト":
            bonus_nums = [tds[-1].text.strip()]
        elif config['name'] == "ロト7":
            i += 1
            bonus_tds = trs[i].find_all('td')
            bonus_nums = [bonus_tds[0].text.strip(), bonus_tds[1].text.strip()]
        else:
            i += 1
            bonus_tds = trs[i].find_all('td')
            bonus_nums = [bonus_tds[0].text.strip()]
        i += 1
        kou_su, shou_kin = [], []
        for _ in range({"ミニロト": 4, "ロト6": 5, "ロト7": 6}[config['name']]):
            kou_su.append(trs[i].find_all('td')[0].text.strip().replace(",", "").replace("口", "").replace("該当なし", "0"))
            shou_kin.append(trs[i].find_all('td')[1].text.strip().replace(",", "").replace("円", "").replace("該当なし", "0"))
            i += 1
        carry_val = "0"
        if config['carry_key']:
            carry_val = trs[i].find_all('td')[0].text.strip().replace(",", "").replace("円", "").replace("該当なし", "0")
            i += 1

        # 特徴ラベル（必ずlistで返す）
        features = globals()[config["feature_func"]](nums, carry_val)
        if not features or not isinstance(features, list):
            features = ["なし"]

        record = {
            "開催回": str(int(round_num)),
            "日付": date_text,
            **{f"第{j+1}数字": str(nums[j]) for j in range(config["num_cnt"])},
            **({ "ボーナス数字": bonus_nums[0] } if config["name"] == "ミニロト" else {}),
            **({ "BONUS数字1": bonus_nums[0], "BONUS数字2": bonus_nums[1] } if config["name"] == "ロト7" else { "ボーナス数字": bonus_nums[0] }),
            **{ f"{g+1}等口数": kou_su[g] for g in range(len(kou_su)) },
            **{ f"{g+1}等賞金": shou_kin[g] for g in range(len(shou_kin)) },
            "キャリーオーバー": carry_val if config["carry_key"] else "0",
            "特徴": features
        }
        records.append(record)
    if os.path.exists(config['save_path']):
        with open(config['save_path'], encoding="utf-8") as f:
            data = json.load(f)
    else:
        data = []
    ids = [d["開催回"] for d in data]
    new_add = 0
    for rec in records:
        if rec["開催回"] in ids:
            data[ids.index(rec["開催回"])] = rec
        else:
            data.append(rec)
            new_add += 1
    data.sort(key=lambda d: int(d["開催回"]))
    with open(config['save_path'], "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"→ {config['save_path']} を更新（新規追加 {new_add}件）")
    return {
        "type": config["name"],
        "date": data[-1]["日付"],
        "round": data[-1]["開催回"],
        "nums": [data[-1][f"第{i+1}数字"] for i in range(config["num_cnt"])],
        "bonus": data[-1][config["bonus_keys"][0]],
        "carry": int(data[-1]["キャリーオーバー"]) if "キャリーオーバー" in data[-1] else 0,
        "link": f"https://po-3.github.io/{os.path.basename(config['save_path']).replace('.json','')}-data/{os.path.basename(config['save_path'])}"
    }

# --- Git push処理（全json＋latest.json） ---
def git_push_all():
    REPO_DIR = os.path.dirname(os.path.abspath(__file__))
    os.chdir(REPO_DIR)
    subprocess.run(["git", "add", "."], check=False)
    subprocess.run(["git", "commit", "-m", "auto update: all loto JSONs"], check=False)
    subprocess.run(["git", "push", "origin", "main"], check=False)
    print("🚀 GitHubにpush完了")

# --- メイン処理 ---
if __name__ == "__main__":
    latest_candidates = []
    carry_loto6, carry_loto7 = 0, 0
    for conf in CONFIGS:
        latest = fetch_and_update(conf)
        if latest:
            latest_candidates.append(latest)
            if latest["type"] == "ロト6":
                carry_loto6 = latest.get("carry", 0)
            if latest["type"] == "ロト7":
                carry_loto7 = latest.get("carry", 0)

    # 最新回を日付で1件抽出して latest.json 生成
    latest = max(latest_candidates, key=lambda d: datetime.strptime(d["date"], "%Y/%m/%d"))
    latest["carry_loto6"] = carry_loto6
    latest["carry_loto7"] = carry_loto7

    # スクリプトと同じ場所に出力
    script_dir = os.path.dirname(os.path.abspath(__file__))
    latest_json_path = os.path.join(script_dir, "latest.json")
    with open(latest_json_path, "w", encoding="utf-8") as f:
        json.dump(latest, f, ensure_ascii=False, indent=2)
    print(f"✅ {latest_json_path} を生成完了！")

    git_push_all()