#!/usr/bin/env python3
"""Render selected PDF pages into compact contact sheets for visual review."""

from __future__ import annotations

import argparse
import json
import math
import re
import shutil
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Render a deterministic standard sample or explicit exhaustive PDF review set."
    )
    parser.add_argument("pdf", type=Path, help="PDF to review")
    parser.add_argument(
        "--output-dir",
        type=Path,
        help="Output directory; defaults to <pdf-stem>-review beside the PDF",
    )
    parser.add_argument(
        "--page",
        action="append",
        type=int,
        default=[],
        help="Add a 1-based high-risk page to the standard sample; repeat as needed",
    )
    parser.add_argument(
        "--all-pages",
        action="store_true",
        help="Render every page for explicitly triggered exhaustive review",
    )
    parser.add_argument(
        "--standard-count",
        type=int,
        default=6,
        help="Number of evenly distributed automatic sample pages in standard mode",
    )
    parser.add_argument("--dpi", type=int, default=110, help="Rasterization DPI")
    parser.add_argument("--columns", type=int, default=3, help="Contact-sheet columns")
    parser.add_argument(
        "--max-sheet-pages",
        type=int,
        default=12,
        help="Maximum pages per contact sheet",
    )
    parser.add_argument(
        "--thumbnail-width",
        type=int,
        default=320,
        help="Maximum page thumbnail width in pixels",
    )
    parser.add_argument(
        "--manifest",
        type=Path,
        help="Manifest path; defaults to <output-dir>/review-manifest.json",
    )
    return parser.parse_args()


def run(command: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(command, text=True, capture_output=True, check=False)


def require_tool(name: str) -> None:
    if shutil.which(name) is None:
        raise SystemExit(f"Required tool is unavailable: {name}")


def pdf_page_count(pdf: Path) -> int:
    result = run(["pdfinfo", str(pdf)])
    if result.returncode != 0:
        raise SystemExit(f"pdfinfo failed: {result.stderr.strip()}")
    match = re.search(r"^Pages:\s+(\d+)\s*$", result.stdout, flags=re.MULTILINE)
    if not match:
        raise SystemExit("Could not read page count from pdfinfo output")
    return int(match.group(1))


def standard_pages(page_count: int, count: int) -> list[int]:
    if count < 2:
        raise SystemExit("--standard-count must be at least 2")
    if page_count <= count:
        return list(range(1, page_count + 1))
    points = {
        round(1 + index * (page_count - 1) / (count - 1))
        for index in range(count)
    }
    return sorted(points | {1, page_count})


def choose_pages(args: argparse.Namespace, page_count: int) -> tuple[str, list[int]]:
    invalid = sorted({page for page in args.page if page < 1 or page > page_count})
    if invalid:
        raise SystemExit(f"Page numbers outside 1..{page_count}: {invalid}")
    if args.all_pages:
        return "exhaustive", list(range(1, page_count + 1))
    selected = set(standard_pages(page_count, args.standard_count))
    selected.update(args.page)
    return "standard", sorted(selected)


def render_page(pdf: Path, page: int, output_dir: Path, dpi: int) -> Path:
    stem = output_dir / f"page-{page:04d}"
    result = run(
        [
            "pdftoppm",
            "-f",
            str(page),
            "-l",
            str(page),
            "-singlefile",
            "-r",
            str(dpi),
            "-png",
            str(pdf),
            str(stem),
        ]
    )
    if result.returncode != 0:
        raise SystemExit(f"pdftoppm failed for page {page}: {result.stderr.strip()}")
    image = stem.with_suffix(".png")
    if not image.is_file():
        raise SystemExit(f"Expected rendered page is missing: {image}")
    return image


def make_contact_sheet(
    items: list[tuple[int, Path]],
    output: Path,
    columns: int,
    thumbnail_width: int,
) -> None:
    label_height = 28
    padding = 12
    font = ImageFont.load_default()
    prepared: list[tuple[int, Image.Image]] = []
    max_height = 0

    for page, image_path in items:
        with Image.open(image_path) as source:
            image = source.convert("RGB")
        if image.width > thumbnail_width:
            height = round(image.height * thumbnail_width / image.width)
            image.thumbnail((thumbnail_width, height), Image.Resampling.LANCZOS)
        prepared.append((page, image))
        max_height = max(max_height, image.height)

    cell_width = thumbnail_width + padding * 2
    cell_height = max_height + label_height + padding * 2
    rows = math.ceil(len(prepared) / columns)
    sheet = Image.new("RGB", (cell_width * columns, cell_height * rows), "#e9edf2")
    draw = ImageDraw.Draw(sheet)

    for index, (page, image) in enumerate(prepared):
        row, column = divmod(index, columns)
        x0 = column * cell_width
        y0 = row * cell_height
        image_x = x0 + (cell_width - image.width) // 2
        image_y = y0 + padding + label_height
        draw.text((x0 + padding, y0 + padding), f"Page {page}", fill="#111827", font=font)
        sheet.paste(image, (image_x, image_y))

    output.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output, format="JPEG", quality=86, optimize=True)


def main() -> int:
    args = parse_args()
    require_tool("pdfinfo")
    require_tool("pdftoppm")

    pdf = args.pdf.expanduser().resolve()
    if not pdf.is_file():
        raise SystemExit(f"PDF does not exist: {pdf}")
    if args.columns < 1 or args.max_sheet_pages < 1 or args.thumbnail_width < 80:
        raise SystemExit("columns and max-sheet-pages must be positive; thumbnail-width must be at least 80")

    output_dir = (
        args.output_dir.expanduser().resolve()
        if args.output_dir
        else pdf.with_name(f"{pdf.stem}-review")
    )
    pages_dir = output_dir / "pages"
    sheets_dir = output_dir / "sheets"
    pages_dir.mkdir(parents=True, exist_ok=True)
    sheets_dir.mkdir(parents=True, exist_ok=True)

    page_count = pdf_page_count(pdf)
    mode, selected = choose_pages(args, page_count)
    rendered = [(page, render_page(pdf, page, pages_dir, args.dpi)) for page in selected]

    sheets: list[Path] = []
    for start in range(0, len(rendered), args.max_sheet_pages):
        batch = rendered[start : start + args.max_sheet_pages]
        sheet = sheets_dir / f"sheet-{len(sheets) + 1:02d}.jpg"
        make_contact_sheet(batch, sheet, args.columns, args.thumbnail_width)
        sheets.append(sheet)

    manifest = (
        args.manifest.expanduser().resolve()
        if args.manifest
        else output_dir / "review-manifest.json"
    )
    payload = {
        "schema_version": 1,
        "pdf": str(pdf),
        "mode": mode,
        "page_count": page_count,
        "selected_pages": selected,
        "rendered_pages": [str(path) for _, path in rendered],
        "contact_sheets": [str(path) for path in sheets],
        "settings": {
            "dpi": args.dpi,
            "columns": args.columns,
            "max_sheet_pages": args.max_sheet_pages,
            "thumbnail_width": args.thumbnail_width,
        },
    }
    manifest.parent.mkdir(parents=True, exist_ok=True)
    manifest.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(
        f"REVIEW {mode} pages={len(selected)}/{page_count} "
        f"sheets={len(sheets)} manifest={manifest}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
