import json, statistics, urllib.request
from collections import Counter
GOLDSKY = ("https://api.goldsky.com/api/public/"
           "project_cmq7kbyqt81p501xi7h0wdeuh/subgraphs/p2pme-subgraph/prod/gn")
H = {"content-type": "application/json", "user-agent": "curl/8.7.1"}
def gql(q):
    req = urllib.request.Request(GOLDSKY, data=json.dumps({"query": q}).encode(), headers=H)
    r = json.load(urllib.request.urlopen(req, timeout=60))
    if "errors" in r: raise SystemExit(str(r["errors"])[:500])
    return r["data"]

F = ("id currency type status usdcAmount fiatAmount disputeStatus disputeFaultType "
     "disputeSettledByAddr disputePlacedAt disputeSettledAt appealedAt "
     "appealedByMerchantAddress placedAt completedAt cancelledAt")
rows, last = [], ""
while True:
    r = gql('{orders_collection(first:1000, orderBy:id, where:{id_gt:"%s", disputePlacedAt_gt:"0"}){%s}}' % (last, F))["orders_collection"]
    if not r: break
    rows += r; last = r[-1]["id"]
    if len(r) < 1000: break
print(f"TOTAL disputas historicas: {len(rows):,}")

def cur(h):
    return bytes.fromhex(h[2:]).rstrip(b"\x00").decode(errors="replace")
print("por moneda:", Counter(cur(x["currency"]) for x in rows).most_common())
print("por tipo(0buy 1sell 2pay):", Counter(x["type"] for x in rows).most_common())
print("status final(3 comp 4 canc):", Counter(x["status"] for x in rows).most_common())
print("disputeStatus:", Counter(str(x["disputeStatus"]) for x in rows).most_common())
print("faultType:", Counter(str(x["disputeFaultType"]) for x in rows).most_common())
print("settledBy (top):", Counter(str(x["disputeSettledByAddr"]).lower() for x in rows).most_common(8))
print("apeladas:", sum(1 for x in rows if x.get("appealedAt") and int(x["appealedAt"])>0))
w = sorted(int(x["disputeSettledAt"])-int(x["disputePlacedAt"]) for x in rows
           if x.get("disputeSettledAt") and int(x["disputeSettledAt"])>0)
if w:
    print(f"resueltas={len(w):,}/{len(rows):,}  mediana={statistics.median(w)/3600:.1f}h  "
          f"p90={w[int(len(w)*0.9)]/3600:.1f}h  max={max(w)/86400:.1f}d  min={min(w)}s")
sinres = [x for x in rows if not (x.get("disputeSettledAt") and int(x["disputeSettledAt"])>0)]
print(f"SIN resolver: {len(sinres):,} ({len(sinres)/len(rows)*100:.1f}%)")
# totales de la red para el denominador
tot, last2 = 0, ""
while True:
    r = gql('{orders_collection(first:1000, orderBy:id, where:{id_gt:"%s"}){id}}' % last2)["orders_collection"]
    if not r: break
    tot += len(r); last2 = r[-1]["id"]
    if len(r) < 1000: break
print(f"TOTAL ordenes en la red: {tot:,}  -> tasa de disputa = {len(rows)/tot*100:.3f}%")
