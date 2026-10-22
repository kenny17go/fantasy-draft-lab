#!/usr/bin/env python3
"""Build a player -> NBA team lookup from FantasyPros' public NBA rankings table.

Run on a networked CI runner. Does not change Yahoo projections or prices.
Fails closed when the page lacks a sufficiently large roster table.
"""
import argparse
import datetime
import html
import json
import re
import unicodedata
import urllib.request
from html.parser import HTMLParser
from pathlib import Path

URL = "https://www.fantasypros.com/nba/rankings/overall/"
TEAMS = set("ATL BOS BKN CHA CHI CLE DAL DEN DET GSW HOU IND LAC LAL MEM MIA MIL MIN NOP NYK OKC ORL PHI PHX POR SAC SAS TOR UTA WAS".split())
ALIASES = {"GS":"GSW","NO":"NOP","NOR":"NOP","NY":"NYK","PHO":"PHX","SA":"SAS","UTH":"UTA","UTAH":"UTA","WSH":"WAS"}
PLAYER = re.compile(r"^(.+?)\s*\(([A-Z]{2,4})\s*-\s*(?:PG|SG|SF|PF|C)(?:[,/](?:PG|SG|SF|PF|C))*\)$")

class Cells(HTMLParser):
    def __init__(self):
        super().__init__(); self.depth=0; self.buffer=[]; self.cells=[]
    def handle_starttag(self, tag, attrs):
        if tag in ("td","th"):
            if self.depth==0: self.buffer=[]
            self.depth+=1
    def handle_endtag(self, tag):
        if tag in ("td","th") and self.depth:
            self.depth-=1
            if not self.depth:self.cells.append(html.unescape(" ".join(self.buffer)).strip())
    def handle_data(self, data):
        if self.depth:self.buffer.append(data.strip())

def norm(name):
    name=unicodedata.normalize("NFKD",name).casefold()
    return re.sub(r"[^a-z0-9]","", "".join(c for c in name if not unicodedata.combining(c)))

def extract(page):
    parser=Cells();parser.feed(page)
    result={};conflicts=set()
    for cell in parser.cells:
        cell=" ".join(cell.split())
        match=PLAYER.match(cell)
        if not match:continue
        name,team=match.groups();team=ALIASES.get(team,team)
        if team not in TEAMS:continue
        key=norm(name)
        if key in result and result[key]["team"]!=team:conflicts.add(key)
        else:result[key]={"name":name,"team":team}
    for key in conflicts:result.pop(key,None)
    return result,sorted(conflicts)

def main():
    p=argparse.ArgumentParser();p.add_argument("--output",type=Path,required=True);p.add_argument("--min-players",type=int,default=150);args=p.parse_args()
    request=urllib.request.Request(URL,headers={"User-Agent":"Mozilla/5.0 (compatible; FantasyDraftLab/1.0)"})
    with urllib.request.urlopen(request,timeout=30) as response:
        page=response.read().decode("utf-8","replace")
    players,conflicts=extract(page)
    if len(players)<args.min_players:
        raise SystemExit(f"Only {len(players)} players extracted; refusing to replace existing data")
    data={"source":URL,"updatedAt":datetime.datetime.now(datetime.timezone.utc).isoformat(),"players":players,"conflicts":conflicts}
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(data,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(f"Extracted {len(players)} players; {len(conflicts)} conflicts")

if __name__=="__main__":main()
