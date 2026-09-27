#!/usr/bin/env python3
"""
BISVEDA — Internet Archive BIS Standards Downloader
Strictly downloads authentic Bureau of Indian Standards PDFs from archive.org
Target Domains: Toys, Helmets, Gold / Hallmarking

Usage:
  python scripts/download_bis_pdfs.py [--domains toys,helmets,gold] [--max-per-domain 5] [--output-dir "example docs uploaded by employees"]
"""

import os
import sys
import re
import json
import time
import argparse
import requests
from pathlib import Path

# Domains and their targeted query keywords
DOMAIN_QUERIES = {
    "toys": {
        "label": "Toys & Children Safety",
        "keywords": '(toy OR toys OR plaything OR 9873 OR 15644)',
        "exclude_keywords": ['dental', 'mirror', 'medical', 'cement'],
    },
    "helmets": {
        "label": "Protective Helmets",
        "keywords": '(helmet OR helmets OR headgear OR 4151 OR 2745 OR 2925 OR 9562)',
        "exclude_keywords": ['cement'],
    },
    "gold": {
        "label": "Gold & Hallmarking",
        "keywords": '(gold OR hallmark OR hallmarking OR jewellery OR jewelry OR 1417 OR 1418 OR 15820 OR 2790)',
        "exclude_keywords": ['silver thread', 'embroidery', 'cement', 'hydraulic'],
    },
}

ARCHIVE_SEARCH_URL = "https://archive.org/advancedsearch.php"
ARCHIVE_METADATA_URL = "https://archive.org/metadata/{identifier}"
ARCHIVE_DOWNLOAD_URL = "https://archive.org/download/{identifier}/{filename}"


def sanitize_filename(name: str) -> str:
    """Creates a clean, filesystem-safe filename."""
    # Remove invalid characters
    clean = re.sub(r'[\\/*?:"<>|]', "", name)
    # Replace whitespace and separators with underscores
    clean = re.sub(r'[\s\-:]+', "_", clean)
    clean = re.sub(r'_+', "_", clean).strip("_")
    return clean[:120]


