"""Source catalogue tests use tiny temporary dumps; no corpus or queue mutations."""
import gzip
import hashlib
import importlib.util
import contextlib
import io
import json
from pathlib import Path
import sqlite3
import tempfile
import unittest

MODULE = Path(__file__).resolve().parents[1] / 'scripts/content/wiktionary-sources.py'
spec = importlib.util.spec_from_file_location('wiktionary_sources', MODULE)
w = importlib.util.module_from_spec(spec)
spec.loader.exec_module(w)


class SourceTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.queue = self.root / 'queue.sqlite'
        conn = sqlite3.connect(self.queue)
        conn.execute('CREATE TABLE entries(study_language TEXT,entry_json TEXT)')
        for language in w.LANGUAGES:
            conn.execute('INSERT INTO entries VALUES(?,?)', (language,json.dumps({'word':'café','partOfSpeech':'noun'})))
        conn.commit()
        conn.close()
        self.manifest = self.root / 'manifest.json'
        self.output = self.root / 'local-data/sources.sqlite'

    def tearDown(self):
        self.tmp.cleanup()

    def source(self, edition, rows, compressed=True):
        path = self.root / (edition + ('.jsonl.gz' if compressed else '.jsonl'))
        data = ''.join(json.dumps(row,ensure_ascii=False) + '\n' for row in rows).encode()
        path.write_bytes(gzip.compress(data) if compressed else data)
        return {'edition':edition,'path':path.name,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),
                'bytes':path.stat().st_size,'license':'CC-BY-SA-4.0',
                'licenseUrl':'https://creativecommons.org/licenses/by-sa/4.0/',
                'url':'https://example.org/' + path.name,'extractorRevision':'fixture'}

    def write_manifest(self, sources):
        self.manifest.write_text(json.dumps({'schemaVersion':1,'sources':sources}))

    def row(self, language='fr', **fields):
        return {'word':'café','lang_code':language,'pos':'noun','senses':[
            {'glosses':['a café'],'sense_index':'2','examples':[{'text':'Au café.','translation':'At the café.','type':'example'}]}], **fields}

    def test_stream_filters_exact_nfc_language_and_retains_raw_sense_evidence(self):
        original = self.row(word='cafe\u0301', etymology_number=2, unknown_field={'retained':True})
        self.write_manifest([self.source('en', [self.row(word='cafés'), self.row(language='it'), original,
                                              self.row(pos='verb')])])
        before = self.queue.read_bytes()
        report = w.build_catalog(self.queue,self.manifest,self.output)
        self.assertEqual(self.queue.read_bytes(),before)
        self.assertEqual(report['sources'][0]['rows'],2)
        conn = w.open_readonly(self.output)
        try:
            rows = w.find_rows(conn,'fr','café','noun')
            self.assertEqual(len(rows),1)
            self.assertEqual(rows[0]['row'],original)
            self.assertEqual(rows[0]['rowIndex'],3)
            expected = hashlib.sha256(json.dumps(original,ensure_ascii=False).encode()).hexdigest()
            self.assertEqual(rows[0]['rowDigest'],expected)
            self.assertEqual(rows[0]['provenance']['sourceRowDigest'],expected)
            self.assertEqual(rows[0]['snapshot']['extractorRevision'],'fixture')
            self.assertIn('en.wiktionary.org', rows[0]['provenance']['historyUrl'])
            sense = conn.execute('SELECT sense_id_json FROM senses LIMIT 1').fetchone()[0]
            self.assertEqual(json.loads(sense),{'sense_index':'2'})
            with self.assertRaises(sqlite3.OperationalError):
                conn.execute('DELETE FROM source_rows')
        finally:
            conn.close()

    def test_all_seven_editions_preserve_translation_language_and_never_accept(self):
        sources = [self.source(edition,[self.row(edition)],compressed=edition!='de') for edition in w.EDITIONS]
        self.write_manifest(sources)
        w.build_catalog(self.queue,self.manifest,self.output)
        conn = w.open_readonly(self.output)
        try:
            self.assertEqual(conn.execute('SELECT count(*) FROM sources').fetchone()[0],7)
            for edition in w.EDITIONS:
                with self.subTest(edition=edition):
                    example = conn.execute('SELECT e.translations_json,e.screening_json FROM examples e JOIN senses se ON se.id=e.sense_id JOIN source_rows r ON r.id=se.row_id JOIN sources s ON s.id=r.source_id WHERE s.edition=?',(edition,)).fetchone()
                    translations, screening = map(json.loads,example)
                    self.assertEqual(translations['translations'],{edition:'At the café.'})
                    self.assertFalse(screening['accepted'])
                    self.assertEqual(screening['status'],'candidate' if edition=='en' else 'rights-verification-needed')
        finally:
            conn.close()

    def test_quotation_reference_and_historical_attestation_are_held(self):
        cases = [({'text':'sentence','type':'quotation'},None),
                 ({'text':'sentence','type':'example','ref':'A book'},None),
                 ({'text':'sentence','type':'example','author':'An author'},None),
                 ({'text':'sentence','type':'example','attestations':[{'date':'1900'}]},None),
                 ({'text':'sentence','type':'example'},{'attestations':[{'date':'1900'}]}),
                 ({'text':'sentence','type':'example','tags':['quotation']},None)]
        for edition in w.EDITIONS:
            for example,sense in cases:
                with self.subTest(edition=edition,example=example):
                    self.assertEqual(w.classify_example(example,edition,sense)['status'],'rejected')
        self.assertEqual(w.classify_example({'text':'sentence'},'en')['status'],'rejected')
        self.assertEqual(w.classify_example({'text':'sentence'},'de')['status'],'rights-verification-needed')

    def test_legacy_english_is_not_relabelled_and_conflicting_text_is_preserved(self):
        self.assertEqual(w.example_translations({'translation':'French','english':'English'},'fr'),
                         {'translations':{'fr':'French','en':'English'},'conflict':False})
        self.assertEqual(w.example_translations({'translation':'First','english':'Second'},'en'),
                         {'translations':{'en':'First'},'legacyEnglish':'Second','conflict':True})

    def test_digest_failure_does_not_publish_or_replace_prior_catalogue(self):
        source = self.source('en',[self.row()])
        source['sha256'] = '0'*64
        self.write_manifest([source])
        self.output.parent.mkdir(parents=True)
        self.output.write_bytes(b'previous catalogue')
        with self.assertRaisesRegex(ValueError,'SHA256 mismatch'):
            w.build_catalog(self.queue,self.manifest,self.output,replace=True)
        self.assertEqual(self.output.read_bytes(),b'previous catalogue')
        self.assertEqual(list(self.output.parent.glob('*.tmp')),[])

    def test_byte_count_failure_does_not_publish(self):
        source = self.source('en',[self.row()]);source['bytes'] += 1
        self.write_manifest([source])
        with self.assertRaisesRegex(ValueError,'byte length mismatch'):
            w.build_catalog(self.queue,self.manifest,self.output)
        self.assertFalse(self.output.exists())

    def test_explicit_root_and_output_collision_checks(self):
        source = self.source('en',[self.row()])
        self.manifest = self.root / 'nested/manifest.json';self.manifest.parent.mkdir()
        self.write_manifest([source])
        w.build_catalog(self.queue,self.manifest,self.output,root=self.root)
        with self.assertRaises(FileExistsError):
            w.build_catalog(self.queue,self.manifest,self.output,root=self.root)
        with self.assertRaisesRegex(ValueError,'must not replace'):
            w.build_catalog(self.queue,self.manifest,self.queue,root=self.root,replace=True)

    def test_manifest_rejects_unidentified_or_unlicensed_sources(self):
        source = self.source('en',[self.row()])
        for key,value in [('sha256',''),('license',''),('licenseUrl',''),('edition','xx')]:
            with self.subTest(key=key):
                self.write_manifest([{**source,key:value}])
                with self.assertRaises(ValueError):
                    w.load_manifest(self.manifest)

    def test_readonly_missing_database_is_not_created(self):
        missing = self.root / 'missing.sqlite'
        with self.assertRaises(sqlite3.OperationalError):
            w.open_readonly(missing)
        self.assertFalse(missing.exists())

    def test_pos_case_and_spacing_normalise_without_merging_proper_nouns(self):
        for source, expected in [(' Verb ', 'verb'), ('Noun', 'noun'),
                                 ('Classifier', 'classifier'), ('ADJ', 'adjective'),
                                 ('Proper Noun', 'proper-noun'), ('Name', 'proper-noun')]:
            with self.subTest(source=source):
                self.assertEqual(w.normalise_pos(source), expected)
        self.write_manifest([self.source('zh', [self.row('zh',pos=' Noun '),self.row('zh',pos='Name')])])
        w.build_catalog(self.queue,self.manifest,self.output)
        conn = w.open_readonly(self.output)
        try:
            self.assertEqual(len(w.find_rows(conn,'zh','café','Noun')),1)
            self.assertEqual(len(w.find_rows(conn,'zh','café','Proper Noun')),1)
            self.assertEqual(w.find_rows(conn,'zh','café','Verb'),[])
        finally:
            conn.close()

    def test_progress_reports_each_verified_edition_to_stderr(self):
        self.write_manifest([self.source('en',[self.row()])])
        progress = io.StringIO()
        with contextlib.redirect_stderr(progress):
            w.build_catalog(self.queue,self.manifest,self.output)
        self.assertIn('Indexing Wiktionary edition en:',progress.getvalue())
        self.assertIn('Verified Wiktionary edition:',progress.getvalue())
        self.assertIn('"rows":1',progress.getvalue())


if __name__ == '__main__':
    unittest.main()
