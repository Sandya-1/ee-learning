#!/usr/bin/env python3
"""Index EE HTML help documents into a searchable JSON file.

The script scans a folder of HTML help files, copies them (and their assets)
into ``public/help/`` so they are served as static files, and writes an index
to ``src/data/help/help-index.json``. The index powers global search and lets test
cases link to relevant help pages.
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
from pathlib import Path

from bs4 import BeautifulSoup

HTML_EXTENSIONS = (".htm", ".html")


def main() -> None:
    args = parse_args()
    source = Path(args.source).resolve()
    public_dir = Path(args.public_dir).resolve()
    output = Path(args.output).resolve()

    if not source.exists():
        raise SystemExit(f"Help source folder not found: {source}")

    if args.copy_assets:
        copy_help_tree(source, public_dir)

    entries = [build_entry(path, source) for path in iter_html(source)]
    entries.sort(key=lambda entry: entry["path"])

    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(
        json.dumps(entries, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print(f"Indexed {len(entries)} help documents into {output}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Index EE HTML help documents")
    parser.add_argument(
        "source",
        help="Path to the help folder containing HTML files and assets",
    )
    parser.add_argument(
        "--public-dir",
        default="public/help",
        help="Destination for static help files (default: public/help)",
    )
    parser.add_argument(
        "--output",
        default="src/data/help/help-index.json",
        help="Path to write the help index JSON",
    )
    parser.add_argument(
        "--no-copy-assets",
        dest="copy_assets",
        action="store_false",
        help="Skip copying the help folder into public/help",
    )
    return parser.parse_args()


def copy_help_tree(source: Path, public_dir: Path) -> None:
    if public_dir.exists():
        shutil.rmtree(public_dir)
    shutil.copytree(source, public_dir)


def iter_html(root: Path) -> list[Path]:
    return sorted(
        path
        for path in root.rglob("*")
        if path.is_file() and path.suffix.lower() in HTML_EXTENSIONS
    )


def build_entry(path: Path, source: Path) -> dict[str, object]:
    soup = BeautifulSoup(path.read_text(encoding="utf-8", errors="ignore"), "html.parser")

    for tag in soup(["script", "style"]):
        tag.decompose()

    title = extract_title(soup, path)
    text = normalize_whitespace(soup.get_text(" "))
    relative = path.relative_to(source).as_posix()

    return {
        "id": slugify(relative),
        "title": title,
        "path": f"help/{relative}",
        "text": text,
        "tags": infer_tags(title),
    }


def extract_title(soup: BeautifulSoup, path: Path) -> str:
    if soup.title and soup.title.string:
        title = soup.title.string.strip()
        if title:
            return title

    heading = soup.find(["h1", "h2"])
    if heading:
        text = normalize_whitespace(heading.get_text(" "))
        if text:
            return text

    return path.stem


def infer_tags(title: str) -> list[str]:
    words = re.findall(r"[A-Za-z0-9+.]+", title)
    tags = [word for word in words if len(word) > 2]
    return list(dict.fromkeys(tags))[:6]


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", value.lower()).strip("-")
    return slug or "help"


def normalize_whitespace(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


if __name__ == "__main__":
    main()
