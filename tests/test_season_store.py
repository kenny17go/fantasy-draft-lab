import pathlib
import tempfile
import unittest
import sys
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]/"scripts"))
from season_store import validate,publish,merge_cup

ROOT=pathlib.Path(__file__).resolve().parents[1]
class SeasonStoreTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.original=(ROOT/"data/nba-2026-27.csv").read_text(encoding="utf-8")
    def test_real_fixed_schedule(self):
        self.assertEqual(validate(self.original,"2026-27")["games"],1200)
    def test_cross_season_simulation(self):
        simulated=chr(10).join(
            str(int(line[:4])+1)+line[4:] if line[:4] in ("2026","2027") else line
            for line in self.original.splitlines()
        )
        self.assertEqual(validate(simulated,"2027-28")["games"],1200)
    def test_failure_keeps_published_file(self):
        with tempfile.TemporaryDirectory() as directory:
            target=pathlib.Path(directory)/"published.csv"
            target.write_text(self.original,encoding="utf-8")
            bad=pathlib.Path(directory)/"bad.csv"
            bad.write_text("date,home,away\n2027-02-30,NYK,BOS\n",encoding="utf-8")
            with self.assertRaises(ValueError):
                publish(bad,target,"2026-27","fixed")
            self.assertEqual(target.read_text(encoding="utf-8"),self.original)
    def test_cup_merge_adds_one_valid_game(self):
        import csv,io,collections
        original=list(csv.DictReader(io.StringIO(self.original)))
        count=collections.Counter(team for r in original for team in (r["home"],r["away"]))
        candidates=[a for a in sorted(count) if count[a]==80]
        existing={(r["date"],frozenset((r["home"],r["away"]))) for r in original}
        date="2027-01-01"
        pair=next((a,b) for a in candidates for b in candidates if a<b and (date,frozenset((a,b))) not in existing)
        extra="date,home,away"+chr(10)+date+","+pair[0]+","+pair[1]+chr(10)
        merged=merge_cup(self.original,extra,"2026-27")
        self.assertEqual(validate(merged,"2026-27","cup")["games"],1201)
    def test_cup_duplicate_rejected(self):
        first=self.original.splitlines()[1]
        with self.assertRaises(ValueError):
            merge_cup(self.original,"date,home,away"+chr(10)+first+chr(10),"2026-27")
    def test_cup_invalid_team_rejected(self):
        with self.assertRaises(ValueError):
            merge_cup(self.original,"date,home,away"+chr(10)+"2027-01-01,XYZ,BOS"+chr(10),"2026-27")
    def test_cup_rejects_missing_additions(self):
        with self.assertRaises(ValueError):
            merge_cup(self.original,"date,home,away"+chr(10),"2026-27")
    def test_publish_archives_previous_version(self):
        with tempfile.TemporaryDirectory() as directory:
            folder=pathlib.Path(directory)
            source=folder/"source.csv"
            target=folder/"published.csv"
            source.write_text(self.original,encoding="utf-8")
            target.write_text(self.original,encoding="utf-8")
            publish(source,target,"2026-27","fixed")
            snapshots=list((folder/"archive"/"2026-27").glob("*.csv"))
            self.assertEqual(len(snapshots),1)
            self.assertEqual(snapshots[0].read_text(encoding="utf-8"),self.original)
            self.assertEqual(target.read_text(encoding="utf-8"),self.original)
    def test_duplicate_rejected(self):
        with self.assertRaises(ValueError):
            validate(self.original+self.original.splitlines()[1]+"\n","2026-27")
if __name__=="__main__": unittest.main()
