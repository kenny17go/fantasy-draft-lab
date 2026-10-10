# Fantasy Draft Lab

Mobile-first, browser-only Yahoo Fantasy Basketball auction draft assistant.

## Current status
V0.1 foundation preview (not a production-ready fantasy valuation tool).

- 14-team H2H 9-Cat, $200, 12 drafted players/team (168 total), 1 IL.
- 14-team ROTO 9-Cat, $200, 9 drafted players/team (126 total), 1 IL.
- Track winning bids, enforce minimum $1 per remaining roster spot, prevent duplicate player purchases.
- Separate localStorage draft state per mode, JSON backup/import, undo last pick.
- No player projection dataset, Z-scores, salary valuation, Yahoo API integration, or auto-bidding yet.

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
