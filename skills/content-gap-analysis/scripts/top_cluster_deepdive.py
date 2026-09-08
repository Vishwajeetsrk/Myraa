#!/usr/bin/env python3
"""Build the Finding 1 evidence: the competitor's top *replicable* cluster.

Outputs the gaining-pages table (per-page traffic, keyword count, best position,
and recent-trajectory %) that Finding 1 must contain. It also prints the size of
each candidate winning folder so you can state, in one line, why a bigger but
non-replicable cluster (e.g. /g/ user-generated GPTs) was skipped.

Works off a Pages export (preferred, has per-page Traffic) plus the Positions
export (for per-keyword Trends used to compute per-page recent trajectory).

Usage:
  python top_cluster_deepdive.py \
      --pages competitor.Pages.csv \
      --positions competitor.Positions.csv \
      --folder /translate \
      --out translate_winning_pages.csv

--folder is the URL substring that defines the winning directory. Run it once
with --survey to list the largest folders before choosing.
"""
import argparse
import os
import re
import sys

import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cga_common import read_csv, to_num, parse_trends, keyword_trajectories


def survey_folders(pages: pd.DataFrame, url_col, traffic_col, top=15):
    d = pages.copy()
    d[traffic_col] = to_num(d[traffic_col])

    def first_seg(u):
        m = re.match(r"^https?://[^/]+(/[^/?#]+)?", str(u))
        return (m.group(1) or "/") if m else "/"

    d["folder"] = d[url_col].apply(first_seg)
    agg = (d.groupby("folder")
             .agg(traffic=(traffic_col, "sum"), pages=(url_col, "count"))
             .sort_values("traffic", ascending=False).head(top).reset_index())
    print("Largest folders by traffic (decide which are REPLICABLE):")
    print(agg.to_string(index=False))
    print("\nReminder: skip brand/homepage and non-replicable folders "
          "(e.g. /g/ user-generated GPTs); deep-dive the largest CONTENT-BUILT folder.")


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--pages", required=True)
    ap.add_argument("--positions", required=True)
    ap.add_argument("--folder", help="URL substring of the winning directory, e.g. /translate")
    ap.add_argument("--survey", action="store_true", help="List largest folders and exit.")
    ap.add_argument("--url-col", default="URL")
    ap.add_argument("--traffic-col", default="Traffic")
    ap.add_argument("--kw-count-col", default="Number of Keywords")
    ap.add_argument("--keyword-col", default="Keyword")
    ap.add_argument("--volume-col", default="Search Volume")
    ap.add_argument("--position-col", default="Position")
    ap.add_argument("--trends-col", default="Trends")
    ap.add_argument("--top", type=int, default=10)
    ap.add_argument("--out", default="winning_pages.csv")
    args = ap.parse_args()

    pages = read_csv(args.pages)
    if args.survey or not args.folder:
        survey_folders(pages, args.url_col, args.traffic_col)
        if not args.folder:
            return

    pages[args.traffic_col] = to_num(pages[args.traffic_col])
    win = pages[pages[args.url_col].str.contains(re.escape(args.folder), na=False)].copy()
    win = win.sort_values(args.traffic_col, ascending=False).head(args.top)

    # Per-page recent trajectory from the Positions export (group keywords by URL).
    pos = read_csv(args.positions)
    pos[args.volume_col] = to_num(pos[args.volume_col])
    have_trends = args.trends_col in pos.columns

    def page_traj(url):
        if not have_trends:
            return 0.0
        g = pos[pos[args.url_col] == url]
        if g.empty:
            return 0.0
        series = [parse_trends(t) for t in g[args.trends_col]]
        weights = list(g[args.volume_col].astype(float))
        _, recent = keyword_trajectories(series, weights)
        return recent

    def best_pos(url):
        g = pos[pos[args.url_col] == url]
        return int(g[args.position_col].astype(float).min()) if not g.empty else ""

    rows = []
    for _, r in win.iterrows():
        url = r[args.url_col]
        slug = re.sub(r"^https?://[^/]+", "", str(url)) or "/"
        rows.append({
            "slug": slug,
            "traffic": int(r[args.traffic_col]),
            "keywords": int(to_num(pd.Series([r.get(args.kw_count_col, 0)])).iloc[0]),
            "best_pos": best_pos(url),
            "recent_traj%": page_traj(url),
        })

    out = pd.DataFrame(rows)
    out.to_csv(args.out, index=False)
    pd.set_option("display.width", 140)
    print(out.to_string(index=False))
    print(f"\nWrote {args.out}")
    print("Use this as the Finding 1 gaining-pages table. The hub usually has the "
          "most traffic but flat trajectory; the templated child pages carry the momentum.")


if __name__ == "__main__":
    main()
