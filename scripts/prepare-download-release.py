#!/usr/bin/env python3
"""Preserve the current NAPRAWNIK download page while replacing its APK and SHA-256."""
import argparse
import hashlib
import re
import urllib.parse
import urllib.request
from html.parser import HTMLParser
from pathlib import Path

BASE = "https://naprawnik-download.pages.dev/"
HOST = urllib.parse.urlparse(BASE).netloc


class Assets(HTMLParser):
    def __init__(self):
        super().__init__()
        self.urls = set()

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if a.get("src"):
            self.urls.add(a["src"])
        if tag == "link" and a.get("href") and any(x in (a.get("rel") or "").lower().split() for x in ("stylesheet", "icon", "manifest", "preload")):
            self.urls.add(a["href"])


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "NAPRAWNIK-release-bot/1.0"})
    with urllib.request.urlopen(req, timeout=30) as response:
        return response.read()


def local_url(raw, base):
    if not raw or raw.startswith(("data:", "javascript:", "mailto:", "tel:")):
        return None
    url = urllib.parse.urljoin(base, raw)
    p = urllib.parse.urlparse(url)
    if p.scheme not in ("http", "https") or p.netloc != HOST or p.path.rstrip("/").endswith("app-debug.apk") or not p.path.strip("/"):
        return None
    return urllib.parse.urlunparse((p.scheme, p.netloc, p.path, "", p.query, ""))


def save(url, out):
    path = out / urllib.parse.unquote(urllib.parse.urlparse(url).path).lstrip("/")
    path.parent.mkdir(parents=True, exist_ok=True)
    data = get(url)
    path.write_bytes(data)
    return data


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apk", required=True, type=Path)
    ap.add_argument("--output", type=Path, default=Path("site"))
    args = ap.parse_args()
    if not args.apk.is_file() or args.apk.stat().st_size < 100000:
        raise SystemExit("APK missing or too small")
    apk = args.apk.read_bytes()
    digest = hashlib.sha256(apk).hexdigest()
    html = get(BASE).decode("utf-8")
    if "Raport VirusTotal" not in html or "SHA-256" not in html or "app-debug.apk" not in html:
        raise SystemExit("Download page is missing expected sections; refusing deployment")
    html, count = re.subn(r"(?is)(SHA-256.{0,700}?)([a-f0-9]{64})",
                          lambda m: m.group(1) + digest, html, count=1)
    if count != 1:
        raise SystemExit("Could not safely update exactly one SHA-256 checksum")
    args.output.mkdir(parents=True, exist_ok=True)
    (args.output / "index.html").write_text(html, encoding="utf-8")
    parser = Assets()
    parser.feed(html)
    urls = set()
    for raw in parser.urls:
        url = local_url(raw, BASE)
        if url:
            urls.add(url)
    for raw in re.findall(r"""url\(\s*['"]?([^)'"]+)""", html, flags=re.I):
        url = local_url(raw, BASE)
        if url:
            urls.add(url)
    pending = list(urls)
    seen = set()
    while pending:
        url = pending.pop()
        if url in seen:
            continue
        seen.add(url)
        data = save(url, args.output)
        if urllib.parse.urlparse(url).path.lower().endswith(".css"):
            css = data.decode("utf-8", errors="ignore")
            for raw in re.findall(r"""url\(\s*['"]?([^)'"]+)""", css, flags=re.I):
                nested = local_url(raw, url)
                if nested and nested not in seen:
                    pending.append(nested)
    (args.output / "app-debug.apk").write_bytes(apk)
    (args.output / "app-debug.apk.sha256").write_text(digest + "  app-debug.apk\n", encoding="utf-8")
    print("Prepared download site; APK SHA-256:", digest)
    print("Preserved existing page HTML, images, CSS and VirusTotal section.")


if __name__ == "__main__":
    main()
