#!/usr/bin/env python3
"""Match saved Yahoo projections against current ESPN NBA team rosters.
Never overwrite stats, prices or league picks; leave ambiguous players unchanged.
"""
import argparse,datetime,json,re,unicodedata,urllib.request
from pathlib import Path
TEAMS=['atl','bos','bkn','cha','chi','cle','dal','den','det','gs','hou','ind','lac','lal','mem','mia','mil','min','no','ny','okc','orl','phi','pho','por','sac','sa','tor','uta','was']
ALIASES={'gs':'GSW','no':'NOP','ny':'NYK','pho':'PHX','sa':'SAS','uta':'UTA','was':'WAS'}
def norm(s):
 s=unicodedata.normalize('NFKD',s).casefold()
 return re.sub('[^a-z0-9]','', ''.join(c for c in s if not unicodedata.combining(c)))
def fetch():
 names={}
 for code in TEAMS:
  req=urllib.request.Request('https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/'+code+'/roster',headers={'User-Agent':'FantasyDraftLab/1.0'})
  with urllib.request.urlopen(req,timeout=20) as response:data=json.load(response)
  athletes=data.get('athletes',[])
  if not athletes:raise ValueError('Missing roster for '+code+'; abort without writing')
  season=data.get('season',{})
  if season.get('year')!=2027:raise ValueError('Unexpected season for '+code+': '+str(season))
  for athlete in athletes:
   name=athlete.get('fullName') or athlete.get('displayName')
   if name:names.setdefault(norm(name),set()).add(ALIASES.get(code,code.upper()))
 return names
def match(backup,names):
 output=json.loads(json.dumps(backup,ensure_ascii=False))
 report={'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'source':'ESPN NBA rosters','matched':0,'unmatched':[],'ambiguous':[]}
 for p in output['projections']:
  found=names.get(norm(p['player']),set())
  if len(found)==1:p['nbaTeam']=next(iter(found));report['matched']+=1
  elif len(found)>1:report['ambiguous'].append(p['player'])
  else:report['unmatched'].append(p['player'])
 return output,report
def main():
 parser=argparse.ArgumentParser();parser.add_argument('backup',type=Path);parser.add_argument('--output',type=Path,required=True);parser.add_argument('--report',type=Path,required=True);args=parser.parse_args()
 backup=json.loads(args.backup.read_text(encoding='utf-8'))
 if backup.get('format')!='fantasy-draft-lab-backup' or not isinstance(backup.get('projections'),list):raise ValueError('Invalid backup')
 output,report=match(backup,fetch())
 if report['matched']<max(1,int(len(backup['projections'])*0.65)):raise ValueError('Insufficient matches: refusing to write')
 args.output.write_text(json.dumps(output,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 args.report.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 print(report)
if __name__=='__main__':main()
