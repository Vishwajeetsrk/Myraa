# Massive API Reference

This document consolidates all execution rules, confirmed working endpoints, parameters, and response schemas for Massive. Every operation name listed here has been verified against the live `data_api.ApiClient` interface.

## 1. Core Constraints & Conventions

- **Asset Coverage**: Massive covers assets traded on US exchanges (NYSE, NASDAQ, AMEX, OTC), including ADRs and ETFs. It also covers Crypto and Forex globally, plus US macroeconomic series. It does NOT cover ordinary international listings (e.g., Samsung on KRX, Nestlé on SIX). Use Yahoo Finance for non-US listings.
- **All query parameter values must be strings**: e.g., `'limit': '5'`, not `'limit': 5`.
- **Ticker Formatting**:
  - **US Stocks**: Standard ticker (e.g., `AAPL`, `TSLA`).
  - **Options**: OCC format with `O:` prefix (e.g., `O:AAPL250620C00150000`).
  - **Crypto**: Prefix with `X:` (e.g., `X:BTCUSD`).
  - **Forex**: Prefix with `C:` (e.g., `C:EURUSD`).
  - **Indices**: Caret prefix (e.g., `^GSPC`) or `I:` prefix depending on endpoint.
- **Path vs. Query Parameter Placement**:
  - **Stock Bars/Snapshots/Trades/Quotes**: Use `stocksTicker` (or `ticker`) in `path_params`.
  - **Stock Technical Indicators**: Use `stockTicker` (singular, no `s`) in `path_params`.
  - **Crypto Bars**: Use `cryptoTicker` in `path_params`.
  - **Forex Bars**: Use `forexTicker` in `path_params`.
  - **Options Bars/Details**: Use `optionsTicker` in `path_params`.
  - **Fundamentals, Filings, & Corporate Actions**: All parameters go in `query`, not `path_params`.
- **Pagination**: Most list endpoints support `limit` and return `next_url` for pagination.
- **Date formats**: Use `YYYY-MM-DD`; millisecond timestamps are also accepted by bar endpoints.

---

## 2. Confirmed Working Endpoints

Only the following operations are enabled. Any other operation name will fail with an "api not found" error. Do not invent names such as `get_stock_quote`, `get_stock_financials`, `get_edgar_index`, `get_quotes`, `get_trades`, `get_top_market_movers`, `get_single_ticker_snapshot`, `get_13f_filings`, `get_form3`, or `get_form4` — these are NOT valid.

### Stocks — Price Data
- **`Massive/get_stock_bars`**: Custom OHLCV bars (minute to yearly, up to 50K).
  - `path_params`: `stocksTicker` (or `ticker`), `multiplier`, `timespan`, `from`, `to`
  - `query`: `adjusted` (boolean, default `true`), `sort` (`asc`|`desc`), `limit` (max 50000, default 5000)
- **`Massive/get_daily_ticker_summary`**: Daily OHLCV for a single ticker on a date.
  - `path_params`: `stocksTicker`, `date` (format `YYYY-MM-DD`)
- **`Massive/get_daily_market_summary`**: Daily summary for all tickers on a given date.
  - `path_params`: `date` (format `YYYY-MM-DD`)
- **`Massive/get_stock_snapshot`**: Real-time snapshot for a single ticker.
  - `path_params`: `stocksTicker`
- **`Massive/get_full_market_snapshot`**: Snapshot of the entire US market.
- **`Massive/get_unified_snapshot`**: Latest cross-asset snapshot for multiple tickers.
  - `query`: `tickers` (comma-separated, e.g., `"AAPL,MSFT"`)
- **`Massive/get_previous_day_bar`**: Previous trading day OHLCV.
  - `path_params`: `stocksTicker`
- **`Massive/get_stock_open_close`**: Daily open/close with pre-market and after-hours prices.
  - `path_params`: `stocksTicker`, `date`
- **`Massive/get_top_movers`**: Top gainers and losers.
  - `query`: `direction` (`gainers`|`losers`), `include_otc` (boolean)

