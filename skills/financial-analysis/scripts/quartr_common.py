#!/usr/bin/env python3
"""Shared helpers for Quartr API skill scripts."""

from __future__ import annotations

import csv
import json
import sys
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

SKILL_DIR = Path(__file__).resolve().parents[1]
COMPANIES_CSV = SKILL_DIR / "references" / "quartr-companies.csv"


def load_api_client():
    """Return the Manus sandbox ApiClient configured for the Quartr connector."""
    runtime_path = "/opt/.manus/.sandbox-runtime"
    if runtime_path not in sys.path:
        sys.path.append(runtime_path)
    try:
        from data_api import ApiClient  # type: ignore
    except Exception as exc:  # pragma: no cover - depends on Manus runtime
        raise SystemExit(
            "Could not import data_api.ApiClient. Run this inside the Manus sandbox/API runtime. "
            f"Original error: {exc}"
        ) from exc
    return ApiClient()


def as_str_query(query: Dict[str, Any]) -> Dict[str, str]:
    """Convert non-empty query values to strings, as Quartr endpoints require string values."""
    output: Dict[str, str] = {}
    for key, value in query.items():
        if value is None or value == "":
            continue
        if isinstance(value, bool):
            output[key] = "true" if value else "false"
        elif isinstance(value, (list, tuple, set)):
            output[key] = ",".join(str(v) for v in value if v is not None and str(v) != "")
        else:
            output[key] = str(value)
    return output


def call_quartr(endpoint: str, query: Optional[Dict[str, Any]] = None, path_params: Optional[Dict[str, Any]] = None) -> Any:
    """Call a Quartr endpoint using ApiClient."""
    client = load_api_client()
    kwargs: Dict[str, Any] = {}
    if query:
        kwargs["query"] = as_str_query(query)
    if path_params:
        kwargs["path_params"] = {k: str(v) for k, v in path_params.items() if v is not None}
    return client.call_api(endpoint, **kwargs)


def response_data(response: Any) -> List[Dict[str, Any]]:
    """Normalize a list endpoint response to a list of dictionaries."""
    if isinstance(response, dict):
        data = response.get("data", [])
        return data if isinstance(data, list) else []
    return []


def dump_json(obj: Any, output_path: Optional[str] = None) -> None:
    """Pretty-print JSON to stdout or write it to a file."""
    text = json.dumps(obj, indent=2, ensure_ascii=False, default=str)
    if output_path:
        Path(output_path).write_text(text + "\n", encoding="utf-8")
    else:
        print(text)


def lookup_companies_csv(term: str, limit: int = 25) -> List[Dict[str, str]]:
    """Case-insensitive substring lookup in references/quartr-companies.csv."""
    term_lower = term.lower().strip()
    matches: List[Dict[str, str]] = []
    if not term_lower or not COMPANIES_CSV.exists():
        return matches

    with COMPANIES_CSV.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            haystack = " ".join(str(row.get(col, "")) for col in row.keys()).lower()
            if term_lower in haystack:
                matches.append({k: str(v) for k, v in row.items()})
                if len(matches) >= limit:
                    break
    return matches


def first_item(response: Any) -> Optional[Dict[str, Any]]:
    """Return the first item from a list endpoint response, if present."""
    data = response_data(response)
    return data[0] if data else None


def event_matches(event: Dict[str, Any], fiscal_year: Optional[str], fiscal_period: Optional[str]) -> bool:
    """Return whether an event matches optional fiscal filters."""
    if fiscal_year and str(event.get("fiscalYear", "")) != str(fiscal_year):
        return False
    if fiscal_period:
        wanted = fiscal_period.strip().lower().replace("quarter", "q").replace(" ", "")
        actual = str(event.get("fiscalPeriod", "")).strip().lower().replace("quarter", "q").replace(" ", "")
        title = str(event.get("title", "")).strip().lower().replace("quarter", "q").replace(" ", "")
        if wanted not in {actual, actual.replace("q", "")} and wanted not in title:
            return False
    return True


def select_event(events_response: Any, fiscal_year: Optional[str] = None, fiscal_period: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """Select the first event matching fiscal filters from an events response sorted by date desc."""
    for event in response_data(events_response):
        if event_matches(event, fiscal_year, fiscal_period):
            return event
    return None


def summarize_event(event: Dict[str, Any]) -> str:
    return (
        f"{event.get('title', '<untitled>')} | FY{event.get('fiscalYear')} "
        f"{event.get('fiscalPeriod')} | date={event.get('date')} | eventId={event.get('id')}"
    )
