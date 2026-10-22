#!/usr/bin/env python3
"""Extract 2026-27 fixed NBA regular-season fixtures from the NBA by-date PDF.
Usage: pdftotext -layout schedule.pdf schedule.txt
       python3 scripts/build_nba_schedule.py schedule.txt data/nba-2026-27.csv
No fabricated NBA Cup TBD games are added.
"""
import collections
import csv
import datetime
import pathlib
import re
import sys

TEAMS = {
 "Atlanta":"ATL","Boston":"BOS","Brooklyn":"BKN","Charlotte":"CHA",
 "Chicago":"CHI","Cleveland":"CLE","Dallas":"DAL","Denver":"DEN",
 "Detroit":"DET","Golden State":"GSW","Houston":"HOU","Indiana":"IND",
 "LA Clippers":"LAC","LA Lakers":"LAL","Memphis":"MEM","Miami":"MIA",
 "Milwaukee":"MIL","Minnesota":"MIN","New Orleans":"NOP","New York":"NYK",
 "Oklahoma City":"OKC","Orlando":"ORL","Philadelphia":"PHI","Phoenix":"PHX",
 "Portland":"POR","Sacramento":"SAC","San Antonio":"SAS","Toronto":"TOR",
 "Utah":"UTA","Washington":"WAS",
}
PATTERN = re.compile(
 r"^\s*(\d{1,4})\s+(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\.\s+"
 r"(\d{1,2}/\d{1,2}/\d{2})\s+(.+?)\s+(at|vs)\s+(.+?)\s+"
 r"\d{1,2}:\d{2}\s*[AP]M\s+\d{1,2}:\d{2}\s*[AP]M(?:\s|$)"
)
def build(text):
 games = []
 game_ids = set()
 for line in text.splitlines():
  match = PATTERN.match(line)
  if not match:
   continue
  game_id, date, visitor, relation, opponent = match.groups()
  if visitor not in TEAMS or opponent not in TEAMS:
   raise ValueError("Unknown NBA team in schedule line: " + line)
  game_id = int(game_id)
  if game_id in game_ids:
   raise ValueError("Duplicate game id: " + str(game_id))
  game_ids.add(game_id)
  day = datetime.datetime.strptime(date, "%m/%d/%y").date().isoformat()
  if relation == "at":
   away, home = TEAMS[visitor], TEAMS[opponent]
  else:
   # Neutral venue: mark opponent as the second team for a consistent
   # two-team representation; home/away is not implied.
   away, home = TEAMS[visitor], TEAMS[opponent]
  games.append((day, home, away, game_id, relation == "vs"))
 counts = collections.Counter(t for _,home,away,_,_ in games for t in (home,away))
 # NBA announced 80 fixed fixtures per team; two Cup fixtures per team TBD.
 if len(games) != 1200 or set(counts) != set(TEAMS.values()) or any(n != 80 for n in counts.values()):
  raise ValueError("Schedule incomplete: %s games; team totals: %s" % (len(games), dict(sorted(counts.items()))))
 if len({(date,tuple(sorted((home,away)))) for date,home,away,_,_ in games}) != len(games):
  raise ValueError("Duplicate matchup on same date")
 return sorted(games)
def main():
 src, dest = map(pathlib.Path, sys.argv[1:3])
 games = build(src.read_text(encoding="utf-8"))
 dest.parent.mkdir(parents=True, exist_ok=True)
 with dest.open("w", newline="", encoding="utf-8") as output:
  writer = csv.writer(output)
  writer.writerow(["date","home","away"])
  writer.writerows((date,home,away) for date,home,away,_,_ in games)
 print("PASS: 1200 fixed games, 30 teams x 80 scheduled games; NBA Cup TBD omitted.")
if __name__ == "__main__":
 main()