### Stocks — Trades & Quotes
- **`Massive/get_last_trade`**: Most recent trade.
  - `path_params`: `stocksTicker`
- **`Massive/get_last_quote`**: Most recent NBBO quote.
  - `path_params`: `stocksTicker`
- **`Massive/get_stock_trades`**: Tick-level historical trades.
  - `path_params`: `stocksTicker`
  - `query`: `limit`
- **`Massive/get_stock_quotes`**: Tick-level historical NBBO quotes.
  - `path_params`: `stocksTicker`
  - `query`: `limit`

### Fundamentals & Financials (US Stocks Only)
All parameters for these endpoints go in the `query` dictionary.
- **`Massive/get_income_statements`**: Income statement line items (25+).
- **`Massive/get_balance_sheets`**: Balance sheet line items (30+).
- **`Massive/get_cash_flow_statements`**: Cash flow statement line items (22).
  - **Common Query Parameters** (for the three statements above):
    - `tickers` (string, Optional): Filter by ticker symbol(s).
    - `cik` (string, Optional): Central Index Key.
    - `fiscal_year` (number, Optional): e.g., `2024`.
    - `fiscal_quarter` (number, Optional): `1`, `2`, `3`, or `4`.
    - `timeframe` (string, Optional): `quarterly`, `annual`, or `trailing_twelve_months` (TTM).
    - `limit` (integer, Optional): Defaults to `100`, max `50000`.
    - `sort` (string, Optional): e.g., `period_end.desc` (default `period_end.asc`).
- **`Massive/get_financial_ratios`**: 22 ratios (P/E, P/B, ROE, ROA, EV/EBITDA, etc.) with range filtering for screening.
  - `query`: `tickers`, and range filters such as `return_on_equity.gte`, `price_to_earnings.lte`, etc., plus `limit`, `sort`.
- **`Massive/get_ticker_overview`**: Company profile, market cap, SIC, FIGI, employees, IPO date.
  - `path_params`: `stocksTicker`
- **`Massive/get_float`**: Free float shares.
  - `query`: `ticker`
- **`Massive/get_short_interest`**: FINRA short interest.
  - `query`: `ticker`, `limit`
- **`Massive/get_short_volume`**: Off-exchange daily short volume.
  - `query`: `ticker`, `limit`

### SEC Filings & Regulatory
- **`Massive/get_sec_edgar_index`**: SEC EDGAR filing index for a company.
  - `query`: `ticker`, `limit`
- **`Massive/get_10k_sections`**: Pre-extracted 10-K section text (risk factors, MD&A, business).
  - `query`: `ticker`, `fiscal_year`, `section` (e.g., `"1A"` for Risk Factors)
- **`Massive/get_8k_text`**: Parsed 8-K material event text.
  - `query`: `ticker`, `limit`
- **`Massive/get_risk_factors`**: Full standardized risk factor text from 10-K filings.
  - `query`: `ticker`
- **`Massive/get_risk_categories`**: Risk factor category definitions / summaries.
  - `query`: `ticker`

### Corporate Actions
- **`Massive/get_dividends`**: Historical cash dividends (amounts, dates, frequency).
  - `query`: `ticker`, `limit`
- **`Massive/get_splits`**: Historical stock splits (forward/reverse, ratios).
  - `query`: `ticker`, `limit`
- **`Massive/get_ipos`**: Upcoming and historical IPOs (from 2008+).
  - `query`: `limit`
- **`Massive/get_ticker_events`**: Ticker lifecycle events (splits, name changes, delistings).
  - `path_params`: `id` (ticker symbol)

### Tickers, News & Market Info
- **`Massive/get_all_tickers`**: Search/list tickers across all asset classes.
  - `query`: `limit`
- **`Massive/get_related_tickers`**: Tickers related by news and returns.
  - `path_params`: `stocksTicker`
- **`Massive/get_ticker_types`**: Supported asset class type definitions.
- **`Massive/get_news`**: Recent news articles with sentiment scores.
  - `query`: `ticker`, `limit`
