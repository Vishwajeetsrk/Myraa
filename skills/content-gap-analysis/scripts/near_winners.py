#!/usr/bin/env python3
"""Find the TARGET's near-winner quick wins from its own Positions export.

Pages already ranking positions 4-15 with meaningful volume are the highest-ROI
moves (on-page tweaks, not net-new builds). This script also rolls them up by URL
so you can name the specific pages to refresh in Finding 2 / the Quick Read.

Usage:
  python near_winners.py \
      --positions target.Positions.csv \
      --brand manus \
      --min-pos 4 --max-pos 15 --min-volume 2000 \
      --out near_winners.csv
"""
import argparse
import os
import sys

import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cga_common import read_csv, to_num, brand_token_variants, drop_brand_rows


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--positions", required=True, help="TARGET Positions export CSV.")
    ap.add_argument("--brand", default=None, help="Target brand to exclude from keywords.")
    ap.add_argument("--keyword-col", default="Keyword")
    ap.add_argument("--volume-col", default="Search Volume")
    ap.add_argument("--position-col", default="Position")
    ap.add_argument("--kd-col", default="Keyword Difficulty")
    ap.add_argument("--url-col", default="URL")
    ap.add_argument("--traffic-col", default="Traffic")
    ap.add_argument("--min-pos", type=float, default=4)
    ap.add_argument("--max-pos", type=float, default=15)
    ap.add_argument("--min-volume", type=float, default=2000)
    ap.add_argument("--out", default="near_winners.csv")
    args = ap.parse_args()

    df = read_csv(args.positions)
    for c in (args.keyword_col, args.position_col, args.volume_col):
        if c not in df.columns:
            sys.exit(f"ERROR: column '{c}' not in export. Columns: {list(df.columns)}")
    df[args.position_col] = to_num(df[args.position_col])
    df[args.volume_col] = to_num(df[args.volume_col])
    if args.traffic_col in df.columns:
        df[args.traffic_col] = to_num(df[args.traffic_col])

    if args.brand:
        variants = brand_token_variants(args.brand)
        df = drop_brand_rows(df, args.keyword_col, variants)

    nw = df[(df[args.position_col] >= args.min_pos) &
            (df[args.position_col] <= args.max_pos) &
            (df[args.volume_col] >= args.min_volume)].copy()
    nw = nw.sort_values(args.volume_col, ascending=False)

    keep = [c for c in [args.keyword_col, args.position_col, args.volume_col,
                        args.kd_col, args.url_col, args.traffic_col] if c in nw.columns]
    nw[keep].to_csv(args.out, index=False)

    # Roll up by URL to name the pages worth refreshing.
    if args.url_col in nw.columns:
        agg = (nw.groupby(args.url_col)
                 .agg(near_winner_kws=(args.keyword_col, "count"),
                      total_volume=(args.volume_col, "sum"))
                 .sort_values("total_volume", ascending=False).head(15).reset_index())
        pd.set_option("display.width", 160)
        print("Top near-winner PAGES (refresh these first):")
        print(agg.to_string(index=False))
    print(f"\nWrote {len(nw):,} near-winner keyword rows to {args.out}")


if __name__ == "__main__":
    main()
