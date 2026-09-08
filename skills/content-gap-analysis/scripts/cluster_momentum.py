#!/usr/bin/env python3
"""Compute reproducible cluster momentum from a Positions export.

Fixes the recurring failure where a fresh session re-derives the trend math by
hand and mislabels clusters (e.g. tagging a ~5M-volume *growing* Translation
cluster as "16k / Declining"). It enforces the skill's method:

  - exclude brand keywords first (they dominate AI/SaaS exports)
  - cluster by regex on keyword text
  - 12-month trend  = mean(last 3 months) vs mean(first 3 months) of Trends
  - recent traj     = mean(last 3) vs mean(months 4-9), volume-weighted
  - label: Growing >= +10%, Declining <= -8%, else Stable / Maturing

Clusters are passed as a JSON file: a list of [cluster_name, regex] pairs, in
priority order. Provide clusters relevant to the target's market; keep the list
honest (do not force everything into "Growing").

Usage:
  python cluster_momentum.py \
      --positions competitor.Positions.csv \
      --brand chatgpt \
      --clusters clusters.json \
      --out cluster_momentum.csv

clusters.json example:
  [["Translation","translat|english to |to english|traduc"],
   ["AI Image / Photo","image|photo|picture|art generator"],
   ["Writing / Generators","writ|essay|paragraph|story generator|text generator"]]
"""
import argparse
import json
import os
import sys

import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cga_common import (read_csv, to_num, brand_token_variants, drop_brand_rows,
                        parse_trends, keyword_trajectories, direction_label,
                        assign_cluster)


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--positions", required=True, help="Positions export CSV (the domain whose demand you are clustering).")
    ap.add_argument("--clusters", required=True, help="JSON file: [[name, regex], ...] in priority order.")
    ap.add_argument("--brand", default=None, help="Brand name to exclude (e.g. chatgpt). Repeatable via comma.")
    ap.add_argument("--keyword-col", default="Keyword")
    ap.add_argument("--volume-col", default="Search Volume")
    ap.add_argument("--trends-col", default="Trends")
    ap.add_argument("--out", default="cluster_momentum.csv")
    args = ap.parse_args()

    df = read_csv(args.positions)
    for c in (args.keyword_col, args.volume_col):
        if c not in df.columns:
            sys.exit(f"ERROR: column '{c}' not in export. Columns: {list(df.columns)}")
    df[args.volume_col] = to_num(df[args.volume_col])

    # 1) Drop brand keywords (and known misspellings).
    if args.brand:
        variants = []
        for b in args.brand.split(","):
            variants += brand_token_variants(b.strip())
        before = len(df)
        df = drop_brand_rows(df, args.keyword_col, variants)
        print(f"Dropped {before - len(df):,} brand rows ({args.brand}).")

    # 2) Assign clusters.
    rules = [(n, p) for n, p in json.load(open(args.clusters))]
    df["cluster"] = df[args.keyword_col].apply(lambda k: assign_cluster(k, rules))

    # 3) Per-cluster volume + volume-weighted trajectory.
    has_trends = args.trends_col in df.columns
    rows = []
    for name, g in df.groupby("cluster"):
        vol = float(g[args.volume_col].sum())
        if has_trends:
            series = [parse_trends(t) for t in g[args.trends_col]]
            weights = list(g[args.volume_col].astype(float))
            twelve, recent = keyword_trajectories(series, weights)
        else:
            twelve, recent = 0.0, 0.0
        rows.append({
            "cluster": name,
            "total_volume": int(vol),
            "keywords": int(len(g)),
            "trend_12mo_%": twelve,
            "recent_trajectory_%": recent,
            "direction": direction_label(recent),
        })

    out = pd.DataFrame(rows).sort_values("total_volume", ascending=False)
    out.to_csv(args.out, index=False)
    pd.set_option("display.width", 140)
    print(out.to_string(index=False))
    print(f"\nWrote {args.out}")
    if not has_trends:
        print("WARNING: no Trends column found; trajectory set to 0. "
              "Direction labels are unreliable without trend data.")
    # Honesty reminder.
    growing = (out["direction"] == "Growing").sum()
    print(f"\nHonesty check: {growing} of {len(out)} clusters are 'Growing'. "
          "If everything is Growing, re-check the trend math — do NOT inflate.")


if __name__ == "__main__":
    main()