- **`Massive/get_exchanges`**: Exchange directory.
- **`Massive/get_market_holidays`**: Market holiday calendar.
- **`Massive/get_market_status`**: Current market open/closed status.
- **`Massive/get_condition_codes`**: Trade and quote condition code definitions.

### Technical Indicators
- **`Massive/get_sma`** / **`Massive/get_ema`** / **`Massive/get_rsi`**
  - `path_params`: `stockTicker` (singular)
  - `query`: `timespan` (`day`|`hour`|`minute`), `window` (integer window size), `series_type` (`close` etc.), `limit` (max 5000)
- **`Massive/get_macd`**
  - `path_params`: `stockTicker` (singular)
  - `query`: `timespan`, `series_type`, `limit`

### Options
- **`Massive/get_option_contracts_list`**: Search option contracts (filter by ticker/type/expiration/strike).
  - `query`: `underlying_ticker`, `contract_type` (`call`|`put`), `expiration_date`, `strike_price`, `limit`
- **`Massive/get_option_contract`**: Details for a single contract.
  - `path_params`: `optionsTicker` (e.g., `O:AAPL250620C00150000`)
- **`Massive/get_option_bars`**: Historical OHLCV bars for an option contract.
  - `path_params`: `optionsTicker`, `multiplier`, `timespan`, `from`, `to`
- **`Massive/get_option_previous_day`**: Previous day data for an option contract.
  - `path_params`: `optionsTicker`
- **`Massive/get_option_open_close`**: Daily open/close for an option contract.
  - `path_params`: `optionsTicker`, `date`

### Forex
- **`Massive/get_forex_bars`**: Historical OHLCV bars for a currency pair.
  - `path_params`: `forexTicker` (format `C:EURUSD`), `multiplier`, `timespan`, `from`, `to`
- **`Massive/get_forex_quotes`**: Tick-level / historical BBO quotes.
  - `path_params`: `forexTicker`
  - `query`: `limit`
- **`Massive/get_forex_last_quote`**: Real-time forex quote.
  - `path_params`: `from`, `to`
- **`Massive/get_forex_previous_day`**: Previous day forex data.
  - `path_params`: `forexTicker`
- **`Massive/get_forex_market_snapshot`**: Snapshot of all forex pairs.
- **`Massive/get_forex_top_movers`**: Top forex movers.
  - `path_params`: `direction` (`gainers`|`losers`)
- **`Massive/convert_currency`**: Real-time currency conversion.
  - `path_params`: `from`, `to`
  - `query`: `amount`

### Crypto
- **`Massive/get_crypto_bars`**: Crypto OHLCV bars.
  - `path_params`: `cryptoTicker` (format `X:BTCUSD`), `multiplier`, `timespan`, `from`, `to`
- **`Massive/get_crypto_previous_day`**: Previous day crypto data.
  - `path_params`: `cryptoTicker`
- **`Massive/get_crypto_daily_summary`**: Daily crypto market summary for a date.
  - `path_params`: `date`
- **`Massive/get_crypto_open_close`**: Daily open/close for a crypto pair.
  - `path_params`: `from`, `to`, `date`
- **`Massive/get_crypto_market_snapshot`**: Snapshot of all crypto pairs.
- **`Massive/get_crypto_top_movers`**: Top crypto movers.
  - `path_params`: `direction` (`gainers`|`losers`)
- **`Massive/get_crypto_trades`**: Tick-level crypto trades.
  - `path_params`: `cryptoTicker`
  - `query`: `limit`
- **`Massive/get_crypto_last_trade`**: Most recent crypto trade.
  - `path_params`: `from`, `to`

### Macroeconomic
- **`Massive/get_treasury_yields`**: Treasury yields (7 maturities, back to 1962).
  - `query`: `limit`, optional date filters.
- **`Massive/get_inflation`**: CPI and core CPI time series.
  - `query`: `limit`, optional date filters.
- **`Massive/get_inflation_expectations`**: Market-implied and Fed model-based inflation expectations.
  - `query`: `limit`, optional date filters.
