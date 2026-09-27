import urllib.request
from bs4 import BeautifulSoup
import json
import re

base_url = "https://bis-standards-client.vercel.app"

pages = {
    "landing": "/",
    "standards_catalog": "/standards",
    "standard_detail_is2347": "/standards/is-2347",
    "certification": "/certification",
    "testing": "/testing",
    "about": "/about",
    "contact": "/contact",
}

extracted = {}

for name, path in pages.items():
    try:
        url = f"{base_url}{path}"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            html = resp.read().decode("utf-8", errors="ignore")
            # Parse with basic regex/soup
            # Find all headings
            h1s = re.findall(r'<h1[^>]*>(.*?)</h1>', html, re.DOTALL)
            h2s = re.findall(r'<h2[^>]*>(.*?)</h2>', html, re.DOTALL)
            h3s = re.findall(r'<h3[^>]*>(.*?)</h3>', html, re.DOTALL)
            
            # Clean html tags
            clean = lambda items: [re.sub(r'<[^>]+>', '', x).strip() for x in items if x.strip()]
            
            # Find buttons and navigation links
            nav_links = re.findall(r'<a[^>]*href=["\']([^"\']+)["\'][^>]*>(.*?)</a>', html, re.DOTALL)
            clean_links = [(href, re.sub(r'<[^>]+>', '', text).strip()) for href, text in nav_links if re.sub(r'<[^>]+>', '', text).strip()]
            
            extracted[name] = {
                "url": url,
                "h1": clean(h1s),
                "h2": clean(h2s),
                "h3": clean(h3s)[:10],
                "sample_links": clean_links[:15],
                "total_html_length": len(html),
            }
    except Exception as e:
        extracted[name] = {"error": str(e)}

with open("c:/BISVEDA/prototype/competitor_analysis.json", "w", encoding="utf-8") as f:
    json.dump(extracted, f, indent=2)

print("Saved competitor analysis to prototype/competitor_analysis.json")
