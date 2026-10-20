#!/usr/bin/env python3
"""Read-only season discovery. No inferred NBA PDF URLs and no auto-publishing."""
import argparse
import datetime as dt
import json
import pathlib
import re

def current_season(today):
    year=today.year if today.month>=7 else today.year-1
    return f"{year}-{(year+1)%100:02d}"

def discover(data_dir,today):
    published={}
    for path in data_dir.glob("nba-????-??.csv"):
        match=re.fullmatch(r"nba-(20\\d{2}-\\d{2})\\.csv",path.name)
        if match:
            published[match.group(1)]=path.name
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
