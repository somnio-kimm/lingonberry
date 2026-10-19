import contextlib
import importlib.util
import io
import json
import os
import sqlite3
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('english_source_verifier', ROOT / 'scripts/content/verify-english-correction-sources.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class EnglishSourceEvidenceTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.previous = Path.cwd()
        os.chdir(self.root)
        folder = self.root / 'language-packages/sources/meaning-reviews/en-3.0.0'
        folder.mkdir(parents=True)
        self.review = {'id': 'spin', 'index': 0, 'digest': 'd' * 64, 'status': 'correction-proposed'}
        (folder / 'entries.jsonl').write_text(json.dumps(self.review) + '\n')
        self.directory = self.root / 'corrections'
        self.directory.mkdir()
        self.catalog = self.root / 'sources.sqlite'
        raw = {'word': 'spin', 'lang_code': 'en', 'senses': [{'glosses': ['Intrinsic angular momentum.']}]}
        self.provenance = {'creator': 'English Wiktionary contributors', 'license': 'CC-BY-SA-4.0', 'licenseUrl': 'https://creativecommons.org/licenses/by-sa/4.0/', 'url': 'https://en.wiktionary.org/wiki/spin', 'historyUrl': 'https://en.wiktionary.org/w/index.php?title=spin&action=history', 'snapshotSha256': 'a' * 64, 'sourceLine': 7, 'sourceRowDigest': module.digest(raw)}
        conn = sqlite3.connect(self.catalog)
        conn.executescript('CREATE TABLE sources(id INTEGER,snapshot_json TEXT); CREATE TABLE source_rows(source_id INTEGER,source_line INTEGER,language TEXT,row_digest TEXT,raw_json TEXT,provenance_json TEXT);')
        conn.execute('INSERT INTO sources VALUES(?,?)', (1, json.dumps({'sha256': 'a' * 64})))
        conn.execute('INSERT INTO source_rows VALUES(?,?,?,?,?,?)', (1, 7, 'en', module.digest(raw), json.dumps(raw), json.dumps(self.provenance)))
        conn.commit()
        conn.close()
        self.decision = {**self.review, 'decision': 'correct', 'evidence': [{**self.provenance, 'senseOrdinal': 1, 'glosses': ['Intrinsic angular momentum.']}]}

    def tearDown(self):
        os.chdir(self.previous)
        self.temp.cleanup()

    def run_check(self):
        (self.directory / 'a-decisions.jsonl').write_text(json.dumps(self.decision) + '\n')
        with contextlib.redirect_stdout(io.StringIO()):
            failed = module.verify(self.directory, self.catalog, self.directory / 'report.json')
        return failed, json.loads((self.directory / 'report.json').read_text())

    def test_actual_row_and_selected_sense_are_verified(self):
        failed, report = self.run_check()
        self.assertFalse(failed)
        self.assertEqual(report['proofsVerified'], 1)
        self.assertEqual(report['decisionDigest'], module.digest([self.decision]))

    def test_invented_gloss_licence_position_or_digest_is_rejected(self):
        original = dict(self.decision['evidence'][0])
        for field, wrong in [('glosses', ['Hair spray.']), ('license', 'CC0-1.0'), ('sourceLine', 99), ('senseOrdinal', 0), ('sourceRowDigest', '0' * 64)]:
            with self.subTest(field=field):
                self.decision['evidence'][0] = {**original, field: wrong}
                failed, report = self.run_check()
                self.assertTrue(failed)
                self.assertEqual(report['failures'][0]['id'], 'spin')
