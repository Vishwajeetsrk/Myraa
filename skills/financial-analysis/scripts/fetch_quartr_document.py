#!/usr/bin/env python3
"""Fetch a Quartr document using the required events-first workflow.

Examples:
  python scripts/fetch_quartr_document.py --ticker ORCL --document transcript --latest
  python scripts/fetch_quartr_document.py --company-id 4191 --document report --document-group-ids 4 --latest
  python scripts/fetch_quartr_document.py --ticker FOUR --document slide --fiscal-year 2024 --fiscal-period Q3 --full --output four_q3_slides.json

Notes:
  - The script first calls Quartr/list_events with sortBy=date and direction=desc.
  - It then lists documents for the chosen event with expand=event.
  - If --full is set, it retrieves the selected document by DOCUMENT ID, not event ID.
"""

from __future__ import annotations

import argparse
from typing import Any, Dict, Optional

from quartr_common import call_quartr, dump_json, first_item, response_data, select_event, summarize_event

DEFAULT_EARNINGS_TYPE_IDS = "26,27,28,29"
DOCUMENT_ENDPOINTS = {
    "transcript": {"list": "Quartr/list_transcripts", "get": "Quartr/get_transcript"},
    "report": {"list": "Quartr/list_reports", "get": "Quartr/get_report"},
    "slide": {"list": "Quartr/list_slides", "get": "Quartr/get_slide"},
}


def build_event_query(args: argparse.Namespace) -> Dict[str, Any]:
    query: Dict[str, Any] = {
        "sortBy": "date",
        "direction": "desc",
        "limit": args.event_limit,
    }
    if args.company_id:
        query["companyIds"] = args.company_id
    if args.ticker:
        query["tickers"] = args.ticker
    if args.cik:
        query["ciks"] = args.cik
    if args.isin:
        query["isins"] = args.isin
    if args.event_type_ids:
        query["typeIds"] = args.event_type_ids
    if args.start_date:
        query["startDate"] = args.start_date
    if args.end_date:
        query["endDate"] = args.end_date
    return query


def build_document_query(args: argparse.Namespace, event_id: Any) -> Dict[str, Any]:
    query: Dict[str, Any] = {
        "eventIds": str(event_id),
        "expand": "event",
        "limit": args.document_limit,
    }
    if args.document_group_ids:
        query["documentGroupIds"] = args.document_group_ids
    if args.document_type_ids:
        query["typeIds"] = args.document_type_ids
    return query


def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch Quartr transcripts, reports, or slide decks via events-first workflow.")
    identity = parser.add_mutually_exclusive_group(required=True)
    identity.add_argument("--company-id", help="Quartr company ID.")
    identity.add_argument("--ticker", help="Ticker symbol.")
    identity.add_argument("--cik", help="CIK.")
    identity.add_argument("--isin", help="ISIN.")

    parser.add_argument("--document", choices=sorted(DOCUMENT_ENDPOINTS), required=True, help="Document product to fetch.")
    parser.add_argument("--latest", action="store_true", help="Use the most recent matching event. This is implied when no fiscal filters are provided.")
    parser.add_argument("--fiscal-year", help="Fiscal year to match on event.fiscalYear, e.g. 2024.")
    parser.add_argument("--fiscal-period", help="Fiscal period to match, e.g. Q1, Q2, Q3, Q4, FY.")
    parser.add_argument("--event-type-ids", default=DEFAULT_EARNINGS_TYPE_IDS, help="Comma-separated event type IDs. Default: 26,27,28,29.")
    parser.add_argument("--document-group-ids", help="Report document group IDs, e.g. 4 for Annual Report or 5 for Proxy Statement.")
    parser.add_argument("--document-type-ids", help="Document type IDs, e.g. 11 for Annual Report/10-K.")
    parser.add_argument("--start-date", help="Optional ISO 8601 event startDate filter.")
    parser.add_argument("--end-date", help="Optional ISO 8601 event endDate filter.")
    parser.add_argument("--event-limit", default="20", help="Number of events to inspect. Default: 20.")
    parser.add_argument("--document-limit", default="10", help="Number of documents to list for the selected event. Default: 10.")
    parser.add_argument("--full", action="store_true", help="Retrieve the full selected document after listing documents.")
    parser.add_argument("--output", help="Optional path to write JSON output instead of printing to stdout.")
    args = parser.parse_args()

    events_response = call_quartr("Quartr/list_events", query=build_event_query(args))
    selected_event = select_event(events_response, args.fiscal_year, args.fiscal_period)
    if not selected_event:
        available = [summarize_event(event) for event in response_data(events_response)[:10]]
        raise SystemExit(
            "No matching event found. Broaden filters or increase --event-limit. "
            f"Available recent events: {available}"
        )

    doc_endpoint = DOCUMENT_ENDPOINTS[args.document]["list"]
    documents_response = call_quartr(doc_endpoint, query=build_document_query(args, selected_event["id"]))
    selected_document: Optional[Dict[str, Any]] = first_item(documents_response)
    full_document: Optional[Any] = None

    if args.full:
        if not selected_document:
            raise SystemExit("No document found for the selected event, so --full retrieval cannot continue.")
        document_id = selected_document.get("id")
        if document_id is None:
            raise SystemExit("Selected document has no id field; cannot call retrieve endpoint.")
        get_endpoint = DOCUMENT_ENDPOINTS[args.document]["get"]
        full_document = call_quartr(get_endpoint, path_params={"id": str(document_id)})

    result = {
        "selected_event": selected_event,
        "documents": documents_response,
        "selected_document": selected_document,
        "full_document": full_document,
        "workflow_reminder": "Retrieval used document id from list endpoint; event id was only used for document listing.",
    }
    dump_json(result, args.output)


if __name__ == "__main__":
    main()
