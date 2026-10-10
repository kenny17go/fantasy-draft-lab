# Fantasy Draft Lab

Mobile-first, browser-only Yahoo Fantasy Basketball auction draft assistant.

## Current status
V0.6 H2H punt / ROTO standings preview (not a production-ready fantasy valuation tool).

- 14-team H2H 9-Cat, $200, 12 drafted players/team (168 total), 1 IL.
- 14-team ROTO 9-Cat, $200, 9 drafted players/team (126 total), 1 IL.
- Track winning bids, enforce minimum $1 per remaining roster spot, prevent duplicate player purchases.
- Separate localStorage draft state per mode, JSON backup/import, undo last pick.
- CSV projection import and nine-category Z-scores using GP-weighted totals and attempt-weighted FG/FT impact.\n- Replacement-level, budget-conserving auction price estimates that reprice after sales.\n- Bipartite matching validates whether imported players can occupy the team's Yahoo PG/SG/G/SF/PF/F/C/UTIL/BN slots.\n- Capped mandatory-position supply/demand heuristic in auction estimates, and isolated 14-team deterministic draft simulation.\n- No bundled projection dataset, optimal position-constrained valuation, Yahoo API integration, or auto-bidding yet.

## Run
Serve the repository as static files and open the local URL.
Run `npm test` with Node.js 22+.

## Next milestones
1. Validated player projection CSV import (FGM/FGA/FTM/FTA, nine categories, GP, position).
2. 9-Cat weighted Z-score model and reproducible tests.
3. Auction replacement-level value with 168/126-player baselines and budget conservation.
4. Position eligibility and roster feasibility, H2H/ROTO recommendation models.
5. GitHub Pages after review.

## Data and privacy
No copyrighted third-party projection tables are bundled. All picks remain on the device unless the user exports a backup.

MIT licensed.

## Projection CSV contract
Columns: `player,positions,gp,pts,reb,ast,stl,blk,three,tov,fgm,fga,ftm,fta`. All statistics except GP are projected per-game values; `three` is 3PM and `tov` is turnovers. `positions` uses slash-separated Yahoo eligible base positions, e.g. `PG/SG`. Import at least two players. Z-scores are calculated across the imported population, so a partial CSV is **not** a league-wide ranking. FG/FT impact uses (makes - population-average percentage × attempts) × GP. This first implementation uses season totals and is **not yet** a lineup-adjusted, position-constrained, or ROTO points model. Data is stored in this browser's localStorage; use only projection data you are authorized to import.

## V0.3 valuation limitations
For each league, the model reserves $1 for every unfilled roster slot, uses the worst 9-Cat score among the remaining draftable pool as the replacement baseline, and allocates remaining dollars in proportion to positive surplus. Integer rounding conserves all remaining league dollars. Purchased players are excluded and actual sale prices reduce the remaining pool. **These are indicative model prices, not Yahoo average auction values or legal maximum bids.** V0.3 does not yet solve position-eligible roster assignment, lineup/bench playing time, category-punt strategy, ROTO standings, injuries or scarcity adjustments. Upload a broad projection pool (at least 168 players for H2H or 126 for ROTO); partial data can give misleading estimates.

## V0.4 position checks
The draft tracker checks roster feasibility for players whose names exactly match imported projections. Multiple eligible positions can be reassigned to fit the whole roster. Unknown manually entered names are flagged as **unverified** rather than given invented eligibility. Current auction estimates remain Z-score replacement-level values and **do not yet incorporate position scarcity**; league-wide position-constrained optimal allocation and individual team price adjustments are pending. This is not a Yahoo roster sync.

## V0.5 scope and caveats
The scarcity heuristic compares mandatory base-position slot demand (PG, SG, SF, PF, C) with eligible-player supply in the uploaded pool, and applies a capped 0.35 Z-score bonus. Flexible positions are not counted in demand. This is a transparent approximation, **not** an exact position-constrained auction equilibrium. The full-draft simulation assigns players greedily to each team, verifies each team's final roster via bipartite matching, and uses deterministic $1 bids plus a final-slot spend to test $2,800 conservation. It does **not** model rational market bids and may fail for some pools even if a different assignment exists. Simulations never modify actual draft records.

## V0.6 strategy analysis
H2H: Punt checkboxes remove selected category Z-scores from displayed player ranking. This is a strategy ranking, **not** a change to auction dollar valuation. ROTO: when all 14 teams have nine drafted players each and all player projections are available, the app totals projected seasonal categories, calculates attempt-weighted team FG%/FT%, ranks all 14 teams in each of nine categories (TO ascending), and averages occupied ranking points on ties. ROTO results are not shown for incomplete leagues; these are projections, not live Yahoo standings. IL slots are excluded.
