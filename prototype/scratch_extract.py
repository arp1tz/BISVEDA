import urllib.request
import json

base_url = "https://bis-standards-client.vercel.app"

paths_to_test = [
    "/",
    "/standards",
    "/standards/is-2347",
    "/compare",
    "/research",
    "/certification",
    "/testing",
    "/consumer",
    "/contact",
    "/about",
    "/api/search",
    "/api/chat",
    "/api/standards",
    "/api/query",
]

results = {}
for p in paths_to_test:
    try:
        url = f"{base_url}{p}"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=8) as resp:
            code = resp.getcode()
            content = resp.read().decode("utf-8", errors="ignore")
            title = ""
            if "<title>" in content:
                title = content.split("<title>")[1].split("</title>")[0]
            results[p] = {"status": code, "length": len(content), "title": title}
    except urllib.error.HTTPError as e:
        results[p] = {"status": e.code, "error": str(e)}
    except Exception as e:
        results[p] = {"status": "ERROR", "error": str(e)}

print(json.dumps(results, indent=2))
