import pathlib
import tempfile
import unittest
import sys
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]/"scripts"))
from season_store import validate,publish

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
    def test_duplicate_rejected(self):
        with self.assertRaises(ValueError):
            validate(self.original+self.original.splitlines()[1]+"\n","2026-27")
if __name__=="__main__": unittest.main()
