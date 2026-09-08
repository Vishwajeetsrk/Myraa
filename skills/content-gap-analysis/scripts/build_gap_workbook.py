#!/usr/bin/env python3
"""Build a content-gap workbook from keyword CSV exports.

Merges one TARGET keyword export and one or more COMPETITOR keyword exports
(Ahrefs / Semrush "Organic keywords" style) and outputs a deduplicated list of
gap opportunities:

  - "missing": keyword that competitor(s) rank for but the target does not
  - "weak":    keyword both rank for, but the target ranks worse than a competitor

It computes a priority score so the result is sortable and decision-ready.

This is a convenience helper, NOT a required step. The column names vary across
tools and exports, so inspect the CSV first and pass the right column names via
flags. Always sanity-check the output before using it in a report.

Usage:
  python build_gap_workbook.py \
      --target target.csv \
      --competitor compA.csv --competitor compB.csv \
      --keyword-col Keyword --volume-col Volume --kd-col "Difficulty" \
      --position-col Position --weak-threshold 10 \
      --out gap_workbook.csv

Run with --help for all options.
"""

import argparse
import csv
import sys
from typing import Dict, List, Optional


def read_keywords(path: str, kw_col: str, vol_col: Optional[str],
                  kd_col: Optional[str], pos_col: Optional[str]) -> Dict[str, dict]:
    """Read a keyword CSV into {normalized_keyword: {volume, kd, position, raw}}."""
    rows: Dict[str, dict] = {}
    with open(path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        if kw_col not in reader.fieldnames:
            sys.exit(f"ERROR: keyword column '{kw_col}' not found in {path}. "
                     f"Available columns: {reader.fieldnames}")
        for r in reader:
            kw = (r.get(kw_col) or "").strip()
            if not kw:
                continue
            key = kw.lower()

            def num(col):
                if not col:
                    return None
                val = (r.get(col) or "").replace(",", "").strip()
                try:
                    return float(val)
                except ValueError:
                    return None

            entry = {
                "keyword": kw,
                "volume": num(vol_col),
                "kd": num(kd_col),
                "position": num(pos_col),
            }
            # Keep the best (lowest) position if the keyword repeats in the export.
            if key in rows and entry["position"] is not None:
                prev = rows[key]["position"]
                if prev is None or entry["position"] < prev:
                    rows[key] = entry
            else:
                rows[key] = entry
    return rows


def score(volume: Optional[float], kd: Optional[float]) -> dict:
    """Map raw volume/KD to 1-5 demand & winnability scores and a priority score."""
    # Demand from volume (estimate). Tune buckets to your market if needed.
    if volume is None:
        demand = 3
    elif volume >= 5000:
        demand = 5
    elif volume >= 1000:
        demand = 4
    elif volume >= 200:
        demand = 3
    elif volume >= 50:
        demand = 2
    else:
        demand = 1
    # Winnability: lower KD = easier = higher score.
    if kd is None:
        winnability = 3
    elif kd <= 15:
        winnability = 5
    elif kd <= 30:
        winnability = 4
    elif kd <= 50:
        winnability = 3
    elif kd <= 70:
        winnability = 2
    else:
        winnability = 1
    # Business value and effort cannot be inferred from a keyword export;
    # default to 3 and leave them for the analyst to adjust.
    business_value = 3
    effort = 3
    priority = (demand + business_value + winnability) - effort
    return {
        "demand_score": demand,
        "business_value_score": business_value,
        "winnability_score": winnability,
        "effort_score": effort,
        "priority_score": priority,
    }


def main():
    ap = argparse.ArgumentParser(description="Build a content-gap workbook from keyword CSV exports.")
    ap.add_argument("--target", required=True, help="Target keyword export CSV.")
    ap.add_argument("--competitor", action="append", required=True,
                    help="Competitor keyword export CSV (repeatable).")
    ap.add_argument("--keyword-col", default="Keyword", help="Keyword column name (default: Keyword).")
    ap.add_argument("--volume-col", default="Volume", help="Search volume column name (default: Volume).")
    ap.add_argument("--kd-col", default=None, help="Keyword difficulty column name (optional).")
    ap.add_argument("--position-col", default="Position", help="Rank position column name (default: Position).")
    ap.add_argument("--weak-threshold", type=int, default=10,
                    help="Target counts as 'weak' if its position is worse than this and a competitor "
                         "ranks at/above it (default: 10).")
    ap.add_argument("--out", default="gap_workbook.csv", help="Output CSV path.")
    args = ap.parse_args()

    target = read_keywords(args.target, args.keyword_col, args.volume_col, args.kd_col, args.position_col)

    # Merge all competitor exports, keeping the best competitor position per keyword.
    competitors: Dict[str, dict] = {}
    for path in args.competitor:
        comp = read_keywords(path, args.keyword_col, args.volume_col, args.kd_col, args.position_col)
        for key, entry in comp.items():
            entry = dict(entry, source=path)
            if key not in competitors:
                competitors[key] = entry
            else:
                cur = competitors[key]["position"]
                new = entry["position"]
                if new is not None and (cur is None or new < cur):
                    competitors[key] = entry

    out_rows: List[dict] = []
    for key, comp in competitors.items():
        tgt = target.get(key)
        comp_pos = comp["position"]
        if tgt is None:
            gap_type = "missing"
            target_pos = ""
        else:
            tpos = tgt["position"]
            # Weak = target ranks worse than threshold while competitor ranks better.
            if (tpos is not None and tpos > args.weak_threshold and
                    comp_pos is not None and comp_pos < tpos):
                gap_type = "weak"
            else:
                continue  # target already competitive; not a gap
            target_pos = tpos if tpos is not None else ""

        s = score(comp.get("volume"), comp.get("kd"))
        out_rows.append({
            "keyword": comp["keyword"],
            "gap_type": gap_type,
            "search_volume": comp.get("volume") or "",
            "keyword_difficulty": comp.get("kd") or "",
            "competitor_position": comp_pos if comp_pos is not None else "",
            "competitor_source": comp.get("source", ""),
            "target_position": target_pos,
            **s,
        })

    out_rows.sort(key=lambda r: r["priority_score"], reverse=True)

    fieldnames = ["keyword", "gap_type", "search_volume", "keyword_difficulty",
                  "competitor_position", "competitor_source", "target_position",
                  "demand_score", "business_value_score", "winnability_score",
                  "effort_score", "priority_score"]
    with open(args.out, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(out_rows)

    missing = sum(1 for r in out_rows if r["gap_type"] == "missing")
    weak = sum(1 for r in out_rows if r["gap_type"] == "weak")
    print(f"Wrote {len(out_rows)} gap rows to {args.out} ({missing} missing, {weak} weak).")
    print("Reminder: business_value_score and effort_score default to 3 — adjust them by hand, "
          "and exclude competitor-branded / irrelevant keywords before reporting.")


if __name__ == "__main__":
    main()
