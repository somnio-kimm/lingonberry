import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec=importlib.util.spec_from_file_location('wiktionary_reuse',Path(__file__).resolve().parents[1]/'scripts/content/reuse-wiktionary.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
q=m.queue


class WiktionaryReuseTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.root=Path(self.temp.name)
        self.db=self.root/'queue.sqlite';self.catalog=self.root/'sources.sqlite';self.report=self.root/'report.json'
        self.conn=q.open_queue(self.db)
        entry={'id':'de-apple','word':'Apfel','partOfSpeech':'noun','level':'A1'}
        evidence={'meanings':{'en':{'text':'apple'}},'examples':[],'generation_revision':'fixture'}
        d=q.digest({'entry':entry,'evidence':evidence})
        self.conn.execute('INSERT INTO entries VALUES(?,?,?,?,?,?)',('de',entry['id'],d,q.encoded(entry),q.encoded(evidence),q.now()))
        self.job=q.enqueue_job(self.conn,'de',entry['id'],'native_example','de',dict(q._context(self.conn,'de',entry['id']),source_digest=d,candidate=None),example_index=0)
        row={'word':'Apfel','lang_code':'de','pos':'noun','senses':[{'glosses':['apple'],'examples':[{'type':'example','text':'Ich esse einen Apfel.','bold_text_offsets':[[15,20]],'translation':'I eat an apple.'}]}]}
        # Apfel begins at 15 and ends at 20 in this fixture.
        dump=self.root/'en.jsonl';dump.write_text(json.dumps(row)+'\n')
        manifest=self.root/'manifest.json';manifest.write_text(json.dumps({'schemaVersion':1,'sources':[{'edition':'en','path':dump.name,'sha256':hashlib.sha256(dump.read_bytes()).hexdigest(),'license':'CC-BY-SA-4.0','licenseUrl':'https://creativecommons.org/licenses/by-sa/4.0/','url':'https://kaikki.org/dictionary/rawdata.html'}]}))
        m.sources.build_catalog(self.db,manifest,self.catalog)

    def tearDown(self):
        self.conn.close();self.temp.cleanup()

    def test_dry_run_then_import_preserves_entry_and_reuses_source_translation(self):
        before=tuple(self.conn.execute('SELECT entry_digest,entry_json,evidence_json FROM entries').fetchone())
        audit=m.audit_reuse(self.db,self.catalog,self.report)
        self.assertEqual(audit['languages']['de']['reusable_native_example'],1)
        self.assertEqual(self.conn.execute('SELECT count(*) FROM results').fetchone()[0],0)
        result=m.audit_reuse(self.db,self.catalog,self.report,apply=True)
        self.assertTrue(result['existingResultsPreserved'])
        self.assertEqual(result['resultsAfter'],2)
        self.assertEqual(result['languages']['de']['imported_example_translation'],1)
        self.assertEqual(tuple(self.conn.execute('SELECT entry_digest,entry_json,evidence_json FROM entries').fetchone()),before)
        self.assertEqual(self.conn.execute("SELECT count(*) FROM jobs WHERE status='checked'").fetchone()[0],0)
        rows=self.conn.execute('SELECT output_json FROM results').fetchall()
        self.assertEqual({json.loads(r[0])['text'] for r in rows},{'Ich esse einen Apfel.','I eat an apple.'})
        self.assertTrue(all(json.loads(r[0])['provenance']['license']=='CC-BY-SA-4.0' for r in rows))
        again=m.audit_reuse(self.db,self.catalog,self.report,apply=True)
        self.assertEqual(again['resultsAfter'],2)

    def test_existing_native_draft_is_not_replaced(self):
        job=q.claim_jobs(self.conn,'fixture')[0]
        q.finish_job(self.conn,job.id,{'text':'Ein Apfel liegt hier.','focus':{'text':'Apfel','start':4}},worker_id='fixture',claim_token=job.claim_token,producer={'role':'local-draft','model':'fixture'},enqueue_translations=False)
        old=tuple(self.conn.execute('SELECT output_json,output_digest FROM results').fetchone())
        result=m.audit_reuse(self.db,self.catalog,self.report,apply=True)
        self.assertEqual(result['resultsAfter'],1)
        self.assertEqual(tuple(self.conn.execute('SELECT output_json,output_digest FROM results').fetchone()),old)

    def test_conflicting_translations_are_held(self):
        self.assertIsNone(m.choose_candidate([{'text':'A.'},{'text':'B.'}],'example_translation'))
        self.assertEqual(m.choose_candidate([{'text':'A.'},{'text':'B.'}],'native_example')['text'],'A.')

    def test_report_cannot_overwrite_database(self):
        with self.assertRaisesRegex(ValueError,'must not replace'):
            m.audit_reuse(self.db,self.catalog,self.db,apply=True)
        self.assertEqual(q.get_job(self.conn,self.job).status,'pending')

    def test_entry_batches_cover_languages_without_holding_read_snapshot(self):
        self.conn.execute("INSERT INTO entries SELECT 'en','en-apple',entry_digest,entry_json,evidence_json,updated_at FROM entries LIMIT 1")
        reader=m.sources.open_readonly(self.db)
        entries=m.iter_entries(reader,batch_size=1)
        self.assertEqual(next(entries)['entry_id'],'de-apple')
        self.conn.execute("UPDATE entries SET updated_at='changed' WHERE entry_id='en-apple'")
        self.assertEqual(self.conn.execute('PRAGMA wal_checkpoint(TRUNCATE)').fetchone()[0],0)
        remaining=list(entries)
        self.assertEqual([(row['entry_id'],row['updated_at']) for row in remaining],[('en-apple','changed')])
        reader.close()

    def test_native_and_source_translation_import_is_atomic(self):
        with patch.object(m, 'import_native_translations', side_effect=ValueError('interrupted')):
            with self.assertRaisesRegex(ValueError, 'interrupted'):
                m.audit_reuse(self.db,self.catalog,self.report,apply=True)
        self.assertEqual(self.conn.execute('SELECT count(*) FROM results').fetchone()[0],0)
        self.assertEqual(q.get_job(self.conn,self.job).status,'pending')

    def test_source_translation_from_another_sentence_cannot_be_rebound(self):
        entry=json.loads(self.conn.execute('SELECT entry_json FROM entries').fetchone()[0])
        evidence=json.loads(self.conn.execute('SELECT evidence_json FROM entries').fetchone()[0])
        catalog=m.sources.open_readonly(self.catalog)
        candidate=m.matcher.match_wiktionary(entry,evidence,m.sources.find_rows(catalog,'de','Apfel'),'de')['native_examples'][0]
        catalog.close()
        job_id=q.import_source_candidate(self.conn,self.job,candidate)
        candidate['known_translations']['en']['source_text']='A different sentence.'
        with self.assertRaisesRegex(ValueError,'different native sentence'):
            m.import_native_translations(self.conn,job_id,candidate,{})

    def test_repair_job_is_preserved_without_aborting_audit(self):
        old=q.get_job(self.conn,self.job)
        repair=q.enqueue_job(self.conn,'de','de-apple','native_example','de',dict(old.payload,source_import_allowed=False),example_index=0)
        result=m.audit_reuse(self.db,self.catalog,self.report,apply=True)
        self.assertEqual(result['languages']['de']['editorialRepairPreserved'],1)
        self.assertEqual(q.get_job(self.conn,repair).status,'pending')

    def test_single_sense_retrieval_is_opt_in_and_stays_unreviewed(self):
        row=self.conn.execute('SELECT * FROM entries').fetchone()
        entry,evidence=json.loads(row['entry_json']),json.loads(row['evidence_json'])
        evidence['meanings']['en']['text']='A round fruit with firm flesh.'
        entry_digest=q.digest({'entry':entry,'evidence':evidence})
        self.conn.execute('UPDATE entries SET evidence_json=?,entry_digest=?',(q.encoded(evidence),entry_digest))
        q.enqueue_job(self.conn,'de','de-apple','native_example','de',dict(q._context(self.conn,'de','de-apple'),source_digest=entry_digest,candidate=None),example_index=0)
        strict=m.audit_reuse(self.db,self.catalog,self.report)
        self.assertEqual(strict['languages']['de'].get('reusable_native_example',0),0)
        draft=m.audit_reuse(self.db,self.catalog,self.report,apply=True,include_single_sense_candidates=True)
        self.assertEqual(draft['resultsAfter'],2)
        for row in self.conn.execute('SELECT output_json FROM results'):
            self.assertEqual(json.loads(row[0])['provenance']['alignment']['status'],'selected-sense-equivalence-unverified')
        self.assertEqual(self.conn.execute("SELECT count(*) FROM jobs WHERE status='checked'").fetchone()[0],0)


if __name__=='__main__':unittest.main()
