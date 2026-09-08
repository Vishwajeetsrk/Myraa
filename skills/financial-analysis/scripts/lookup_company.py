#!/usr/bin/env python3
"""Find Quartr company IDs via the bundled CSV and optional API identifiers.

Examples:
  python scripts/lookup_company.py --name oracle
  python scripts/lookup_company.py --ticker ORCL --api
  python scripts/lookup_company.py --cik 1341439 --api
"""

from __future__ import annotations

import argparse
from typing import Any, Dict

from quartr_common import call_quartr, dump_json, lookup_companies_csv


def main() -> None:
    parser = argparse.ArgumentParser(description="Lookup Quartr companies by local CSV name search or API identifiers.")
    parser.add_argument("--name", help="Case-insensitive company name substring to search in references/quartr-companies.csv.")
    parser.add_argument("--ticker", help="Ticker to pass to Quartr/list_companies.")
    parser.add_argument("--cik", help="CIK to pass to Quartr/list_companies.")
    parser.add_argument("--isin", help="ISIN to pass to Quartr/list_companies.")
    parser.add_argument("--id", dest="company_id", help="Quartr company ID to pass to Quartr/list_companies.")
    parser.add_argument("--limit", default="25", help="Maximum results for CSV or API lookup. Default: 25.")
    parser.add_argument("--api", action="store_true", help="Call Quartr/list_companies for ticker, CIK, ISIN, or ID lookup.")
    parser.add_argument("--output", help="Optional path to write JSON output instead of printing to stdout.")
    args = parser.parse_args()

    if args.name and not args.api:
        result: Dict[str, Any] = {
            "source": "references/quartr-companies.csv",
            "query": args.name,
            "data": lookup_companies_csv(args.name, int(args.limit)),
        }
        dump_json(result, args.output)
        return

    query: Dict[str, Any] = {"limit": args.limit}
    if args.ticker:
        query["tickers"] = args.ticker
    if args.cik:
        query["ciks"] = args.cik
    if args.isin:
        query["isins"] = args.isin
    if args.company_id:
        query["ids"] = args.company_id

    if len(query) == 1:
        raise SystemExit("Provide --name for CSV lookup, or one of --ticker, --cik, --isin, --id with --api.")

    result = call_quartr("Quartr/list_companies", query=query)
    dump_json(result, args.output)


if __name__ == "__main__":
    main()
