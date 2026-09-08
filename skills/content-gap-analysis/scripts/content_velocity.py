#!/usr/bin/env python3
"""Content velocity benchmark, for both domains.

Produces the numbers the Content Velocity section requires:
  - blog pages indexed
  - total blog traffic
  - traffic-per-blog-page

Needs Pages exports with a URL column and a Traffic column. Pass each domain's
pages file with a label.

Usage:
  python content_velocity.py \
      --pages target=manus.Pages.csv --pages competitor=competitor.Pages.csv \
      --out-prefix velocity
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cga_common import read_csv, to_num, bucket_url, DEFAULT_PAGE_RULES


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--pages", action="append", required=True,
                    help="label=path.csv (repeatable), e.g. target=manus.Pages.csv")
    ap.add_argument("--url-col", default="URL")
    ap.add_argument("--traffic-col", default="Traffic")
    ap.add_argument("--out-prefix", default="velocity")
    args = ap.parse_args()

    rows = []
    for spec in args.pages:
        if "=" not in spec:
            sys.exit(f"--pages must be label=path, got: {spec}")
        label, path = spec.split("=", 1)
        df = read_csv(path)
        df["page_type"] = df[args.url_col].apply(lambda u: bucket_url(u, DEFAULT_PAGE_RULES))

        print(f"\n================ {label} ({os.path.basename(path)}) ================")
        if args.traffic_col not in df.columns:
            print(f"No traffic column {args.traffic_col!r} found; skipping this file.")
            continue
        df[args.traffic_col] = to_num(df[args.traffic_col])
        blog = df[df["page_type"] == "Blog"]
        bt = blog[args.traffic_col].sum()
        bp = len(blog)
        per_page = (bt / bp) if bp else 0
        print(f"Content velocity: {bp} blog pages, {int(bt):,} blog visits, "
              f"{per_page:.0f} visits/blog page")
        rows.append({
            "domain": label,
            "blog_pages": bp,
            "blog_traffic": int(bt),
            "traffic_per_blog_page": round(per_page, 1),
        })

    if rows:
        import pandas as pd
        out = pd.DataFrame(rows)
        out_path = f"{args.out_prefix}_velocity.csv"
        out.to_csv(out_path, index=False)
        print(f"\nWrote {out_path}")


if __name__ == "__main__":
    main()
