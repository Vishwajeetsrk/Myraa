# Yahoo Finance API Reference

This document consolidates all execution rules, confirmed working endpoints, parameters, and response schemas for Yahoo Finance.

## 1. Confirmed Endpoints

Only **5 endpoints** are enabled. Do not attempt to use any other endpoints (e.g., `get_stock_quote`, `get_stock_financials`), as they will return an "api not found" error.

| User Needs | Operation Name | Works For |
| :--- | :--- | :--- |
| Historical price charts, OHLCV, quick price check | `YahooFinance/get_stock_chart` | Stocks, ETFs, Indices, Crypto, Forex, Futures |
| Company background, sector, industry, employees | `YahooFinance/get_stock_profile` | Equities (Stocks) only |
| Insider transactions, institutional/mutual fund ownership | `YahooFinance/get_stock_holders` | Equities (Stocks) only |
| Analyst recommendations, target price, technical outlook | `YahooFinance/get_stock_insights` | Equities (Stocks) primarily |
| List of SEC filings with direct EDGAR links | `YahooFinance/get_stock_sec_filing` | Equities (Stocks) only |

---

## 2. Parameter Specifications

### Common Parameters
- `symbol` (string, Required): Ticker symbol (e.g., `AAPL`, `^GSPC`, `BTC-USD`, `7203.T`).
- `region` (string, Optional): Market region code (e.g., `US`, `GB`, `HK`, `DE`, `CA`). Default: `US`.
- `lang` (string, Optional): Language code (e.g., `en-US`, `zh-Hant-HK`). Default: `en-US`.

### Endpoint-Specific Parameters

#### `YahooFinance/get_stock_chart`
- `interval` (string, Required): Data granularity. Valid values: `1m`, `2m`, `5m`, `15m`, `30m`, `60m`, `1h`, `1d`, `5d`, `1wk`, `1mo`, `3mo`.
- `range` (string, Optional*): Time range. Valid values: `1d`, `5d`, `1mo`, `3mo`, `6mo`, `1y`, `2y`, `5y`, `10y`, `ytd`, `max`.
- `period1` (string, Optional*): Start time (Unix timestamp, e.g., `1704067200`).
- `period2` (string, Optional*): End time (Unix timestamp, e.g., `1706745600`).
- `includeAdjustedClose` (boolean, Optional): Include adjusted close prices. Default: `true`.
- `includePrePost` (boolean, Optional): Include pre/post market data. Default: `false`.
- `events` (string, Optional): Include specific corporate events. Valid values: `div`, `split`, `div,split`.
- `comparisons` (string, Optional): Comma-separated symbols to compare. Example: `MSFT,GOOGL`.

*\*Note: You must provide either `range` OR both `period1` and `period2`.*

#### `YahooFinance/get_stock_profile`
- No extra parameters beyond `symbol`, `region`, and `lang`.

#### `YahooFinance/get_stock_holders`
- No extra parameters beyond `symbol`, `region`, and `lang`.

#### `YahooFinance/get_stock_insights`
- Only takes `symbol` (string, Required). Does not support `region` or `lang`.

#### `YahooFinance/get_stock_sec_filing`
- No extra parameters beyond `symbol`, `region`, and `lang`.

---

## 3. Execution Example

Always implement a delay of **0.5 to 1.0 seconds** between consecutive Yahoo Finance API calls to prevent rate limiting (`429 Too Many Requests`).

```python
import sys
import time
sys.path.append('/opt/.manus/.sandbox-runtime')
from data_api import ApiClient

client = ApiClient()

# 1. Fetch company profile
profile = client.call_api('YahooFinance/get_stock_profile', query={
    'symbol': 'AAPL'
})
time.sleep(1.0) # Rate limit guardrail

# 2. Fetch analyst insights
insights = client.call_api('YahooFinance/get_stock_insights', query={
    'symbol': 'AAPL'
})
```

---

## 4. Response Schema Highlights

### `YahooFinance/get_stock_chart`
Data wraps in `chart.result[0]`.
- `meta`: Contains currency, regular market price, 52-week high/low, exchange name, and instrument type (`EQUITY`, `ETF`, `INDEX`, `CRYPTOCURRENCY`, `CURRENCY`, `FUTURE`).
- `timestamp`: Array of Unix timestamps.
- `indicators.quote[0]`: Arrays of `open`, `high`, `low`, `close`, `volume`.
- `indicators.adjclose[0].adjclose`: Array of adjusted close prices.

### `YahooFinance/get_stock_profile`
Data wraps in `quoteSummary.result[0].summaryProfile`.
- Key fields: `longBusinessSummary`, `fullTimeEmployees`, `industry`, `sector`, `website`, `phone`.

### `YahooFinance/get_stock_holders`
Data wraps in `quoteSummary.result[0]`.
- Sections: `insiderHolders`, `institutionalHolders`, `mutualFundHolders`.
- **CRITICAL:** Numeric values are returned as dictionaries, e.g., `{"raw": 12345, "fmt": "12.35k"}`. **ALWAYS use the `raw` field for calculations.**

### `YahooFinance/get_stock_insights`
Data wraps in `finance.result`.
- `instrumentInfo.technicalEvents`: Technical outlooks (`shortTermOutlook`, `intermediateTermOutlook`, `longTermOutlook`).
- `instrumentInfo.keyTechnicals`: Support, resistance, and stop-loss levels.
- `instrumentInfo.valuation`: Description (e.g., "Overvalued", "Undervalued") and discount.
- `recommendation`: Analyst `targetPrice`, `provider`, and `rating` (e.g., "BUY").
- `sigDevs`: Array of recent headlines and dates.

### `YahooFinance/get_stock_sec_filing`
Data wraps in `quoteSummary.result[0].secFilings.filings`.
- Array of objects containing `date`, `type` (10-K, 10-Q), `title`, and `edgarUrl`.

---

## 5. Prohibited Behaviors

- **No Non-Equities for Profile/Holders/Filings**: Do not call `get_stock_profile`, `get_stock_holders`, or `get_stock_sec_filing` for ETFs, indices, crypto, or forex. These endpoints only support equities and will return a "Not Found" error.
- **No Burst Calls**: Do not make multiple back-to-back calls without a sleep delay.
- **No Formatting Strings in Math**: Never use the `fmt` string for calculations.
