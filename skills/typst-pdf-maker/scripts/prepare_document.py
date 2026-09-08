#!/usr/bin/env python3
"""Prepare a portable Typst project from the skill-owned built-in assets."""

from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path

ASSET_DIR = Path(__file__).resolve().parent.parent / "assets"
THEME_ASSET = ASSET_DIR / "report-theme.typ"
REPORT_ENTRY_ASSET = ASSET_DIR / "report-entry.typ"
MARKDOWN_ENTRY_ASSET = ASSET_DIR / "markdown-entry.typ"


def typst_string_content(value: str) -> str:
    """Escape text inserted inside an existing Typst string."""
    return (
        value.replace("\\", "\\\\")
        .replace('"', '\\"')
        .replace("\r\n", "\\n")
        .replace("\r", "\\n")
        .replace("\n", "\\n")
    )


def ensure_assets_exist() -> None:
    missing = [
        path
        for path in (THEME_ASSET, REPORT_ENTRY_ASSET, MARKDOWN_ENTRY_ASSET)
        if not path.is_file()
    ]
    if missing:
        joined = ", ".join(str(path) for path in missing)
        raise SystemExit(f"Missing built-in asset(s): {joined}")


def prepare_output_dir(
    output_dir: Path,
    generated_names: tuple[str, ...],
    force: bool,
) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    conflicts = [
        output_dir / name
        for name in generated_names
        if (output_dir / name).exists()
    ]
    if conflicts and not force:
        joined = ", ".join(str(path) for path in conflicts)
        raise SystemExit(
            f"Refusing to overwrite existing file(s): {joined}. "
            "Use --force to replace them."
        )


def write_text(path: Path, text: str) -> None:
    path.write_text(text, encoding="utf-8")


def write_manifest(output_dir: Path, payload: dict[str, object]) -> None:
    write_text(
        output_dir / ".typst-document.json",
        json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
    )


def prepare_report(args: argparse.Namespace) -> None:
    output_dir = args.output_dir.resolve()
    generated = ("report-theme.typ", "main.typ", ".typst-document.json")
    prepare_output_dir(output_dir, generated, args.force)

    entry = REPORT_ENTRY_ASSET.read_text(encoding="utf-8")
    replacements = {
        "{{TITLE}}": typst_string_content(args.title),
        "{{SUBTITLE}}": typst_string_content(args.subtitle),
        "{{AUTHOR}}": typst_string_content(args.author),
    }
    for marker, value in replacements.items():
        entry = entry.replace(marker, value)

    unresolved = [marker for marker in replacements if marker in entry]
    if unresolved:
        raise SystemExit(f"Unresolved report placeholder(s): {', '.join(unresolved)}")

    shutil.copyfile(THEME_ASSET, output_dir / "report-theme.typ")
    write_text(output_dir / "main.typ", entry)
    write_manifest(
        output_dir,
        {
            "mode": "report",
            "entry": "main.typ",
            "theme": "report-theme.typ",
            "metadata": {
                "title": args.title,
                "subtitle": args.subtitle,
                "author": args.author,
            },
        },
    )
    print(output_dir / "main.typ")


def prepare_markdown(args: argparse.Namespace) -> None:
    source = args.source.resolve()
    if not source.is_file():
        raise SystemExit(f"Markdown source does not exist: {source}")
    if source.suffix.lower() not in {".md", ".markdown"}:
        raise SystemExit(f"Markdown source must use .md or .markdown: {source}")

    output_dir = args.output_dir.resolve()
    generated = (
        "report-theme.typ",
        "main.typ",
        "source.md",
        ".typst-document.json",
    )
    prepare_output_dir(output_dir, generated, args.force)

    entry = MARKDOWN_ENTRY_ASSET.read_text(encoding="utf-8")
    entry = entry.replace("{{MARKDOWN_FILE}}", "source.md")
    if "{{MARKDOWN_FILE}}" in entry:
        raise SystemExit("Unresolved Markdown source placeholder")

    shutil.copyfile(THEME_ASSET, output_dir / "report-theme.typ")
    write_text(output_dir / "main.typ", entry)
    shutil.copyfile(source, output_dir / "source.md")
    write_manifest(
        output_dir,
        {
            "mode": "markdown",
            "entry": "main.typ",
            "theme": "report-theme.typ",
            "source": {
                "original_path": str(source),
                "prepared_path": "source.md",
            },
        },
    )
    print(output_dir / "main.typ")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Prepare a portable Typst project from skill-owned assets."
    )
    subparsers = parser.add_subparsers(dest="mode", required=True)

    report = subparsers.add_parser(
        "report",
        help="Prepare a native professional report.",
    )
    report.add_argument("output_dir", type=Path)
    report.add_argument("--title", required=True)
    report.add_argument("--subtitle", default="")
    report.add_argument("--author", default="Manus AI")
    report.add_argument("--force", action="store_true")
    report.set_defaults(handler=prepare_report)

    markdown = subparsers.add_parser(
        "markdown",
        help="Prepare a Markdown-backed report.",
    )
    markdown.add_argument("source", type=Path)
    markdown.add_argument("output_dir", type=Path)
    markdown.add_argument("--force", action="store_true")
    markdown.set_defaults(handler=prepare_markdown)

    return parser


def main() -> int:
    ensure_assets_exist()
    args = build_parser().parse_args()
    args.handler(args)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
