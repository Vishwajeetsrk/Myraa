# Quartr API Reference

This document consolidates all execution rules, confirmed working endpoints, parameters, and response schemas for Quartr. Quartr provides investor relations data — earnings call transcripts, corporate events, investor presentations, and SEC filing PDFs. Every operation name listed here has been verified against the live `data_api.ApiClient` interface.

Quartr is accessed through operation names such as `Quartr/list_events` and `Quartr/get_transcript`, using the Manus sandbox `data_api.ApiClient` interface or the bundled helper scripts. Do not look for a Quartr MCP server, and do not say "the Quartr MCP server is unavailable."

Minimal direct call pattern:

```python
import sys
sys.path.append('/opt/.manus/.sandbox-runtime')
from data_api import ApiClient

client = ApiClient()
result = client.call_api('Quartr/list_events', query={
    'tickers': 'TSLA',
    'sortBy': 'date',
    'direction': 'desc',
    'limit': '10',
})
```

## 1. The Events-First Workflow

> **CRITICAL:** Quartr's document listing endpoints sort by internal database ID, NOT by date. You **MUST** find the event first to ensure you retrieve the correct quarter's documents.

```
Step 1: Resolve Company ID (Search references/quartr-companies.csv or use lookup_company.py)
  ↓
Step 2: List Events (Call Quartr/list_events with companyIds, sortBy='date', direction='desc')
  ↓
Step 3: Select Target Event (Filter events by fiscalYear and fiscalPeriod)
  ↓
Step 4: List Documents (Call list_transcripts, list_reports, list_slides with eventIds and expand='event')
  ↓
Step 5: Retrieve Document (Call get_transcript, get_report, get_slide using the Document ID)
```

---

## 2. Confirmed Endpoints & Parameters

All parameters go in the `query` dictionary unless specified as `path_params`. All query values must be strings.

### Companies
- **`Quartr/list_companies`**: Resolve ticker/ISIN/CIK to a Quartr company ID.
  - `query`: `tickers`, `ciks`, `isins`, `ids`, `countries` (ISO-2), `exchanges`, `limit` (max 50, default 10)
  - **DOES NOT SUPPORT**: `names`, `name`, `search`, `query`. Use local CSV search (`references/quartr-companies.csv`) or `lookup_company.py` instead.
- **`Quartr/get_company`**: Full IR profile / company metadata.
  - `path_params`: `id` (Quartr company ID)

### Events
- **`Quartr/list_events`**: List corporate events (the only endpoint supporting date sorting).
  - `query`: `companyIds`, `tickers`, `typeIds`, `sortBy` (ALWAYS use `"date"`), `direction` (ALWAYS use `"desc"`), `startDate`, `endDate`, `expand` (set `"event"` where supported), `limit` (max 500, default 10)
  - **Event Type IDs (`typeIds`)**:
    - `26`: Q1 Earnings Call
    - `27`: Q2 Earnings Call
    - `28`: Q3 Earnings Call
    - `29`: Q4 Earnings / Annual Filing
    - `35`: Conference Call / Capital Markets Day
- **`Quartr/list_event_types`**: Discover all event type IDs and labels. No parameters required.

### Transcripts
- **`Quartr/list_transcripts`**: List transcript documents.
  - `query`: `companyIds`, `tickers`, `eventIds` (preferred), `expand` (ALWAYS set to `"event"`), `limit` (max 500)
- **`Quartr/get_transcript`**: Retrieve full verbatim transcript text + download URL.
  - `path_params`: `id` (MUST be the Document ID, NOT the Event ID)
  - `query`: `expand` (set to `"event"`)
- **`Quartr/list_transcript_chapters`**: Chapter / section breakdown with timestamps (CEO remarks, guidance, Q&A).
  - `path_params`: `id`

### Reports (Filings)
- **`Quartr/list_reports`**: List SEC filing PDFs (10-K, 10-Q, 8-K, proxy).
  - Same query filters as `list_transcripts`, plus:
  - `documentGroupIds` (string): Filter by document group.
    - `1`: Earnings Release
    - `3`: Interim Report
    - `4`: Annual Report (10-K)
    - `5`: Proxy Statement (DEF 14A)
- **`Quartr/get_report`**: Retrieve report metadata and PDF download URL.
  - `path_params`: `id` (Document ID)

### Slide Decks
- **`Quartr/list_slides`**: List investor presentation decks.
  - Same query filters as `list_transcripts`.
- **`Quartr/get_slide`**: Retrieve slide deck metadata and PDF download URL.
  - `path_params`: `id` (Document ID)

### Utility
- **`Quartr/list_document_types`**: Discover all document type IDs and labels. No parameters required.

---

## 3. Execution Helper Scripts

To avoid manual multi-step calls, prefer the bundled scripts. They handle the events-first workflow and parameter coercion automatically. Run them from the installed skill directory (`/home/ubuntu/skills/financial-analysis`).

### Script 1: Company Lookup
```bash
# Local CSV search (fast, offline)
python3 /home/ubuntu/skills/financial-analysis/scripts/lookup_company.py --name "Microsoft"

# Upstream API search (matches tickers/CIKs/ISINs)
python3 /home/ubuntu/skills/financial-analysis/scripts/lookup_company.py --ticker MSFT --api
```

### Script 2: Document Fetcher
```bash
# Latest earnings transcript
python3 /home/ubuntu/skills/financial-analysis/scripts/fetch_quartr_document.py \
    --ticker FOUR --document transcript --latest --full --output transcript.json

# 10-K report (Annual Report group ID 4)
python3 /home/ubuntu/skills/financial-analysis/scripts/fetch_quartr_document.py \
    --ticker ORCL --document report --document-group-ids 4 --latest --output 10k.json

# Earnings presentation slides
python3 /home/ubuntu/skills/financial-analysis/scripts/fetch_quartr_document.py \
    --ticker MSFT --document slide --latest --output slides.json
```

---

## 4. Prohibited Behaviors

- **No Direct List Retrieval**: Do not call `list_transcripts` or `list_reports` without first retrieving the corresponding event via `list_events`. Doing so returns documents ordered by internal ID, resulting in old or incorrect quarters.
- **No Event ID in Document Retrieval**: Do not pass an Event ID to `get_transcript`, `get_report`, or `get_slide`. You must pass the Document ID (`id` from the list response).
- **No Names in `list_companies`**: Do not pass `names` or `name` to `list_companies`; it returns a `400` error. Use the local CSV or `lookup_company.py`.
- **Verified-invalid names — do NOT use**: `Quartr/list_slide_decks` (use `Quartr/list_slides`), `Quartr/get_transcript_chapters` (use `Quartr/list_transcript_chapters`), `Quartr/get_event`, `Quartr/get_company_segments`, `Quartr/get_report_pages`, `Quartr/get_slide_pages`. These all return "api not found".
