#!/usr/bin/env python3
"""Compile Typst with bounded terminal diagnostics and durable artifacts."""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
from pathlib import Path


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Compile a Typst file to PDF")
    parser.add_argument("input_file", type=Path)
    parser.add_argument("-o", "--output", type=Path)
    parser.add_argument(
        "--watch",
        action="store_true",
        help="Watch for human continuous editing; autonomous workflows should use discrete compile",
    )
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Treat warnings in the complete diagnostic stream as errors",
    )
    parser.add_argument(
        "--diagnostics",
        choices=("short", "full"),
        default="short",
        help="Typst diagnostic format; use full only when short lacks root-cause context",
    )
    parser.add_argument(
        "--diagnostics-log",
        type=Path,
        help="Artifact path for the complete diagnostic stream from this compile",
    )
    parser.add_argument(
        "--summary-lines",
        type=int,
        default=40,
        help="Maximum diagnostic lines printed to the terminal",
    )
    return parser


def print_bounded_diagnostics(diagnostics: str, max_lines: int) -> None:
    if not diagnostics:
        return
    lines = diagnostics.splitlines()
    limit = max(1, max_lines)
    print("\n".join(lines[:limit]), file=sys.stderr)
    if len(lines) > limit:
        print(
            f"[diagnostics truncated: {len(lines) - limit} more line(s); see artifact]",
            file=sys.stderr,
        )


def main() -> int:
    args = build_parser().parse_args()
    input_path = args.input_file.resolve()
    if not input_path.is_file():
        print(f"Error: input file does not exist: {input_path}", file=sys.stderr)
        return 1

    output_path = args.output.resolve() if args.output else input_path.with_suffix(".pdf")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    diagnostic_log = (
        args.diagnostics_log.resolve()
        if args.diagnostics_log
        else output_path.with_suffix(".typst-diagnostics.log")
    )

    cmd = [
        "typst",
        "watch" if args.watch else "compile",
        "--diagnostic-format",
        args.diagnostics,
        str(input_path),
        str(output_path),
    ]

    try:
        if args.watch:
            print("Running human watch session: " + " ".join(cmd))
            return subprocess.run(cmd, check=False).returncode
        result = subprocess.run(cmd, capture_output=True, text=True, check=False)
    except FileNotFoundError:
        print("Error: 'typst' command not found; verify with: typst --version", file=sys.stderr)
        return 1

    diagnostics = result.stderr
    diagnostic_log.parent.mkdir(parents=True, exist_ok=True)
    diagnostic_log.write_text(diagnostics, encoding="utf-8")
    print_bounded_diagnostics(diagnostics.strip(), args.summary_lines)

    has_warning = "warning:" in diagnostics.lower()
    if result.returncode != 0:
        print(
            f"Compilation failed (exit={result.returncode}); diagnostics={diagnostic_log}",
            file=sys.stderr,
        )
        return result.returncode

    if args.strict and has_warning:
        print(
            f"Strict build failed: warnings recorded in {diagnostic_log}",
            file=sys.stderr,
        )
        return 2

    size_kb = os.path.getsize(output_path) / 1024 if output_path.exists() else 0.0
    warning_text = "yes" if has_warning else "no"
    print(
        f"COMPILE PASS output={output_path} size_kb={size_kb:.1f} "
        f"warnings={warning_text} diagnostics={diagnostic_log}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
