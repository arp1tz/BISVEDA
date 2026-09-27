import urllib.request
import json
import time

time.sleep(1)

# Test Home Page
url_home = "http://localhost:3000/"
try:
    with urllib.request.urlopen(url_home) as response:
        html = response.read().decode("utf-8")
        has_bis = "BISVEDA" in html
        print(f"Home Page Status: {response.status} (Length: {len(html)} bytes, Contains BISVEDA: {has_bis})")
except Exception as e:
    print("Home request failed:", e)

url_chat = "http://localhost:3000/api/chat"

def test_query(q):
    req = urllib.request.Request(
        url_chat,
        data=json.dumps({"query": q}).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req) as resp:
        res = json.loads(resp.read().decode("utf-8"))
        return res

# Test 1: Flagship Query
print("\n--- TEST 1: Flagship Query (Stainless Steel Cooker) ---")
res1 = test_query("I manufacture domestic pressure cookers in stainless steel")
print("Outcome:", res1.get("outcome"))
print("Confidence Score:", res1.get("confidenceScore"))
recs = res1.get("recommendations", [])
print(f"Recommendations count: {len(recs)}")
if recs:
    top = recs[0]
    print("Top Standard:", top.get("standardNumber"), "-", top.get("title"))
    print("Applicability:", top.get("applicability"), "->", top.get("applicabilityReason"))
    print("Testing Clauses count:", len(top.get("testingClauses", [])))
print("QCO Alert:", res1.get("qcoAlert"))

# Test 2: Disambiguation Query
print("\n--- TEST 2: Disambiguation Query (water bottle) ---")
res2 = test_query("water bottle")
print("Outcome:", res2.get("outcome"))
dis = res2.get("disambiguation", {})
print("Is Ambiguous:", dis.get("isAmbiguous"))
print("Question:", dis.get("question"))
print("Options:", [opt["label"] for opt in dis.get("options", [])])

# Test 3: Out-of-scope Abstention Query
print("\n--- TEST 3: Out-of-Scope Query (Nuclear Thermos) ---")
res3 = test_query("Can I sell a self-heating nuclear thermos in the bazaar?")
print("Outcome:", res3.get("outcome"))
print("Confidence Score:", res3.get("confidenceScore"))
print("Synthesis snippet:", res3.get("synthesis")[:150])
