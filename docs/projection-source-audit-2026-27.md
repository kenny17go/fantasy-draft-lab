# 2026–27 projection source audit (2026-10-10)

Goal: legal, no-paid-API, mobile-friendly full 9-category auction projections. This document records public-page findings, not an authorization to republish third-party data.

| Source | Confirmed public fields | Critical gaps | Decision |
| --- | --- | --- | --- |
| DARKO Fantasy Lab https://www.darko.app/projections | 353 players, 9-cat mode, downloadable CSV, projected per-game box-score | Projected GP, Yahoo eligible positions, CSV columns, redistribution rights not verified | Candidate for user-provided CSV adapter only after inspecting a genuine export |
| Fantasy Basketball Encyclopedia https://chronicaria.github.io/fantasy/basketball/projections/2026-27-fantasy-basketball-player-projections.html | 2026–27 machine-readable CSV and GP | Its own audit says just 54 of 262 qualifying players have complete shot data (FGA, FTA, FG%, FT%); insufficient for full 9-cat auction | Reject as primary data source |
| Basketball-Reference Simple Projection System https://www.basketball-reference.com/friv/projections.cgi | 2026–27 FG, FGA, FT, FTA, 3P, rebounds, etc. | Per-36-minute numbers, without confirmed projected MPG, GP or Yahoo eligibility | Reference only; do not fabricate exposure |
| Yahoo Fantasy | User has shown projected stats table | Official API/OAuth access, data export, and reuse terms unverified | Keep manual user-authorized import, do not scrape |

## Acceptance gates before enabling any automatic feed
1. Explicit permission or license for automated retrieval and public-app usage; never infer this from public accessibility or a download button.
2. Season and horizon match 2026–27 full-season preseason projections, not previous-year actuals.
3. At least 168 players with valid GP, PTS, REB, AST, STL, BLK, 3PM, TO, FGM, FGA, FTM, FTA.
4. Position eligibility sourced from Yahoo or separately validated; do not guess Yahoo position eligibility.
5. Every imported number carries source name, update date and per-game vs season-total units.
6. Fail closed on incomplete fields, do not silently fill attempts or games.
7. Keep all user draft records local and never require Yahoo credentials.

## Immediate next test
Obtain one **user-authorized** DARKO CSV export and inspect its header and 2–3 representative rows (without assuming fields). If it includes all primitives and a legitimate projected-GP source is available, implement a source-specific import adapter and unit tests. Otherwise keep Yahoo's user-provided data as the preferred input.
