#!/usr/bin/env python3
"""Live page teardown for Finding 2 (depth gap).

Fetches one or more live URLs and reports the attributes the teardown table needs,
so the table is built from real data, not assumptions:
  - word count, H2 count
  - number of <table> elements (comparison tables)
  - images, embedded video
  - author byline / first-person signals
  - JSON-LD types present (BlogPosting, ItemList, FAQPage, SoftwareApplication,
    AggregateRating), datePublished / dateModified

Usage:
  python page_teardown.py https://example.com/tools/ai-image-generator \
                          https://competitor.com/best-x-tools
"""
import json
import re
import sys
from urllib.request import Request, urlopen

UA = {"User-Agent": "Mozilla/5.0 (compatible; ContentGapBot/1.0)"}


def fetch(url, timeout=25):
    req = Request(url, headers=UA)
    with urlopen(req, timeout=timeout) as r:
        return r.read().decode("utf-8", "ignore"), r.status


def jsonld_types(html):
    types = []
    for m in re.findall(r'<script[^>]+application/ld\+json[^>]*>(.*?)</script>',
                        html, re.DOTALL | re.IGNORECASE):
        try:
            data = json.loads(m.strip())
        except Exception:
            for t in re.findall(r'"@type"\s*:\s*"([^"]+)"', m):
                types.append(t)
            continue
        for obj in (data if isinstance(data, list) else [data]):
            if isinstance(obj, dict):
                t = obj.get("@type")
                if isinstance(t, list):
                    types += t
                elif t:
                    types.append(t)
    return sorted(set(types))


def teardown(url):
    try:
        html, status = fetch(url)
    except Exception as e:
        print(f"\n## {url}\n  FETCH FAILED: {e}")
        return
    text = re.sub(r"<script.*?</script>|<style.*?</style>", " ", html,
                  flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"<[^>]+>", " ", text)
    words = len(re.findall(r"\w+", text))
    h2 = len(re.findall(r"<h2\b", html, re.IGNORECASE))
    tables = len(re.findall(r"<table\b", html, re.IGNORECASE))
    imgs = len(re.findall(r"<img\b", html, re.IGNORECASE))
    video = bool(re.search(r"<video\b|youtube\.com/embed|youtu\.be|vimeo\.com", html, re.IGNORECASE))
    first_person = len(re.findall(r"\b(I|we|our|my|us)\b", text))
    author = bool(re.search(r'author|byline|written by|rel="author"', html, re.IGNORECASE))
    types = jsonld_types(html)
    has_date_mod = bool(re.search(r"dateModified", html))
    has_date_pub = bool(re.search(r"datePublished", html))

    print(f"\n## {url}  (HTTP {status})")
    print(f"  Word count (approx):   {words:,}")
    print(f"  H2 sections:           {h2}")
    print(f"  <table> elements:      {tables}")
    print(f"  Images:                {imgs}")
    print(f"  Embedded video:        {'yes' if video else 'no'}")
    print(f"  Author/byline present: {'yes' if author else 'no'}")
    print(f"  First-person mentions: {first_person}")
    print(f"  JSON-LD @types:        {', '.join(types) if types else 'NONE'}")
    print(f"  datePublished / dateModified: {has_date_pub} / {has_date_mod}")


def main():
    urls = sys.argv[1:]
    if not urls:
        sys.exit("Usage: python page_teardown.py <url> [url ...]")
    for u in urls:
        teardown(u)


if __name__ == "__main__":
    main()
