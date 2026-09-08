#!/usr/bin/env python3
"""Deterministic PDF checks with a bounded summary and JSON artifact."""

from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
from pathlib import Path

STATUSES = {"PASS", "WARN", "FAIL", "UNKNOWN"}


def run_tool(name: str, *args: str) -> tuple[int, str, str] | None:
    if shutil.which(name) is None:
        return None
    result = subprocess.run([name, *args], capture_output=True, text=True, check=False)
    return result.returncode, result.stdout, result.stderr


def add(checks: list[dict], name: str, status: str, message: str, **evidence) -> None:
    assert status in STATUSES
    checks.append({"name": name, "status": status, "message": message, "evidence": evidence})


def parse_pdfinfo(text: str) -> dict[str, str]:
    values: dict[str, str] = {}
    for line in text.splitlines():
        if ":" in line:
            key, value = line.split(":", 1)
            values[key.strip().lower()] = value.strip()
    return values


def overall_status(checks: list[dict]) -> str:
    statuses = {item["status"] for item in checks}
    if "FAIL" in statuses:
        return "FAIL"
    if "WARN" in statuses or "UNKNOWN" in statuses:
        return "WARN"
    return "PASS"


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Verify deterministic properties of a PDF")
    parser.add_argument("pdf", type=Path)
    parser.add_argument(
        "--profile",
        choices=("general", "text-document", "image-bearing", "publication"),
        default="general",
    )
    parser.add_argument("--report", type=Path)
    parser.add_argument("--min-pages", type=int, default=1)
    parser.add_argument("--max-pages", type=int)
    parser.add_argument("--expected-page-size", help="Case-insensitive substring, for example 'A4'")
    parser.add_argument("--expected-title")
    parser.add_argument("--expected-author")
    parser.add_argument("--min-images", type=int)
    parser.add_argument("--placeholder-regex", default=r"TODO|TBD|Lorem ipsum|\[placeholder\]")
    parser.add_argument("--strict", action="store_true", help="Exit non-zero for WARN as well as FAIL")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    pdf = args.pdf.resolve()
    report = args.report.resolve() if args.report else pdf.with_suffix(".verify.json")
    checks: list[dict] = []

    if not pdf.is_file():
        add(checks, "file", "FAIL", "PDF does not exist", path=str(pdf))
    else:
        header = pdf.read_bytes()[:5]
        add(
            checks,
            "signature",
            "PASS" if header == b"%PDF-" else "FAIL",
            "PDF header is valid" if header == b"%PDF-" else "Missing %PDF- header",
            header=header.decode("latin-1", errors="replace"),
        )

    info: dict[str, str] = {}
    info_result = run_tool("pdfinfo", str(pdf)) if pdf.is_file() else None
    if info_result is None:
        add(checks, "pdfinfo", "UNKNOWN", "pdfinfo is unavailable")
    elif info_result[0] != 0:
        add(checks, "pdfinfo", "FAIL", "pdfinfo could not parse the PDF", stderr=info_result[2])
    else:
        info = parse_pdfinfo(info_result[1])
        add(checks, "pdfinfo", "PASS", "PDF is parseable by pdfinfo")
        pages = int(info.get("pages", "0") or 0)
        page_ok = pages >= args.min_pages and (args.max_pages is None or pages <= args.max_pages)
        add(checks, "page-count", "PASS" if page_ok else "FAIL", f"pages={pages}", pages=pages)

        if args.expected_page_size:
            actual = info.get("page size", "")
            ok = args.expected_page_size.lower() in actual.lower()
            add(checks, "page-size", "PASS" if ok else "FAIL", actual or "Page size unavailable")

        for key, expected in (("title", args.expected_title), ("author", args.expected_author)):
            if expected is not None:
                actual = info.get(key, "")
                add(
                    checks,
                    f"metadata-{key}",
                    "PASS" if actual == expected else "FAIL",
                    f"expected={expected!r}, actual={actual!r}",
                )

    text_required = args.profile in {"text-document", "publication"}
    text_result = run_tool("pdftotext", str(pdf), "-") if pdf.is_file() else None
    if text_result is None:
        add(checks, "text-extraction", "UNKNOWN", "pdftotext is unavailable")
    elif text_result[0] != 0:
        add(checks, "text-extraction", "WARN", "pdftotext failed", stderr=text_result[2])
    else:
        extracted = text_result[1]
        has_text = bool(extracted.strip())
        add(
            checks,
            "text-presence",
            "PASS" if has_text or not text_required else "FAIL",
            f"characters={len(extracted.strip())}",
        )
        placeholders = sorted(set(re.findall(args.placeholder_regex, extracted, flags=re.IGNORECASE)))
        add(
            checks,
            "placeholders",
            "FAIL" if placeholders else "PASS",
            "Placeholder markers found" if placeholders else "No placeholder markers found",
            matches=placeholders,
        )

    fonts_required = args.profile in {"text-document", "publication"}
    fonts_result = run_tool("pdffonts", str(pdf)) if pdf.is_file() else None
    if fonts_result is None:
        add(checks, "fonts", "UNKNOWN", "pdffonts is unavailable")
    elif fonts_result[0] != 0:
        add(checks, "fonts", "WARN", "pdffonts failed", stderr=fonts_result[2])
    else:
        font_rows = [line for line in fonts_result[1].splitlines() if re.search(r"\s\d+\s+\d+\s*$", line)]
        ok = bool(font_rows) or not fonts_required
        add(checks, "fonts", "PASS" if ok else "FAIL", f"font_records={len(font_rows)}")

    min_images = args.min_images
    if min_images is None and args.profile == "image-bearing":
        min_images = 1
    if min_images is not None:
        images_result = run_tool("pdfimages", "-list", str(pdf)) if pdf.is_file() else None
        if images_result is None:
            add(checks, "images", "UNKNOWN", "pdfimages is unavailable")
        elif images_result[0] != 0:
            add(checks, "images", "WARN", "pdfimages failed", stderr=images_result[2])
        else:
            image_rows = [line for line in images_result[1].splitlines() if re.match(r"^\s*\d+\s+\d+\s+", line)]
            ok = len(image_rows) >= min_images
            add(checks, "images", "PASS" if ok else "FAIL", f"images={len(image_rows)}")

    overall = overall_status(checks)
    payload = {
        "schema_version": 1,
        "pdf": str(pdf),
        "profile": args.profile,
        "overall": overall,
        "checks": checks,
    }
    report.parent.mkdir(parents=True, exist_ok=True)
    report.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    counts = {status: sum(item["status"] == status for item in checks) for status in STATUSES}
    print(
        f"VERIFY {overall} pass={counts['PASS']} warn={counts['WARN']} "
        f"fail={counts['FAIL']} unknown={counts['UNKNOWN']} report={report}"
    )

    if overall == "FAIL" or (args.strict and overall != "PASS"):
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
