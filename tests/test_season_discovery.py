import datetime as dt
import pathlib
import tempfile
import unittest
import sys
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]/"scripts"))
from season_discovery import current_season,discover

class SeasonDiscoveryTests(unittest.TestCase):
    def test_rollover(self):
        self.assertEqual(current_season(dt.date(2027,6,30)),"2026-27")
        self.assertEqual(current_season(dt.date(2027,7,1)),"2027-28")
    def test_read_only_missing_season(self):
        with tempfile.TemporaryDirectory() as folder:
            path=pathlib.Path(folder)
            (path/"nba-2026-27.csv").write_text("date,home,away",encoding="utf-8")
            status=discover(path,dt.date(2027,10,20))
            self.assertEqual(status["target_season"],"2027-28")
            self.assertTrue(status["requires_official_source_review"])
            self.assertFalse(status["publish_allowed"])
            self.assertEqual(status["published_seasons"],["2026-27"])
if __name__=="__main__":unittest.main()
