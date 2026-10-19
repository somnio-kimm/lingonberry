"""Behavioural queue tests; all files and SQLite databases stay in temporary fixtures."""
import hashlib
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest

MODULE=Path(__file__).resolve().parents[1]/'scripts/content/prepare-gpu-jobs.py'
spec=importlib.util.spec_from_file_location('gpu_jobs',MODULE)
q=importlib.util.module_from_spec(spec);sys.modules[spec.name]=q;spec.loader.exec_module(q)
PROVENANCE={'kind':'app-authored','license':'CC-BY-4.0','creator':'Fixture author'}
SOURCE={'entryId':1,'senseId':1,'license':'CC-BY-SA-2.0-KR','creator':'Licensed dictionary','url':'https://example.org/sense/1'}
GEN={'role':'local-draft','model':'local-model','revision':'r1','prompt_digest':'generator-v1'}
REVIEW={'role':'local-review','model':'local-model','revision':'r1','prompt_digest':'reviewer-v1'}


class QueueTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.root=Path(self.tmp.name)
        self.repo=self.root/'repo';self.base=self.repo/'language-packages';(self.base/'sources/examples').mkdir(parents=True)
        self.catalog=[]
        def package(language,entries,locale=None):
            name=f'{language}-{locale or "core"}';kind='explanation' if locale else 'study'
            value={'id':name,'kind':kind,'version':'3.0.0','targetLanguage':language,'entries':entries}
            if locale:value['explanationLanguage']=locale;value['studyVersion']='3.0.0'
            filename=name+'-3.0.0.json';self.write(self.base/filename,value)
            self.catalog.append({k:v for k,v in value.items() if k!='entries'}|{'url':'/language-packages/'+filename})
        for language in q.LANGUAGES:
            entry={'id':language+'1','word':language+'-word','partOfSpeech':'noun','level':'A1','provenance':PROVENANCE}
            if language=='de':
                entry['example']={'text':'First German sentence.','source':PROVENANCE}
                entry['additionalExamples']=[{'text':'Second German sentence.','source':PROVENANCE}]
                package('de',[{'id':'de1','meaning':'German meaning','provenance':PROVENANCE,'exampleTranslation':'First translation.'}],'en')
            if language=='en':
                entry['example']={'text':'I read a book.','source':PROVENANCE}
                package('en',[{'id':'en1','meaning':'English definition','provenance':PROVENANCE}],'en')
            if language=='fr':
                entry['referenceExamples']=[{'text':'A candidate, not an accepted example.'}]
                entry['provenance']={'kind':'licensed-source','source':SOURCE}
            entries=[entry]
            if language=='es':
                entries.append({'id':'es2','word':'old-word','partOfSpeech':'noun','level':'A2','provenance':{'source':SOURCE},'example':{'text':'Stale sense sentence.','source':PROVENANCE}})
                package('es',[{'id':'es1','meaning':'Spanish definition','provenance':PROVENANCE},{'id':'es2','meaning':'Stale definition','provenance':PROVENANCE}],'en')
            package(language,entries)
        self.write(self.base/'catalog.json',self.catalog)
        self.authored={'id':'es1','text':'Accepted Spanish sentence.','en':'Accepted English translation.','translations':{},'meanings':{'de':'Akzeptierte Bedeutung'},'meaningProvenance':{'de':PROVENANCE},'provenance':PROVENANCE}
        self.write_lines(self.base/'sources/examples/es-authored.jsonl',[self.authored])
        self.write_lines(self.base/'sources/examples/es-corrections.jsonl',[{'id':'es2','word':'corrected-word','meaningEn':'Corrected definition','reason':'Selected sense repair','provenance':PROVENANCE}])
        self.senses=self.root/'nikl.json';self.write(self.senses,[{'id':1,'sense':1,'definition':'허가된 정의','equivalents':{l:{'definition':l+' licensed candidate'} for l in ('de','en','fr','ja','zh')}}])
        self.db=self.root/'queue.sqlite';self.conn=q.open_queue(self.db)
        self.report=q.prepare_queue(self.conn,self.repo,source_senses_path=self.senses)

    def tearDown(self):
        self.conn.close();self.tmp.cleanup()

    @staticmethod
    def write(path,value):path.write_text(json.dumps(value,ensure_ascii=False),encoding='utf-8')
    @staticmethod
    def write_lines(path,rows):path.write_text(''.join(json.dumps(r,ensure_ascii=False)+'\n' for r in rows),encoding='utf-8')

    def source_candidate(self, **extra):
        return {'text':'A licensed sentence.', 'provenance':SOURCE,
                'source_digest':'b'*64, 'source_snapshot_sha256':'a'*64, **extra}

    def pending(self, task='meaning', language='fr', locale='de'):
        return self.conn.execute("SELECT id FROM jobs WHERE status='pending' AND task=? AND study_language=? AND locale=? ORDER BY id LIMIT 1", (task,language,locale)).fetchone()[0]

    def test_source_import_preserves_evidence_is_idempotent_and_requires_review(self):
        old=self.pending();before=tuple(self.conn.execute("SELECT * FROM entries WHERE entry_id='fr1'").fetchone())
        candidate=self.source_candidate(text='eine Bedeutung')
        new=q.import_source_candidate(self.conn,old,candidate)
        self.assertNotEqual(new,old);self.assertEqual(q.get_job(self.conn,old).status,'superseded')
        self.assertEqual(q.get_job(self.conn,new).status,'draft');self.assertEqual(q.checked_results(self.conn,'fr','fr1'),[])
        self.assertEqual(tuple(self.conn.execute("SELECT * FROM entries WHERE entry_id='fr1'").fetchone()),before)
        self.assertEqual(q.import_source_candidate(self.conn,old,candidate),new)
        q.prepare_queue(self.conn,self.repo,source_senses_path=self.senses)
        self.assertEqual(q.get_job(self.conn,new).status,'draft')
        with self.assertRaises(ValueError):q.import_source_candidate(self.conn,new,candidate)
        with self.assertRaises(ValueError):q.import_source_candidate(self.conn,old,self.source_candidate(text='Another'))

    def test_source_import_rejects_invalid_missing_stale_or_running_work(self):
        with self.assertRaises(ValueError):q.import_source_candidate(self.conn,999999,self.source_candidate())
        old=self.pending()
        for change in [{'source_digest':'bad'},{'source_snapshot_sha256':''},{'text':''},{'provenance':{**SOURCE,'license':'MIT'}},{'provenance':{**SOURCE,'creator':''}}]:
            with self.subTest(change=change),self.assertRaises(ValueError):q.import_source_candidate(self.conn,old,self.source_candidate(**change))
        self.assertEqual(q.get_job(self.conn,old).status,'pending')
        q.claim_jobs(self.conn,'generator',limit=128,kind='meaning')
        with self.assertRaises(ValueError):q.import_source_candidate(self.conn,old,self.source_candidate())
        q.recover_running_jobs(self.conn,worker_id='generator')
        self.conn.execute("UPDATE entries SET entry_digest='changed' WHERE entry_id='fr1'")
        with self.assertRaisesRegex(ValueError,'Stale'):q.import_source_candidate(self.conn,old,self.source_candidate())

    def test_native_source_import_binds_translation_children_and_exact_source_translation(self):
        old=self.pending('native_example','fr','fr')
        candidate=self.source_candidate(text='Le livre est ici.',focus={'text':'livre','start':3})
        new=q.import_source_candidate(self.conn,old,candidate)
        child=self.conn.execute("SELECT id FROM jobs WHERE task='example_translation' AND locale='en' AND status='pending' AND entry_id='fr1'").fetchone()[0]
        job=q.get_job(self.conn,child);source=job.payload['source_example']
        self.assertEqual(source['provenance']['license'],'CC-BY-SA-2.0-KR')
        translation=self.source_candidate(text='The book is here.',source_text=source['text'],source_example_digest=q.digest(source))
        with self.assertRaises(ValueError):q.import_source_candidate(self.conn,child,{**translation,'source_text':'Stale.'})
        translated=q.import_source_candidate(self.conn,child,translation)
        self.assertEqual(q.get_job(self.conn,translated).payload['dependency_job_ids'],[new])
        self.assertEqual(q.source_candidate_output(q.get_job(self.conn,translated))['text'],'The book is here.')
        forged=q.get_job(self.conn,translated)
        forged.payload['licensed_source_candidate']['provenance']['creator']='Forged'
        with self.assertRaisesRegex(ValueError,'binding'):q.source_candidate_output(forged)

    def test_source_import_cannot_replace_existing_meaning_or_native_example(self):
        for task,locale,index,payload in [('meaning','en',-1,{}),('native_example','en',0,{})]:
            job=q.enqueue_job(self.conn,'en','en1',task,locale,payload,example_index=index)
            candidate=self.source_candidate(focus={'text':'licensed'})
            with self.assertRaisesRegex(ValueError,'already exists'):q.import_source_candidate(self.conn,job,candidate)

    def test_complete_matrix_counts_do_not_accept_reference_candidates(self):
        coverage=self.report['coverage']
        self.assertEqual(coverage['entries'],8)
        self.assertEqual(coverage['pairs'],43)
        self.assertEqual(coverage['missing_native_examples'],5)
        self.assertEqual(coverage['missing_meanings'],44)
        self.assertEqual(coverage['missing_existing_example_translations'],22)
        self.assertEqual(coverage['deferred_translation_fields'],30)
        self.assertEqual(coverage['licensed_meaning_candidates'],5)
        self.assertEqual(self.report['total_jobs'],71)
        candidate=self.conn.execute("SELECT payload_json FROM jobs WHERE study_language='fr' AND task='meaning' AND locale='ja'").fetchone()
        payload=json.loads(candidate[0]);self.assertEqual(payload['candidate']['text'],'ja licensed candidate')
        self.assertFalse(payload['candidate']['accepted']);self.assertEqual(payload['candidate']['provenance']['license'],'CC-BY-SA-2.0-KR')
        self.assertEqual(q.checked_results(self.conn,'fr','fr1'),[])
        self.assertEqual(self.conn.execute("SELECT count(*) FROM jobs WHERE study_language='en' AND locale='en' AND task='example_translation'").fetchone()[0],0)
        self.assertEqual(self.conn.execute("SELECT count(*) FROM jobs WHERE study_language='de' AND locale='en' AND task='example_translation' AND example_index=1").fetchone()[0],1)
        evidence=json.loads(self.conn.execute("SELECT evidence_json FROM entries WHERE entry_id='es1'").fetchone()[0])
        self.assertEqual(evidence['authored'],self.authored)

    def test_restart_is_idempotent_and_running_claims_require_explicit_recovery(self):
        first=q.claim_jobs(self.conn,'worker-a',limit=1,kind='native_example')[0]
        repeated=q.prepare_queue(self.conn,self.repo,source_senses_path=self.senses)
        self.assertEqual(repeated['total_jobs'],71)
        self.assertEqual(q.get_job(self.conn,first.id).status,'running')
        with self.assertRaises(ValueError):q.recover_running_jobs(self.conn)
        self.assertEqual(q.recover_running_jobs(self.conn,worker_id='worker-a'),1)
        second=q.claim_jobs(self.conn,'worker-a',limit=1,kind='native_example')[0]
        self.assertEqual(first.id,second.id);self.assertNotEqual(first.claim_token,second.claim_token)
        with self.assertRaises(ValueError):q.finish_job(self.conn,first.id,{'text':'Stale.'},worker_id='worker-a',claim_token=first.claim_token,producer=GEN)

    def test_drafts_create_bound_children_and_only_reviewed_dependency_chains_are_exposed(self):
        native=q.claim_jobs(self.conn,'generator',kind='native_example')[0]
        output={'text':'A corrected-word example.','focus':{'text':'corrected-word','start':2},'uncertainties':[],'review':{'status':'approved'}}
        children=q.finish_job(self.conn,native.id,output,worker_id='generator',claim_token=native.claim_token,producer=GEN)
        self.assertEqual(q.get_job(self.conn,native.id).status,'draft');self.assertEqual(len(children),7)
        translations=[q.get_job(self.conn,i) for i in children if q.get_job(self.conn,i).task=='example_translation']
        self.assertEqual(len(translations),6)
        # Existing unrelated translation jobs may precede these; directly claim until source-linked child appears.
        claimed=q.claim_jobs(self.conn,'translator',limit=128,kind='example_translation')
        child=next(j for j in claimed if j.payload.get('source_job_id')==native.id)
        review_id=q.finish_job(self.conn,child.id,{'text':'A translated sentence.'},worker_id='translator',claim_token=child.claim_token,producer=GEN)[0]
        reviews=q.claim_jobs(self.conn,'reviewer',limit=128,kind='review');by_id={j.id:j for j in reviews}
        child_review=by_id[review_id]
        with self.assertRaises(ValueError):q.record_review(self.conn,review_id,{'verdict':'pass','issues':[]},worker_id='reviewer',claim_token=child_review.claim_token,producer=GEN)
        q.record_review(self.conn,review_id,{'verdict':'pass','issues':[]},worker_id='reviewer',claim_token=child_review.claim_token,producer=REVIEW)
        self.assertEqual(q.checked_results(self.conn,native.study_language,native.entry_id),[])
        nr=next(j for j in reviews if j.payload['target_job_id']==native.id)
        q.record_review(self.conn,nr.id,{'verdict':'pass','issues':[]},worker_id='reviewer',claim_token=nr.claim_token,producer=REVIEW)
        self.assertEqual({r['job'].id for r in q.checked_results(self.conn,native.study_language,native.entry_id)},{native.id,child.id})
        count=q.queue_counts(self.conn)['total_jobs'];q.prepare_queue(self.conn,self.repo,source_senses_path=self.senses)
        self.assertEqual(q.queue_counts(self.conn)['total_jobs'],count)
        self.assertEqual(q.get_job(self.conn,native.id).status,'checked')
        evidence=json.loads(self.conn.execute('SELECT evidence_json FROM reviews WHERE review_job_id=?',(nr.id,)).fetchone()[0])
        self.assertEqual(evidence['method'],'same-model-AI-review');self.assertEqual(evidence['nativeSpeakerReview'],'pending')

    def test_changed_input_invalidates_results_and_translation_descendants(self):
        native=q.claim_jobs(self.conn,'generator',kind='native_example')[0]
        children=q.finish_job(self.conn,native.id,{'text':'Original draft.','focus':{'text':'draft'}},worker_id='generator',claim_token=native.claim_token,producer=GEN)
        correction=self.base/'sources/examples/es-corrections.jsonl'
        self.write_lines(correction,[{'id':'es2','word':'revised-word','meaningEn':'A changed sense','reason':'New evidence','provenance':PROVENANCE}])
        q.prepare_queue(self.conn,self.repo,source_senses_path=self.senses)
        for job_id in [native.id,*children]:self.assertEqual(q.get_job(self.conn,job_id).status,'superseded')
        self.assertEqual(self.conn.execute("SELECT count(*) FROM jobs WHERE entry_id='es2' AND task='native_example' AND status='pending'").fetchone()[0],1)

    def test_review_rejection_invalidates_children_and_repairs_are_not_self_approved(self):
        native=q.claim_jobs(self.conn,'generator',kind='native_example')[0]
        children=q.finish_job(self.conn,native.id,{'text':'Bad draft.','focus':{'text':'draft'}},worker_id='generator',claim_token=native.claim_token,producer=GEN)
        review=q.claim_jobs(self.conn,'reviewer',kind='review')[0]
        with self.assertRaises(ValueError):q.record_review(self.conn,review.id,{'verdict':'pass','issues':[],'repair':{'text':'New text'}},worker_id='reviewer',claim_token=review.claim_token,producer=REVIEW)
        q.record_review(self.conn,review.id,{'verdict':'revise','issues':[{'code':'sense','detail':'Wrong meaning'}]},worker_id='reviewer',claim_token=review.claim_token,producer=REVIEW)
        self.assertEqual(q.get_job(self.conn,native.id).status,'rejected')
        for job_id in children:
            if job_id!=review.id:self.assertEqual(q.get_job(self.conn,job_id).status,'superseded')
        count=q.queue_counts(self.conn)['total_jobs'];q.prepare_queue(self.conn,self.repo,source_senses_path=self.senses)
        self.assertEqual(q.queue_counts(self.conn)['total_jobs'],count)

    def test_review_repairs_create_new_pending_work_and_cannot_reuse_stale_inputs(self):
        native=q.claim_jobs(self.conn,'generator',kind='native_example')[0]
        q.finish_job(self.conn,native.id,{'text':'Bad draft.'},worker_id='generator',claim_token=native.claim_token,producer=GEN)
        review=q.claim_jobs(self.conn,'reviewer',kind='review')[0]
        q.record_review(self.conn,review.id,{'verdict':'revise','issues':[{'code':'sense','detail':'Wrong sense'}],'repair':{'text':'Suggested repair.'}},worker_id='reviewer',claim_token=review.claim_token,producer=REVIEW)
        repair_id=q.enqueue_repair_job(self.conn,review.id)
        self.assertNotEqual(repair_id,native.id);self.assertEqual(q.get_job(self.conn,repair_id).status,'pending')
        self.assertEqual(q.enqueue_repair_job(self.conn,review.id),repair_id)
        self.assertEqual(q.checked_results(self.conn,native.study_language,native.entry_id),[])
        self.write_lines(self.base/'sources/examples/es-corrections.jsonl',[{'id':'es2','word':'another-word','meaningEn':'Different sense','reason':'Changed','provenance':PROVENANCE}])
        q.prepare_queue(self.conn,self.repo,source_senses_path=self.senses)
        with self.assertRaises(ValueError):q.enqueue_repair_job(self.conn,review.id)

    def test_unknown_sidecar_id_is_an_error_not_a_skipped_entry(self):
        self.write_lines(self.base/'sources/examples/fr-authored.jsonl',[{'id':'not-in-core','text':'Candidate.'}])
        with self.assertRaisesRegex(ValueError,'unknown stable IDs'):q.prepare_queue(self.conn,self.repo,source_senses_path=self.senses)
        self.assertEqual(q.queue_counts(self.conn)['build_state']['status'],'incomplete')
        with self.assertRaises(RuntimeError):q.claim_jobs(self.conn,'worker')

    def reject_generated(self, job_id, output):
        claimed=q.claim_jobs(self.conn,'generator',limit=128)
        job=next(j for j in claimed if j.id==job_id)
        q.finish_job(self.conn,job.id,output,worker_id='generator',claim_token=job.claim_token,producer=GEN)
        reviews=q.claim_jobs(self.conn,'reviewer',limit=128,kind='review')
        review=next(j for j in reviews if j.payload['target_job_id']==job.id)
        q.record_review(self.conn,review.id,{'verdict':'revise','issues':[{'code':'sense','detail':'Incorrect selected sense'}]},worker_id='reviewer',claim_token=review.claim_token,producer=REVIEW)
        return review.id

    def test_three_failed_rounds_remain_flagged_for_an_agent(self):
        job_id=self.conn.execute("SELECT id FROM jobs WHERE task='native_example' ORDER BY id LIMIT 1").fetchone()[0]
        for index in range(3):
            review_id=self.reject_generated(job_id,{'text':f'Different draft {index}.'})
            next_id=q.enqueue_repair(self.conn,job_id,review_id,{'detail':'Repair the selected sense'},max_rounds=3)
            if index<2:
                self.assertIsNotNone(next_id);self.assertEqual(q.get_job(self.conn,next_id).payload['repair_round'],index+1);job_id=next_id
            else:self.assertIsNone(next_id)
        self.assertEqual(q.get_job(self.conn,job_id).status,'rejected')
        flagged=self.conn.execute('SELECT reason,detail_json FROM agent_queue WHERE job_id=?',(job_id,)).fetchone()
        self.assertEqual(flagged['reason'],'repair-round-limit');self.assertEqual(json.loads(flagged['detail_json'])['failed_rounds'],3)
        self.assertEqual(q.queue_counts(self.conn)['agent_queue'],1)

    def test_repeated_text_does_not_loop_even_if_uncertainty_metadata_changes(self):
        job_id=self.conn.execute("SELECT id FROM jobs WHERE task='native_example' ORDER BY id LIMIT 1").fetchone()[0]
        review_id=self.reject_generated(job_id,{'text':'Unchanged draft.','uncertainties':['first']})
        repair=q.enqueue_repair(self.conn,job_id,review_id,{'detail':'Wrong sense'})
        second_review=self.reject_generated(repair,{'text':'Unchanged draft.','uncertainties':['different explanation']})
        self.assertIsNone(q.enqueue_repair(self.conn,repair,second_review,{'detail':'Still wrong'}))
        self.assertEqual(self.conn.execute('SELECT reason FROM agent_queue WHERE job_id=?',(repair,)).fetchone()[0],'repeated-draft-no-progress')

    def test_source_import_is_disabled_for_repair_jobs(self):
        job_id=self.conn.execute("SELECT id FROM jobs WHERE study_language='fr' AND task='meaning' AND locale='ja'").fetchone()[0]
        candidate=q.get_job(self.conn,job_id).payload['candidate']
        review_id=self.reject_generated(job_id,{'text':candidate['text'],'provenance':candidate['provenance']})
        repair=q.enqueue_repair(self.conn,job_id,review_id,{'detail':'Source sense mismatch'})
        payload=q.get_job(self.conn,repair).payload
        self.assertIsNone(payload['candidate']);self.assertFalse(payload['source_import_allowed'])
        self.assertEqual(payload['previous_draft']['text'],candidate['text'])
        self.assertEqual(payload['revision_request']['issues'][0]['code'],'sense')
        self.assertEqual(q.get_job(self.conn,repair).status,'pending')

    def test_licensed_import_review_is_not_mislabeled_as_a_second_generation_model(self):
        job=q.claim_jobs(self.conn,'importer',kind='meaning',locale='ja',study_language='fr')[0]
        candidate=job.payload['candidate']
        output={'text':candidate['text'],'provenance':candidate['provenance']|{'kind':'licensed-source'}}
        producer={'role':'local-draft','method':'licensed-source-import','model':None,'source_digest':candidate['source_digest']}
        q.finish_job(self.conn,job.id,output,worker_id='importer',claim_token=job.claim_token,producer=producer)
        self.assertEqual(q.checked_results(self.conn,'fr','fr1'),[])
        review=q.claim_jobs(self.conn,'reviewer',kind='review',study_language='fr')[0]
        q.record_review(self.conn,review.id,{'verdict':'pass','issues':[]},worker_id='reviewer',claim_token=review.claim_token,producer=REVIEW)
        exported=q.export_entry_evidence(self.conn,'fr','fr1')['checkedResults'][0]
        self.assertEqual(exported['review']['method'],'source-candidate-AI-review')
        self.assertEqual(exported['output'],output)
        self.assertEqual(exported['producer'],producer)

    def test_language_claims_are_bounded_and_do_not_take_other_languages(self):
        claimed=q.claim_jobs(self.conn,'round-robin',limit=2,kind='meaning',locale='ja',study_language='fr')
        self.assertEqual(len(claimed),1)
        self.assertEqual((claimed[0].study_language,claimed[0].task,claimed[0].locale),('fr','meaning','ja'))
        self.assertEqual(q.claim_jobs(self.conn,'round-robin',kind='meaning',locale='ja',study_language='fr'),[])
        self.assertTrue(q.claim_jobs(self.conn,'round-robin',kind='meaning',locale='ja',study_language='es'))
        with self.assertRaises(ValueError):q.claim_jobs(self.conn,'round-robin',study_language='invalid')

    def test_all_claim_filter_combinations_use_ordered_indexes(self):
        for language in (None,'fr'):
            for kind in (None,'meaning'):
                for locale in (None,'ja'):
                    with self.subTest(language=language,kind=kind,locale=locale):
                        query,values=q._ready_query(kind,locale,language)
                        plan=[r[3] for r in self.conn.execute('EXPLAIN QUERY PLAN '+query,(*values,2))]
                        self.assertTrue(any('INDEX jobs_ready_' in line or 'INDEX jobs_claim' in line for line in plan),plan)
                        self.assertFalse(any('TEMP B-TREE' in line for line in plan),plan)

    def test_dispatch_probes_are_capped_and_respect_dependencies_without_claiming(self):
        before=self.conn.execute("SELECT count(*) FROM jobs WHERE status='running'").fetchone()[0]
        report=q.dispatch_counts(self.conn,limit=2)
        self.assertEqual(set(report['languages']),set(q.LANGUAGES));self.assertTrue(report['ready_more'])
        self.assertTrue(all(v['ready']<=2 for v in report['languages'].values()))
        self.assertEqual(q.dispatch_counts(self.conn,kind='native_example')['ready_lower_bound'],5)
        parent=self.conn.execute("SELECT id FROM jobs WHERE entry_id='es2' AND task='native_example'").fetchone()[0]
        blocked=q.enqueue_job(self.conn,'es','es2','meaning','ja',{'word':'corrected-word'},dependencies=(parent,),logical_key='test-blocked')
        self.assertEqual(q.dispatch_counts(self.conn,kind='meaning',locale='ja')['languages']['es']['ready'],2)
        native=q.claim_jobs(self.conn,'generator',kind='native_example',study_language='es')[0]
        q.finish_job(self.conn,native.id,{'text':'Valid native.'},worker_id='generator',claim_token=native.claim_token,producer=GEN)
        self.assertEqual(q.dispatch_counts(self.conn,kind='meaning',locale='ja')['languages']['es']['ready'],3)
        self.assertEqual(q.get_job(self.conn,blocked).status,'pending')
        self.assertEqual(before,0)
        self.assertEqual(self.conn.execute("SELECT count(*) FROM jobs WHERE status='running'").fetchone()[0],0)

    def test_dispatch_flags_count_active_agent_work_not_superseded_history(self):
        job_id=self.conn.execute("SELECT id FROM jobs WHERE task='native_example' ORDER BY id LIMIT 1").fetchone()[0]
        review_id=self.reject_generated(job_id,{'text':'Rejected draft.'})
        self.assertIsNone(q.enqueue_repair(self.conn,job_id,review_id,{},max_rounds=1))
        self.assertEqual(q.dispatch_counts(self.conn)['active_agent_queue'],1)
        old=q.get_job(self.conn,job_id)
        q.enqueue_job(self.conn,old.study_language,old.entry_id,old.task,old.locale,old.payload|{'agent_feedback':'New explicit attempt'},example_index=old.example_index)
        self.assertEqual(q.dispatch_counts(self.conn)['active_agent_queue'],0)
        self.assertEqual(q.queue_counts(self.conn)['agent_queue'],1)

    def test_json_export_preserves_evidence_and_never_certifies_whole_entry(self):
        row=q.export_entry_evidence(self.conn,'es','es1')
        self.assertEqual(row['evidence']['authored'],self.authored)
        self.assertFalse(row['coverage']['fieldCoverageComplete']);self.assertEqual(row['checkedResults'],[])
        complete=self.authored|{'meanings':{l:'Meaning '+l for l in q.locales('es')},'meaningProvenance':{l:PROVENANCE for l in q.locales('es')},'translations':{l:'Sentence '+l for l in q.locales('es') if l!='en'}}
        self.write_lines(self.base/'sources/examples/es-authored.jsonl',[complete])
        q.prepare_queue(self.conn,self.repo,source_senses_path=self.senses)
        ready=q.export_entry_evidence(self.conn,'es','es1')
        self.assertTrue(ready['coverage']['fieldCoverageComplete']);self.assertTrue(ready['coverage']['readyForEntryReview'])
        self.assertTrue(ready['validation']['wholeEntryReviewRequired']);self.assertTrue(ready['validation']['assembledStructuralCheckRequired'])
        self.assertNotIn('review',ready);self.assertNotIn('qualityReview',ready)
        self.assertEqual(json.loads(json.dumps(ready))['entry']['id'],'es1')

    def test_json_export_contains_only_checked_current_field_results(self):
        native=q.claim_jobs(self.conn,'generator',kind='native_example',study_language='es')[0]
        q.finish_job(self.conn,native.id,{'text':'Native example.','focus':{'text':'example'}},worker_id='generator',claim_token=native.claim_token,producer=GEN)
        self.assertEqual(q.export_entry_evidence(self.conn,'es','es2')['checkedResults'],[])
        review=q.claim_jobs(self.conn,'reviewer',kind='review',study_language='es')[0]
        q.record_review(self.conn,review.id,{'verdict':'pass','issues':[]},worker_id='reviewer',claim_token=review.claim_token,producer=REVIEW)
        exported=q.export_entry_evidence(self.conn,'es','es2')
        self.assertEqual(json.loads(json.dumps(exported))['checkedResults'][0]['job']['id'],native.id)
        self.assertEqual(exported['checkedResults'][0]['producer'],GEN)
        self.assertEqual(exported['checkedResults'][0]['review']['method'],'same-model-AI-review')
        self.assertFalse(exported['coverage']['readyForEntryReview'])

    def test_export_retains_exact_canonical_hash_bytes_for_integral_floats(self):
        core_path=self.base/'fr-core-3.0.0.json';core=json.loads(core_path.read_text())
        core['entries'][0]['grammar']={'frequency':1.0};self.write(core_path,core)
        q.prepare_queue(self.conn,self.repo,source_senses_path=self.senses)
        job=q.claim_jobs(self.conn,'generator',kind='meaning',locale='ja',study_language='fr')[0]
        q.finish_job(self.conn,job.id,{'text':'A definition.','confidence':1.0},worker_id='generator',claim_token=job.claim_token,producer=GEN)
        review=q.claim_jobs(self.conn,'reviewer',kind='review',study_language='fr')[0]
        q.record_review(self.conn,review.id,{'verdict':'pass','issues':[]},worker_id='reviewer',claim_token=review.claim_token,producer=REVIEW)
        exported=q.export_entry_evidence(self.conn,'fr','fr1');result=exported['checkedResults'][0]
        wrapper='{"entry":'+exported['entryJson']+',"evidence":'+exported['evidenceJson']+'}'
        self.assertEqual(hashlib.sha256(wrapper.encode()).hexdigest(),exported['entryDigest'])
        self.assertEqual(hashlib.sha256(result['payloadJson'].encode()).hexdigest(),result['job']['input_hash'])
        self.assertEqual(hashlib.sha256(result['outputJson'].encode()).hexdigest(),result['output_digest'])
        self.assertIn('1.0',exported['entryJson']);self.assertIn('1.0',result['outputJson'])
        self.assertEqual(json.loads(result['payloadJson']),result['job']['payload'])
        self.assertEqual(json.loads(result['outputJson']),result['output'])

    def test_runtime_generation_failure_retries_with_history_and_a_new_hash(self):
        job=q.claim_jobs(self.conn,'generator',kind='native_example',study_language='es')[0]
        original=dict(job.payload)
        q.fail_job(self.conn,job.id,'Malformed JSON',worker_id='generator',claim_token=job.claim_token,response='not JSON')
        retry=q.retry_failed_job(self.conn,job.id,{'action':'Return valid JSON'})
        new=q.get_job(self.conn,retry)
        self.assertNotEqual(new.input_hash,job.input_hash);self.assertEqual(new.status,'pending')
        self.assertEqual(new.payload['runtime_retry_round'],1)
        self.assertEqual(new.payload['last_error'],'Malformed JSON')
        self.assertEqual(new.payload['previous_response'],'not JSON')
        self.assertEqual(new.payload['feedback'],{'action':'Return valid JSON'})
        self.assertEqual(q.get_job(self.conn,job.id).payload,original)
        self.assertEqual(q.get_job(self.conn,job.id).status,'superseded')
        self.assertEqual(q.retry_failed_job(self.conn,job.id,{'action':'Return valid JSON'}),retry)
        history=json.loads(self.conn.execute("SELECT detail_json FROM events WHERE job_id=? AND event='failed'",(job.id,)).fetchone()[0])
        self.assertEqual(history,{'error':'Malformed JSON','response':'not JSON'})
        self.assertEqual(self.conn.execute('SELECT count(*) FROM results').fetchone()[0],0)

    def test_new_review_does_not_inherit_generator_runtime_failure_budget(self):
        first=q.claim_jobs(self.conn,'generator',kind='native_example',study_language='es')[0]
        q.fail_job(self.conn,first.id,'Malformed generation',worker_id='generator',claim_token=first.claim_token)
        q.retry_failed_job(self.conn,first.id,{})
        retried=q.claim_jobs(self.conn,'generator',kind='native_example',study_language='es')[0]
        self.assertEqual(retried.payload['runtime_retry_round'],1)
        q.finish_job(self.conn,retried.id,{'text':'Corrected native.'},worker_id='generator',claim_token=retried.claim_token,producer=GEN)
        review=q.claim_jobs(self.conn,'reviewer',kind='review',study_language='es')[0]
        self.assertNotIn('runtime_retry_round',review.payload)
        self.assertNotIn('runtime_retry_of_job_id',review.payload)
        q.fail_job(self.conn,review.id,'Malformed review',worker_id='reviewer',claim_token=review.claim_token)
        repaired_review=q.get_job(self.conn,q.retry_failed_job(self.conn,review.id,{}))
        self.assertEqual(repaired_review.payload['runtime_retry_round'],1)
        self.assertEqual(repaired_review.payload['runtime_retry_of_job_id'],review.id)

    def test_runtime_review_retry_preserves_candidate_target_and_translation_siblings(self):
        native=q.claim_jobs(self.conn,'generator',kind='native_example',study_language='es')[0]
        output={'text':'A native example.','focus':{'text':'example'}}
        children=q.finish_job(self.conn,native.id,output,worker_id='generator',claim_token=native.claim_token,producer=GEN)
        review=q.claim_jobs(self.conn,'reviewer',kind='review',study_language='es')[0]
        q.fail_job(self.conn,review.id,'Invalid reviewer JSON',worker_id='reviewer',claim_token=review.claim_token,response='{')
        retry_id=q.retry_failed_job(self.conn,review.id,{'action':'Return the review schema'})
        retry=q.get_job(self.conn,retry_id)
        for key in ['candidate','candidate_digest','target_job_id','target_task','source_digest','generator']:
            self.assertEqual(retry.payload[key],review.payload[key])
        self.assertEqual(retry.payload['dependency_job_ids'],[native.id])
        self.assertEqual(q.get_job(self.conn,native.id).status,'draft')
        for child_id in children:
            self.assertEqual(q.get_job(self.conn,child_id).status,'superseded' if child_id==review.id else 'pending')
        self.assertEqual(q.checked_results(self.conn,'es','es2'),[])
        claimed=q.claim_jobs(self.conn,'fresh-reviewer',kind='review',study_language='es')[0]
        self.assertEqual(claimed.id,retry_id)
        q.record_review(self.conn,claimed.id,{'verdict':'pass','issues':[]},worker_id='fresh-reviewer',claim_token=claimed.claim_token,producer=REVIEW)
        self.assertEqual(q.get_job(self.conn,native.id).status,'checked')
        self.assertEqual(q.checked_results(self.conn,'es','es2')[0]['output'],output)

    def test_runtime_retry_does_not_fast_import_a_failed_source_candidate(self):
        job=q.claim_jobs(self.conn,'importer',kind='meaning',locale='ja',study_language='fr')[0]
        self.assertIsNotNone(job.payload['candidate'])
        q.fail_job(self.conn,job.id,'Source import validation failed',worker_id='importer',claim_token=job.claim_token)
        retry=q.get_job(self.conn,q.retry_failed_job(self.conn,job.id,{'previous_response':'Observed malformed source'}))
        self.assertIsNone(retry.payload['candidate']);self.assertFalse(retry.payload['source_import_allowed'])
        self.assertEqual(retry.payload['previous_response'],'Observed malformed source')

    def test_runtime_three_distinct_failures_are_flagged_not_completed(self):
        for index in range(3):
            job=q.claim_jobs(self.conn,'generator',kind='native_example',study_language='es')[0]
            q.fail_job(self.conn,job.id,f'Error {index}',worker_id='generator',claim_token=job.claim_token,response=f'Bad response {index}')
            retry=q.retry_failed_job(self.conn,job.id,{'repair':'Use the required schema'},max_rounds=3)
            self.assertEqual(retry is None,index==2)
        self.assertEqual(q.get_job(self.conn,job.id).status,'failed')
        self.assertEqual(q.dispatch_counts(self.conn,kind='native_example')['languages']['es']['ready'],0)
        self.assertEqual(q.dispatch_counts(self.conn)['languages']['es']['agent_queue'],1)
        detail=self.conn.execute('SELECT reason,detail_json FROM agent_queue WHERE job_id=?',(job.id,)).fetchone()
        self.assertEqual(detail['reason'],'runtime-retry-round-limit');self.assertEqual(json.loads(detail['detail_json'])['failed_rounds'],3)
        self.assertEqual(self.conn.execute('SELECT count(*) FROM results').fetchone()[0],0)
        self.assertEqual(q.checked_results(self.conn,'es','es2'),[])

    def test_identical_runtime_response_stops_zero_progress_despite_error_changes(self):
        baseline=q.queue_counts(self.conn)['total_jobs']
        first=q.claim_jobs(self.conn,'generator',kind='native_example',study_language='es')[0]
        q.fail_job(self.conn,first.id,'Parse failure at position1',worker_id='generator',claim_token=first.claim_token,response='same malformed output')
        q.retry_failed_job(self.conn,first.id,{'action':'Repair JSON'})
        second=q.claim_jobs(self.conn,'generator',kind='native_example',study_language='es')[0]
        q.fail_job(self.conn,second.id,'Parse failure at position2',worker_id='generator',claim_token=second.claim_token,response='same malformed output')
        self.assertIsNone(q.retry_failed_job(self.conn,second.id,{'action':'Repair JSON again'}))
        self.assertEqual(q.queue_counts(self.conn)['total_jobs'],baseline+1)
        self.assertEqual(q.dispatch_counts(self.conn)['active_agent_queue'],1)
        self.assertEqual(self.conn.execute('SELECT reason FROM agent_queue WHERE job_id=?',(second.id,)).fetchone()[0],'repeated-runtime-failure')
        self.assertEqual(q.checked_results(self.conn,'es','es2'),[])

    def test_identical_runtime_error_without_response_also_stops(self):
        for index in range(2):
            job=q.claim_jobs(self.conn,'generator',kind='native_example',study_language='es')[0]
            q.fail_job(self.conn,job.id,'Out of memory',worker_id='generator',claim_token=job.claim_token)
            result=q.retry_failed_job(self.conn,job.id,{'retry':True})
            self.assertEqual(result is None,index==1)
        self.assertEqual(q.get_job(self.conn,job.id).status,'failed')

    def test_runtime_retry_rejects_nonfailed_and_stale_review_jobs(self):
        native=q.claim_jobs(self.conn,'generator',kind='native_example',study_language='es')[0]
        with self.assertRaises(ValueError):q.retry_failed_job(self.conn,native.id,{})
        q.finish_job(self.conn,native.id,{'text':'Native draft.'},worker_id='generator',claim_token=native.claim_token,producer=GEN)
        review=q.claim_jobs(self.conn,'reviewer',kind='review',study_language='es')[0]
        q.fail_job(self.conn,review.id,'Bad response',worker_id='reviewer',claim_token=review.claim_token)
        self.write_lines(self.base/'sources/examples/es-corrections.jsonl',[{'id':'es2','word':'changed-again','meaningEn':'New sense','reason':'Changed','provenance':PROVENANCE}])
        q.prepare_queue(self.conn,self.repo,source_senses_path=self.senses)
        with self.assertRaisesRegex(ValueError,'superseded'):q.retry_failed_job(self.conn,review.id,{})

    def test_competing_connections_do_not_claim_the_same_jobs(self):
        other=q.open_queue(self.db)
        try:
            one=q.claim_jobs(self.conn,'one',limit=3);two=q.claim_jobs(other,'two',limit=3)
            self.assertFalse({j.id for j in one}&{j.id for j in two})
        finally:other.close()


if __name__=='__main__':unittest.main()
