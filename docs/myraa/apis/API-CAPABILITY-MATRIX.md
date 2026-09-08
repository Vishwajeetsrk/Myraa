# MYRAA — API Capability Matrix

> Capability language, not API names. Planner selects capability → skill → tool → connector → provider.

| Capability | Skill | Tool | Connector | Provider | Voice | Status |
|------------|-------|------|-----------|----------|-------|--------|
| Weather Intelligence | weather skill (new) | myraa.weather.get | weather | Open-Meteo (live verified 2026-09-08) | yes | connected |
| Currency Intelligence (read-only) | finance-info (new) | myraa.currency.convert | currency | Frankfurter (.dev, live verified 2026-09-08) | yes | connected |
| GitHub Development | github skill (extend) | github.repo_list/repo_tree/read_file/search_code | github | GitHub REST (read live 2026-09-08) | yes | connected (write gated) |
| Gmail Productivity | gmail skill (extend) | gmail.search/send | gmail | Gmail API | yes | infra REAL / API MOCK |
| Calendar & Briefing | planning skill (extend daily-briefing/) | calendar.get_events/get_holidays | google-calendar + holidays | Google (planned) + Nager.Date (live 2026-09-08) | yes | holidays connected / events planned |
| Drive Search | file-intelligence (extend) | drive.search + files.search | google-drive | Drive API | yes | planned |
| Web Research | web-research/ (existing) | web.search | web-research | DuckDuckGo + Wikipedia (existing) | yes | REAL — keep, canonicalize |
| News Intelligence | news (new, RSS first) | news.headlines/search | news | Publisher RSS (curated, live 2026-09-08) | yes | connected |
| Book Knowledge | study-mode (extend) | knowledge.book_lookup | knowledge-books | Open Library | yes | candidate |
| Windows Control | computer-agent/ (existing) | system.open_app/file_operation | tauri-core | Win32/PS (desktopAutomation.cjs) | yes | REAL & WORKING — keep |
| Universal Search | file-intelligence (extend) | files.search | universal-search | local + connectors | yes | partial — needs aggregator |

## Graph example
```
Weather Intelligence → Weather Skill → weather.get → Weather Connector → Open-Meteo
GitHub Development → GitHub Skill → github.search_code → GitHub Connector → GitHub API
```