def search_archive_items(domain_key: str, max_items: int = 10) -> list:
    """Searches archive.org for Bureau of Indian Standards documents matching domain."""
    domain_config = DOMAIN_QUERIES.get(domain_key)
    if not domain_config:
        print(f"[-] Unknown domain: {domain_key}")
        return []

    query = f'creator:"Bureau of Indian Standards" AND {domain_config["keywords"]}'
    params = {
        "q": query,
        "fl[]": ["identifier", "title", "year", "publicdate", "downloads", "description"],
        "sort[]": "downloads desc",
        "rows": str(max_items * 3),  # Fetch extra to filter out exclusions
        "output": "json"
    }

    try:
        resp = requests.get(ARCHIVE_SEARCH_URL, params=params, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        docs = data.get("response", {}).get("docs", [])
    except Exception as e:
        print(f"[-] Error querying archive.org for {domain_key}: {e}")
        return []

    filtered = []
    excludes = [ex.lower() for ex in domain_config.get("exclude_keywords", [])]

    for d in docs:
        title = (d.get("title") or "").strip()
        title_lower = title.lower()

        # Check exclusions
        if any(ex in title_lower for ex in excludes):
            continue

        filtered.append({
            "identifier": d.get("identifier"),
            "title": title,
            "year": d.get("year"),
            "downloads": d.get("downloads", 0),
            "domain": domain_key
        })

        if len(filtered) >= max_items:
            break

    return filtered


def get_best_pdf_file(identifier: str) -> tuple:
    """
    Fetches item metadata from archive.org and identifies the authentic BIS PDF.
    Returns (filename, size_bytes, download_url) or (None, None, None).
    """
    url = ARCHIVE_METADATA_URL.format(identifier=identifier)
    try:
        resp = requests.get(url, timeout=30)
        resp.raise_for_status()
        meta = resp.json()
    except Exception as e:
        print(f"    [-] Failed to fetch metadata for {identifier}: {e}")
        return None, None, None

    files = meta.get("files", [])
    pdf_candidates = []

    for f in files:
        fname = f.get("name", "")
        fmt = (f.get("format") or "").lower()

        # Look for PDF files
        if fname.lower().endswith(".pdf"):
            # Avoid derived/ocr text files if primary PDF is available
            is_text_pdf = "text pdf" in fmt
            size = int(f.get("size") or 0)
            pdf_candidates.append({
                "name": fname,
                "size": size,
                "is_text_pdf": is_text_pdf,
                "format": fmt
            })

    if not pdf_candidates:
        return None, None, None

    # Sort priority:
    # 1. Text PDF format
    # 2. Main item PDF (usually matching identifier or is.XXXX)
    # 3. Largest file size (avoiding tiny thumbnails)
    def rank_pdf(item):
        score = 0
        name = item["name"].lower()
        if item["is_text_pdf"]:
            score += 10
        if identifier.replace("gov.in.", "").replace("gov.law.", "") in name:
            score += 5
        if not name.endswith("_text.pdf"):
            score += 2
        return (score, item["size"])

    pdf_candidates.sort(key=rank_pdf, reverse=True)
    best = pdf_candidates[0]
    best_name = best["name"]
    best_size = best["size"]
    download_url = ARCHIVE_DOWNLOAD_URL.format(identifier=identifier, filename=best_name)

    return best_name, best_size, download_url


def download_file(url: str, dest_path: Path, expected_size: int = 0) -> bool:
    """Streams file download with progress display."""
    try:
        resp = requests.get(url, stream=True, timeout=60)
        resp.raise_for_status()

        total_size = int(resp.headers.get("content-length", 0)) or expected_size
        downloaded = 0
        chunk_size = 64 * 1024  # 64 KB chunks

        with open(dest_path, "wb") as f:
            for chunk in resp.iter_content(chunk_size=chunk_size):
                if chunk:
                    f.write(chunk)
                    downloaded += len(chunk)
                    if total_size > 0:
                        pct = int((downloaded / total_size) * 100)
                        mb = downloaded / (1024 * 1024)
                        total_mb = total_size / (1024 * 1024)
                        print(f"\r    Downloading: {mb:.1f}MB / {total_mb:.1f}MB ({pct}%)", end="", flush=True)
                    else:
                        mb = downloaded / (1024 * 1024)
                        print(f"\r    Downloading: {mb:.1f}MB", end="", flush=True)

        print(" -> Done!")
        return True
    except Exception as e:
        print(f"\n    [-] Download failed: {e}")
        if dest_path.exists():
            dest_path.unlink()
        return False


def main():
    parser = argparse.ArgumentParser(description="Download authentic BIS PDFs from Internet Archive.")
    parser.add_argument(
        "--domains",
        default="toys,helmets,gold",
        help="Comma-separated domains to download: toys,helmets,gold (default: all)"
    )
    parser.add_argument(
        "--max-per-domain",
        type=int,
        default=4,
        help="Maximum PDFs to download per domain (default: 4)"
    )
    parser.add_argument(
        "--output-dir",
        default="example docs uploaded by employees",
        help="Target directory for downloaded PDFs"
    )
    parser.add_argument(
        "--list-only",
        action="store_true",
        help="List available documents without downloading"
    )

    args = parser.parse_args()
    target_domains = [d.strip().lower() for d in args.domains.split(",") if d.strip()]
    out_dir = Path(args.output_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    manifest_path = out_dir / "download_manifest.json"
    manifest = []
    if manifest_path.exists():
        try:
            with open(manifest_path, "r", encoding="utf-8") as f:
                manifest = json.load(f)
        except Exception:
            manifest = []

    downloaded_ids = {m.get("identifier") for m in manifest}

    print("=" * 70)
    print("  BISVEDA — Internet Archive BIS Standards Downloader")
    print(f"  Target Domains: {', '.join(target_domains)}")
    print(f"  Max Per Domain: {args.max_per_domain}")
    print(f"  Output Directory: {out_dir}")
    print("=" * 70)

    total_downloaded = 0
    total_skipped = 0

    for domain in target_domains:
        if domain not in DOMAIN_QUERIES:
            print(f"\n[!] Warning: Unknown domain '{domain}'. Available: {list(DOMAIN_QUERIES.keys())}")
            continue

        label = DOMAIN_QUERIES[domain]["label"]
        print(f"\n[+] Searching domain: {label.upper()} ({domain})")
        items = search_archive_items(domain, max_items=args.max_per_domain)

        if not items:
            print("    No items found.")
            continue

        print(f"    Found {len(items)} matching standard(s):")
        for idx, item in enumerate(items, 1):
            ident = item["identifier"]
            title = item["title"]
            print(f"    {idx}. [{ident}] {title}")

            if args.list_only:
                continue

            # Check if already in manifest
            existing_entry = next((m for m in manifest if m.get("identifier") == ident), None)
            if existing_entry and (out_dir / existing_entry.get("saved_filename", "")).exists():
                print(f"       -> Already downloaded ({existing_entry.get('saved_filename')}), skipping.")
                total_skipped += 1
                continue

            # Fetch PDF file URL
            pdf_name, pdf_size, download_url = get_best_pdf_file(ident)
            if not download_url:
                print("       -> [!] No suitable PDF found for this item.")
                continue

            # Build safe filename
            safe_title = sanitize_filename(title)
            final_filename = f"{safe_title}.pdf"
            dest_file = out_dir / final_filename

            if dest_file.exists() and dest_file.stat().st_size > 10000:
                print(f"       -> File already exists ({final_filename}), skipping.")
                total_skipped += 1
                continue

            print(f"       Downloading {pdf_name} ({pdf_size / (1024*1024):.1f} MB)...")
            success = download_file(download_url, dest_file, expected_size=pdf_size)

            if success:
                total_downloaded += 1
                record = {
                    "identifier": ident,
                    "title": title,
                    "domain": domain,
                    "saved_filename": final_filename,
                    "original_pdf_name": pdf_name,
                    "size_bytes": dest_file.stat().st_size,
                    "source_url": download_url,
                    "download_date": time.strftime("%Y-%m-%d %H:%M:%S")
                }
                manifest.append(record)
                # Save manifest iteratively
                with open(manifest_path, "w", encoding="utf-8") as f:
                    json.dump(manifest, f, indent=2)

            time.sleep(1.0)  # Gentle rate limit for Internet Archive

    print("\n" + "=" * 70)
    print(f"  Download Summary:")
    print(f"  New downloads: {total_downloaded}")
    print(f"  Already existed: {total_skipped}")
    print(f"  Total in manifest: {len(manifest)}")
    print(f"  Manifest path: {manifest_path}")
    print("=" * 70)


if __name__ == "__main__":
    main()
