# pip install pytrends pandas
from pytrends.request import TrendReq
import pandas as pd, json, datetime

KW_MAP = {
    "loto6":    "ロト6",
    "miniloto": "ミニロト",
    "loto7":    "ロト7",
}

# 直近7日・日本（JP）・1時間解像度で取得し、直近24hの平均を0..100に丸め
pytrends = TrendReq(hl='ja-JP', tz=540)
pytrends.build_payload(list(KW_MAP.values()), geo='JP', timeframe='now 7-d')
df = pytrends.interest_over_time()
if 'isPartial' in df.columns:
    df = df.drop(columns=['isPartial'])

# 直近24hのみ抽出（UTC基準）
cut = datetime.datetime.utcnow() - datetime.timedelta(hours=24)
df_24 = df[df.index.tz_convert('UTC') >= pd.Timestamp(cut, tz='UTC')]

result = {"since_utc": cut.isoformat(timespec='seconds') + "Z", "metrics": {}}

for key, kw in KW_MAP.items():
    s = df_24[kw] if kw in df_24.columns else pd.Series(dtype=int)
    if s.empty:
        mean = 0.0
        score = 0
    else:
        mean = float(s.mean())
        score = round(min(100, mean))  # 0..100に丸め（簡易）
    result["metrics"][key] = {"mean": round(mean, 1), "score": int(score)}

print(json.dumps(result, ensure_ascii=False, indent=2))