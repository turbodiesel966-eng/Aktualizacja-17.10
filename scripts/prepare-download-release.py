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
SCANNED_SHA256 = "1e41d72e135366db7f92d282e9f9be90194a1b30b7a267bb2a65fe1ffa1894dd"
SCANNED_REPORT_URL = "https://www.virustotal.com/gui/file/" + SCANNED_SHA256


def add_virustotal_note(html, digest):
    html = re.sub(
        r"(?is)<!-- NAPRAWNIK_VT_NOTE_START -->.*?<!-- NAPRAWNIK_VT_NOTE_END -->",
        "",
        html,
    )
    if digest == SCANNED_SHA256:
        note = (
            '<!-- NAPRAWNIK_VT_NOTE_START -->'
            '<div class="vt-current-scan-note" role="note" '
            'style="margin:1rem 0;padding:1rem;border:1px solid #64748b;border-radius:12px">'
            '<p><strong>Raport VirusTotal dla aktualnego pliku APK</strong></p>'
            '<p>Suma SHA-256 pliku odpowiada raportowi z 28.10.2026. '
            '<a href="' + SCANNED_REPORT_URL + '" target="_blank" rel="noopener noreferrer">'
            'Otwórz pełny raport VirusTotal</a>.</p>'
            '<p>W pokazanym skanie część silników ma status „Undetected”, ale część zwróciła '
            '„Timeout” lub „Unable to process file type”. Te statusy nie są wykryciem złośliwego '
            'pliku, ale też nie potwierdzają, że wszystkie silniki sprawdziły plik poprawnie.</p>'
            '</div><!-- NAPRAWNIK_VT_NOTE_END -->'
        )
    else:
        note = (
            '<!-- NAPRAWNIK_VT_NOTE_START -->'
            '<div class="vt-current-scan-note" role="note" '
            'style="margin:1rem 0;padding:1rem;border:1px solid #64748b;border-radius:12px">'
            '<p><strong>Raport VirusTotal z poprzedniego skanu</strong></p>'
            '<p><a href="' + SCANNED_REPORT_URL + '" target="_blank" rel="noopener noreferrer">'
            'Otwórz raport z 28.10.2026</a>. Ten raport dotyczy pliku o SHA-256 '
            + SCANNED_SHA256 + ', a aktualny APK ma inną sumę kontrolną. '
            'Nie należy traktować go jako wyniku skanowania aktualnego pliku.</p>'
            '</div><!-- NAPRAWNIK_VT_NOTE_END -->'
        )
    heading = re.search(
        r"(?is)<h[1-6]\b[^>]*>.*?Raport\s+VirusTotal.*?</h[1-6]>",
        html,
    )
    if not heading:
        raise SystemExit("Could not find the VirusTotal heading; refusing to publish an unlinked scan")
    return html[:heading.end()] + note + html[heading.end():]




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
    ap.add_argument(
        "--require-existing-checksum",
        action="store_true",
        help="Fail unless the downloaded APK matches the checksum currently published on the page.",
    )
    args = ap.parse_args()
    if not args.apk.is_file() or args.apk.stat().st_size < 100000:
        raise SystemExit("APK missing or too small")
    apk = args.apk.read_bytes()
    digest = hashlib.sha256(apk).hexdigest()
    html = get(BASE).decode("utf-8")
    if "Raport VirusTotal" not in html or "SHA-256" not in html or "app-debug.apk" not in html:
        raise SystemExit("Download page is missing expected sections; refusing deployment")
    if args.require_existing_checksum:
        existing = re.search(r"(?is)SHA-256.{0,700}?([a-f0-9]{64})", html)
        if not existing or existing.group(1) != digest:
            raise SystemExit("Downloaded APK does not match the checksum currently published on the page")
    html = add_virustotal_note(html, digest)
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
