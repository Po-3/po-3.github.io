# pip install pytrends pandas
from pytrends.request import TrendReq
import pandas as pd, json, datetime

KW_MAP = {
    "loto6":    "ロト6",
    "miniloto": "ミニロト",
    "loto7":    "ロト7",
}

# 直近7日・日本（JP）を1時間解像度で取得 → 直近24h平均を0..100でスコア化
pytrends = TrendReq(hl='ja-JP', tz=540)
pytrends.build_payload(list(KW_MAP.values()), geo='JP', timeframe='now 7-d')
df = pytrends.interest_over_time()
if 'isPartial' in df.columns:
    df = df.drop(columns=['isPartial'])

cut = datetime.datetime.utcnow() - datetime.timedelta(hours=24)

# index が tz-naive の場合は一度 tz_localize する
if df.index.tz is None:
    df.index = df.index.tz_localize("UTC")

df_24 = df[df.index >= pd.Timestamp(cut, tz="UTC")]

result = {"since_utc": cut.isoformat(timespec='seconds') + "Z", "metrics": {}}
for key, kw in KW_MAP.items():
    s = df_24[kw] if kw in df_24.columns else pd.Series(dtype=int)
    if s.empty:
        mean, score = 0.0, 0
    else:
        mean = float(s.mean())
        score = round(min(100, mean))  # 簡易に0..100へ
    result["metrics"][key] = {"mean": round(mean, 1), "score": int(score)}

print(json.dumps(result, ensure_ascii=False, indent=2))
