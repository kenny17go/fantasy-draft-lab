#!/usr/bin/env python3
"""Read-only season discovery. No inferred NBA PDF URLs and no auto-publishing."""
import argparse
import datetime as dt
import json
import pathlib

def current_season(today):
    year=today.year if today.month>=7 else today.year-1
    return f"{year}-{(year+1)%100:02d}"

def discover(data_dir,today):
    published={}
    for path in data_dir.glob("nba-????-??.csv"):
        season=path.stem.removeprefix("nba-")
        if len(season)==7 and season[:4].isdigit() and season[4]=="-" and season[5:].isdigit() and season.startswith("20") and int(season[5:])==(int(season[:4])+1)%100:
            published[season]=path.name
    target=current_season(today)
    return {"target_season":target,"published_seasons":sorted(published),
            "requires_official_source_review":target not in published,
            "publish_allowed":False}

if __name__=="__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("--data-dir",type=pathlib.Path,default=pathlib.Path("data"))
    parser.add_argument("--date",type=dt.date.fromisoformat,default=dt.date.today())
    args=parser.parse_args()
    print(json.dumps(discover(args.data_dir,args.date),ensure_ascii=False,indent=2))
