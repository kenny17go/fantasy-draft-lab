#!/usr/bin/env python3
"""Validate and stage season CSVs. Never replace a valid published file on failure."""
import argparse
import collections
import csv
import datetime as dt
import io
import pathlib
import re

TEAMS=set("ATL BOS BKN CHA CHI CLE DAL DEN DET GSW HOU IND LAC LAL MEM MIA MIL MIN NOP NYK OKC ORL PHI PHX POR SAC SAS TOR UTA WAS".split())
def validate(text, season, stage="fixed"):
    if not re.fullmatch(r"20\d{2}-\d{2}",season) or int(season[-2:])!=(int(season[:4])+1)%100:
        raise ValueError("Invalid season label")
    rows=list(csv.DictReader(io.StringIO(text)))
    if not rows or set(rows[0])!={"date","home","away"}:
        raise ValueError("Invalid CSV header or empty schedule")
    seen=set()
    counts=collections.Counter()
    for row in rows:
        date=dt.date.fromisoformat(row["date"])
        if not dt.date(int(season[:4]),7,1)<=date<=dt.date(int(season[:4])+1,6,30):
            raise ValueError("Date outside season")
        h,a=row["home"],row["away"]
        if h not in TEAMS or a not in TEAMS or h==a:
            raise ValueError("Invalid teams")
        key=(date,tuple(sorted((h,a))))
        if key in seen: raise ValueError("Duplicate fixture")
        seen.add(key)
        counts.update((h,a))
    if len(counts)!=30: raise ValueError("Missing teams")
    if stage=="fixed":
        if len(rows)!=1200 or any(v!=80 for v in counts.values()):
            raise ValueError("Fixed schedule must have 1200 games and 80 per team")
    elif stage=="cup":
        if not 1200<=len(rows)<=1230 or any(not 80<=v<=82 for v in counts.values()):
            raise ValueError("Invalid Cup completion totals")
    else: raise ValueError("Unknown stage")
    return {"games":len(rows),"teams":len(counts),"min_team_games":min(counts.values()),"max_team_games":max(counts.values())}

def merge_cup(base_text, additions_text, season):
    """Add official Cup fixtures without mutating the fixed schedule.

    CSVs have date,home,away only; absent NBA game IDs mean changed dates
    cannot safely be inferred. Conflicts must be reviewed manually.
    """
    validate(base_text,season,"fixed")
    base=list(csv.DictReader(io.StringIO(base_text)))
    additions=list(csv.DictReader(io.StringIO(additions_text)))
    if not additions or set(additions[0])!={"date","home","away"}:
        raise ValueError("Cup additions must have date,home,away")
    existing={(r["date"],r["home"],r["away"]) for r in base}
    new=set()
    for r in additions:
        key=(r["date"],r["home"],r["away"])
        if key in existing or key in new:
            raise ValueError("Duplicate or already published Cup fixture")
        new.add(key)
    output=io.StringIO()
    writer=csv.DictWriter(output,fieldnames=["date","home","away"],lineterminator=chr(10))
    writer.writeheader()
    writer.writerows(sorted(base+additions,key=lambda r:(r["date"],r["home"],r["away"])))
    merged=output.getvalue()
    validate(merged,season,"cup")
    return merged

def publish(source,target,season,stage,archive_dir=None):
    """Validate before replacing, with an immutable SHA-256 snapshot of old data."""
    import hashlib
    import os
    import tempfile
    content=source.read_text(encoding="utf-8")
    result=validate(content,season,stage)
    target.parent.mkdir(parents=True,exist_ok=True)
    if target.exists():
        old=target.read_bytes()
        validate(old.decode("utf-8"),season,"cup" if len(list(csv.DictReader(io.StringIO(old.decode("utf-8")))))>1200 else "fixed")
        if archive_dir is None:
            archive_dir=target.parent/"archive"/season
        archive_dir.mkdir(parents=True,exist_ok=True)
        digest=hashlib.sha256(old).hexdigest()
        snapshot=archive_dir/(digest+".csv")
        if snapshot.exists():
            if snapshot.read_bytes()!=old: raise ValueError("Archive hash collision or corrupt snapshot")
        else:
            fd,tmp=tempfile.mkstemp(dir=archive_dir,prefix=".snapshot-",suffix=".csv")
            try:
                with os.fdopen(fd,"wb") as out:
                    out.write(old)
                    out.flush()
                    os.fsync(out.fileno())
                os.replace(tmp,snapshot)
            finally:
                if os.path.exists(tmp): os.unlink(tmp)
    fd,name=tempfile.mkstemp(dir=target.parent,prefix=".nba-stage-",suffix=".csv")
    try:
        with os.fdopen(fd,"w",encoding="utf-8",newline="") as out:
            out.write(content)
            out.flush()
            os.fsync(out.fileno())
        os.replace(name,target)
    finally:
        if os.path.exists(name): os.unlink(name)
    return result

def compare_schedule(old_text,new_text,season):
    """Return a reviewable diff; never guess whether changed dates are the same game."""
    validate(old_text,season,"cup" if len(list(csv.DictReader(io.StringIO(old_text))))>1200 else "fixed")
    validate(new_text,season,"cup" if len(list(csv.DictReader(io.StringIO(new_text))))>1200 else "fixed")
    def rows(text):
        return {(r["date"],r["home"],r["away"]) for r in csv.DictReader(io.StringIO(text))}
    old,new=rows(old_text),rows(new_text)
    removed=sorted(old-new)
    added=sorted(new-old)
    return {"added":[{"date":d,"home":h,"away":a} for d,h,a in added],
            "removed":[{"date":d,"home":h,"away":a} for d,h,a in removed],
            "requires_manual_review":bool(removed),
            "unchanged":len(old&new)}

def restore_snapshot(snapshot,target,season,expected_sha256):
    """Explicit SHA-256 guarded rollback. Archive current target before restore."""
    import hashlib
    if not re.fullmatch(r"[0-9a-f]{64}",expected_sha256):
        raise ValueError("Invalid expected SHA-256")
    data=snapshot.read_bytes()
    if hashlib.sha256(data).hexdigest()!=expected_sha256:
        raise ValueError("Snapshot digest mismatch")
    validate(data.decode("utf-8"),season,"cup" if len(list(csv.DictReader(io.StringIO(data.decode("utf-8")))))>1200 else "fixed")
    return publish(snapshot,target,season,"cup" if len(list(csv.DictReader(io.StringIO(data.decode("utf-8")))))>1200 else "fixed")

if __name__=="__main__":
    p=argparse.ArgumentParser()
    p.add_argument("--source",type=pathlib.Path,required=True)
    p.add_argument("--target",type=pathlib.Path,required=True)
    p.add_argument("--season",required=True)
    p.add_argument("--stage",choices=("fixed","cup"),default="fixed")
    args=p.parse_args()
    print(publish(args.source,args.target,args.season,args.stage))
