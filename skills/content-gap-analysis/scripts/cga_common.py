#!/usr/bin/env python3
"""Shared helpers for the content-gap-analysis scripts.

These utilities make the cluster-momentum and top-cluster deep-dive reproducible
across sessions, so the analysis does not depend on re-deriving the math by hand
(the failure mode that produced a mislabeled "Declining" translation cluster).

Conventions assume Semrush "Organic Positions" / "Pages" exports, but the column
names are configurable. All functions are dependency-light (pandas only).
"""
from __future__ import annotations
import re
import pandas as pd


# ----------------------------- IO + numeric -----------------------------------
def read_csv(path: str) -> pd.DataFrame:
    """Read a tool export robustly (BOM-safe, mixed dtypes tolerated)."""
    return pd.read_csv(path, encoding="utf-8-sig", low_memory=False)


def to_num(series: pd.Series) -> pd.Series:
    """Coerce a column to numeric, stripping commas; non-numeric -> NaN -> 0."""
    return pd.to_numeric(
        series.astype(str).str.replace(",", "", regex=False).str.strip(),
        errors="coerce",
    ).fillna(0)


# ----------------------------- brand filtering --------------------------------
def brand_token_variants(brand: str) -> list[str]:
    """Return common misspellings/spacings of a brand so brand nav can be excluded.

    Brand keywords (and their typos) dominate AI/SaaS exports and must be removed
    before clustering or gap mining, or they masquerade as content opportunities.
    Extend the returned list for a specific brand as needed.
    """
    b = brand.lower().strip()
    variants = {b, b.replace(" ", ""), b.replace(" ", "-")}
    # Generic letter-swap/spacing typos seen for popular AI brands.
    KNOWN = {
        "chatgpt": ["chat gpt", "chatgbt", "chat gbt", "chatgtp", "chat gpt",
                    "chtgpt", "chatpgt", "gpt chat", "openai chat", "chatgp",
                    "chat gpt", "chatgpt", "chat-gpt", "chatgpt's"],
        "manus": ["manus ai", "manus.im", "manusai", "manus im"],
    }
    variants.update(KNOWN.get(b, []))
    return sorted(v for v in variants if v)


def is_brand_kw(keyword: str, brand_variants: list[str]) -> bool:
    k = str(keyword).lower()
    return any(v and v in k for v in brand_variants)


def drop_brand_rows(df: pd.DataFrame, keyword_col: str, brand_variants: list[str]) -> pd.DataFrame:
    mask = df[keyword_col].apply(lambda k: is_brand_kw(k, brand_variants))
    return df.loc[~mask].copy()


# ----------------------------- page-type bucketing ----------------------------
DEFAULT_PAGE_RULES = [
    ("Homepage", r"^https?://[^/]+/?(\?|#|$)"),
    ("Blog", r"/blog/"),
    ("Tools", r"/tools?/"),
    ("Playbook", r"/playbook/"),
    ("Templates", r"/templates?/"),
    ("Integrations", r"/integrations?/"),
    ("Translate", r"/translate"),
    ("GPTs (/g/)", r"/g/"),
    ("Pricing/Plans", r"/(pricing|plans)\b"),
    ("Docs", r"/docs?/"),
]


def bucket_url(url: str, rules=DEFAULT_PAGE_RULES) -> str:
    u = str(url)
    for name, pat in rules:
        if re.search(pat, u):
            return name
    return "Other"


def traffic_by_page_type(df: pd.DataFrame, url_col="URL", traffic_col="Traffic",
                         rules=DEFAULT_PAGE_RULES) -> pd.DataFrame:
    d = df.copy()
    d[traffic_col] = to_num(d[traffic_col])
    d["page_type"] = d[url_col].apply(lambda u: bucket_url(u, rules))
    out = (d.groupby("page_type")[traffic_col].sum()
             .sort_values(ascending=False).reset_index())
    total = out[traffic_col].sum() or 1
    out["share_%"] = (out[traffic_col] / total * 100).round(1)
    return out


# ----------------------------- trend math (the core) --------------------------
def parse_trends(cell: str) -> list[float]:
    """Parse a Semrush 'Trends' cell ('44, 30, 36, ...') into floats.

    NOTE: these are per-keyword interest values scaled 0-100, NOT absolute volume.
    Never treat them as volumes; only use them for relative trajectory.
    """
    if not isinstance(cell, str):
        return []
    vals = []
    for p in cell.split(","):
        p = p.strip()
        if p == "":
            continue
        try:
            vals.append(float(p))
        except ValueError:
            pass
    return vals


def _mean(xs):
    return sum(xs) / len(xs) if xs else 0.0


def keyword_trajectories(series_list: list[list[float]], weights: list[float]):
    """Volume-weight a set of 0-100 trend series into one cluster series, then
    return (twelve_month_pct, recent_trajectory_pct).

    - 12-month trend  = mean(last 3) vs mean(first 3)
    - recent traj     = mean(last 3) vs mean(months 4-9)  (isolates recent accel)
    Both expressed as % change. Series shorter than needed are skipped.
    """
    # Build a weighted average series across keywords with a full 12 points.
    full = [(s, w) for s, w in zip(series_list, weights) if len(s) >= 12]
    if not full:
        return 0.0, 0.0
    n = 12
    agg = [0.0] * n
    wsum = 0.0
    for s, w in full:
        w = max(w, 1.0)
        for i in range(n):
            agg[i] += s[i] * w
        wsum += w
    agg = [x / wsum for x in agg] if wsum else agg

    first3, last3 = _mean(agg[:3]), _mean(agg[-3:])
    mid = _mean(agg[3:9])  # months 4-9
    twelve = (last3 - first3) / first3 * 100 if first3 else 0.0
    recent = (last3 - mid) / mid * 100 if mid else 0.0
    return round(twelve, 1), round(recent, 1)


def direction_label(recent_traj_pct: float) -> str:
    if recent_traj_pct >= 10:
        return "Growing"
    if recent_traj_pct <= -8:
        return "Declining"
    return "Stable / Maturing"


# ----------------------------- clustering -------------------------------------
def assign_cluster(keyword: str, cluster_rules: list[tuple[str, str]]) -> str:
    """Assign a keyword to the first matching cluster (regex on keyword text)."""
    k = str(keyword).lower()
    for name, pat in cluster_rules:
        if re.search(pat, k):
            return name
    return "Other"