- **`Massive/get_labor_market`**: Unemployment rate, participation rate, hourly earnings.
  - `query`: `limit`, optional date filters.

---

## 3. Execution Examples

### Example 1: Stock Bars (OHLCV)
```python
import sys
sys.path.append('/opt/.manus/.sandbox-runtime')
from data_api import ApiClient

client = ApiClient()
result = client.call_api('Massive/get_stock_bars', path_params={
    'stocksTicker': 'AAPL',
    'multiplier': '1',
    'timespan': 'day',
    'from': '2025-01-01',
    'to': '2025-03-31',
}, query={'adjusted': 'true', 'sort': 'asc', 'limit': '100'})
```

### Example 2: Multi-Quarter Income Statements
```python
import sys
sys.path.append('/opt/.manus/.sandbox-runtime')
from data_api import ApiClient

client = ApiClient()
result = client.call_api('Massive/get_income_statements', query={
    'tickers': 'TSLA',
    'timeframe': 'quarterly',
    'sort': 'period_end.desc',
    'limit': '4',
})
```

### Example 3: Stock Screening with Financial Ratios
```python
result = client.call_api('Massive/get_financial_ratios', query={
    'return_on_equity.gte': '0.15',
    'price_to_earnings.lte': '25',
    'limit': '50',
})
```

### Example 4: Treasury Yield Curve
```python
result = client.call_api('Massive/get_treasury_yields', query={'limit': '30'})
```

---

## 4. Response Schema Highlights

### Bar Data (`get_stock_bars`, `get_crypto_bars`, `get_forex_bars`, `get_option_bars`)
Returns a `results` array where each bar contains:
- `c`: Close price
- `h`: High price
- `l`: Low price
- `o`: Open price
- `v`: Trading volume
- `vw`: Volume-weighted average price
- `t`: Unix millisecond timestamp (MUST convert to human-readable date)

### Financial Statements (`get_income_statements`, `get_balance_sheets`, `get_cash_flow_statements`)
Returns a `results` array containing point-in-time financial metrics:
- **Balance Sheet Keys**: `cash_and_cash_equivalents`, `total_assets`, `total_liabilities`, `retained_earnings`, `common_stock_shares_outstanding`.
- **Income Statement Keys**: `revenues`, `cost_of_revenue`, `gross_profit`, `operating_expenses`, `net_income_loss`, `basic_earnings_per_share`.
- **Cash Flow Keys**: `net_cash_flow_from_operating_activities`, `net_cash_flow_from_investing_activities`, `net_cash_flow_from_financing_activities`.
- **Period Metadata**: `fiscal_year`, `fiscal_quarter`, `timeframe`, `period_end`, `filing_date`.

### Financial Ratios (`get_financial_ratios`)
Returns a `results` array with per-ticker ratio values (e.g., `price_to_earnings`, `return_on_equity`, `ev_to_ebitda`). Supports `.gte` / `.lte` range filters on each ratio for screening.

### Macro Series (`get_treasury_yields`, `get_inflation`, `get_labor_market`)
Returns a `results` array of dated observations, e.g., `{"date": "1962-01-02", "yield_1_year": 3.x, ...}` or `{"date": "1947-01-01", "cpi": 21.48}`.

---

## 5. Verified-Invalid Names (Do NOT Use)

The following names have been tested and return "api not found". Use the confirmed name on the right instead.

| Invalid name | Use instead |
| --- | --- |
| `Massive/get_edgar_index` | `Massive/get_sec_edgar_index` |
| `Massive/get_top_market_movers` | `Massive/get_top_movers` |
| `Massive/get_quotes` | `Massive/get_stock_quotes` |
| `Massive/get_trades` | `Massive/get_stock_trades` |
| `Massive/get_single_ticker_snapshot` | `Massive/get_stock_snapshot` |
| `Massive/get_13f_filings` | (not available) |
| `Massive/get_form3`, `Massive/get_form4` | (not available; use `get_sec_edgar_index`) |
