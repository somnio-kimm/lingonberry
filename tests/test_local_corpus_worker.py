import importlib.util,json,sqlite3,sys,tempfile,unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch,Mock
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('local_corpus_worker',ROOT/'scripts/content/run-local-corpus.py');m=importlib.util.module_from_spec(spec);sys.modules[spec.name]=m;spec.loader.exec_module(m)

class LocalWorkerTests(unittest.TestCase):
 def test_bound_source_draft_never_loads_a_model_and_keeps_review_pending(self):
  with tempfile.TemporaryDirectory() as folder:
   db=Path(folder)/'queue.sqlite';conn=m.queue.open_queue(db)
   entry={'id':'book','word':'book','partOfSpeech':'noun'}
   evidence={'meanings':{},'examples':[],'generation_revision':'test'}
   digest=m.queue.digest({'entry':entry,'evidence':evidence})
   conn.execute('INSERT INTO entries VALUES(?,?,?,?,?,?)',('en','book',digest,m.queue.encoded(entry),m.queue.encoded(evidence),m.queue.now()))
   candidate={'text':'a written work for reading','provenance':{'creator':'Wiktionary contributors','license':'CC-BY-SA-4.0','url':'https://en.wiktionary.org/wiki/book'},'source_snapshot_sha256':'a'*64,'source_digest':'b'*64}
   body={'entry':entry,'word':'book','part_of_speech':'noun','source_digest':digest,'licensed_source_candidate':candidate,'licensed_source_candidate_digest':m.queue.digest(candidate),'source_import_of_job_id':99}
   job_id=m.queue.enqueue_job(conn,'en','book','meaning','en',body);conn.close()
   args=SimpleNamespace(db=str(db),recover_running=False,worker_id='test',run_dir=folder,draft_only=True,battery_floor=20,batch_size=1,translation_model='',model='unused',memory_gb=9,max_tokens=10,limit=1,final_drive_backup=None)
   with patch.object(m,'read_power',return_value={'percent':100,'ac':True}),patch.object(m.runtime,'MetalModel') as model,patch.object(m,'TranslationModel') as translator:
    m.run_queue(args)
   model.assert_not_called();translator.assert_not_called()
   conn=m.queue.open_queue(db)
   self.assertEqual(m.queue.get_job(conn,job_id).status,'draft')
   self.assertEqual(conn.execute("SELECT count(*) FROM jobs WHERE task='review' AND status='pending'").fetchone()[0],1)
   result=json.loads(conn.execute('SELECT output_json FROM results WHERE job_id=?',(job_id,)).fetchone()[0])
   self.assertEqual(result['provenance']['license'],'CC-BY-SA-4.0');conn.close()

 def test_all_language_examples_precede_priority_explanations_and_other_languages(self):
  schedule=m.JobSchedule(['native_example','meaning','example_translation'],('en','ko','ja'),('en','ko'),examples_first=True)
  pending={('native_example','en',None):[['english-example']],('native_example','ko',None):[['korean-example']],('native_example','ja',None):[['japanese-example-1'],['japanese-example-2']],('meaning','en','en'):[['english-meaning']],('example_translation','ja','ko'):[['korean-translation']],('meaning','ja',None):[['other-meaning']]}
  def claim(conn,worker_id,*,limit,kind,study_language,locale):
   batches=pending.get((kind,study_language,locale),[])
   return batches.pop(0) if batches else []
  with patch.object(m.queue,'claim_jobs',side_effect=claim):
   for expected in ('english-example','korean-example','japanese-example-1','japanese-example-2'):
    self.assertEqual(schedule.claim(None,'test',1),[expected])
    self.assertEqual(schedule.name,'native-examples')
   for expected in ('english-meaning','korean-translation'):
    self.assertEqual(schedule.claim(None,'test',1),[expected])
    self.assertEqual(schedule.name,'priority-explanations')
   self.assertEqual(schedule.claim(None,'test',1),['other-meaning'])
   self.assertEqual(schedule.name,'remaining-explanations')
  restarted=m.JobSchedule(['native_example','meaning','example_translation'],('en','ko','ja'),('en','ko'),examples_first=True)
  self.assertEqual(restarted.name,'native-examples')

 def test_priority_schedule_preserves_prerequisites_and_self_pair_rules(self):
  schedule=m.JobSchedule(['native_example','meaning','example_translation'],('en','ko','ja'),('en','ko'))
  slots=schedule.phases[0]
  for lang in ('en','ko','ja'):self.assertIn(('native_example',lang,None),slots)
  self.assertIn(('meaning','en','en'),slots)
  self.assertNotIn(('meaning','ko','ko'),slots)
  self.assertNotIn(('example_translation','en','en'),slots)
  self.assertIn(('example_translation','ja','en'),slots)
  self.assertIn(('example_translation','ja','ko'),slots)
  self.assertFalse(any(locale=='ja' for _,_,locale in slots))
  with self.assertRaises(ValueError):m.JobSchedule(['review'],('ja',),('en','ko'))

 def test_other_locales_wait_until_all_ready_priority_work_is_exhausted(self):
  schedule=m.JobSchedule(['native_example','meaning','example_translation'],('ja',),('en','ko'))
  pending={('native_example','ja',None):['native'],('meaning','ja','ko'):['korean'],('example_translation','ja','en'):['english-example'],('meaning','ja',None):['french']}
  def claim(conn,worker_id,*,limit,kind,study_language,locale):
   return pending.pop((kind,study_language,locale),[])
  with patch.object(m.queue,'claim_jobs',side_effect=claim):
   self.assertEqual(schedule.claim(None,'test',1),['native'])
   self.assertEqual(schedule.claim(None,'test',1),['korean'])
   self.assertEqual(schedule.claim(None,'test',1),['english-example'])
   self.assertEqual(schedule.name,'priority-explanations')
   self.assertEqual(schedule.claim(None,'test',1),['french'])
   self.assertEqual(schedule.name,'remaining-explanations')
   self.assertEqual(schedule.claim(None,'test',1),[])

 def test_model_memory_cap_is_applied_only_when_explicit(self):
  mx=Mock();m.runtime.configure_memory_limits(mx)
  mx.set_memory_limit.assert_not_called()
  m.runtime.configure_memory_limits(mx,6)
  mx.set_memory_limit.assert_called_once_with(6*1024**3)
  for value in (0,-1,13):
   with self.assertRaises(ValueError):m.runtime.configure_memory_limits(mx,value)
  self.assertEqual(mx.set_memory_limit.call_count,1)
 def test_native_focus_is_host_computed_in_utf16(self):
  result=m.normalise_native({'text':'🙂 I wait long.','focus':{'text':'long','start':999},'review':{'approved':True}})
  self.assertEqual(result['focus'],{'text':'long','start':10});self.assertNotIn('review',result)
 def test_missing_ambiguous_and_malformed_focus_are_rejected(self):
  for value in [{'text':'I wait for ages.','focus':{'text':'long'}},{'text':'go go','focus':{'text':'go'}},{'text':'Go now.','focus':{'text':'Go'},'uncertainties':'none'}]:
   with self.assertRaises(ValueError):m.normalise_native(value)
 def test_translation_retains_scene_and_reference_context(self):
  job=SimpleNamespace(study_language='de',locale='ja',payload={'source_language':'de','text':'Ihr Büro ist im zweiten Stock.','context':'France; a woman owns this office.','reference_translations':{'en':'Her office is on the second floor.'},'entry':{'word':'Büro','partOfSpeech':'noun'},'word':'Büro','part_of_speech':'noun'})
  prompt=m.translation_prompt(job)
  self.assertIn('France; a woman',prompt);self.assertIn('Her office',prompt);self.assertIn('Japanese',prompt)
 def test_source_import_keeps_licence_and_creator(self):
  source={'license':'CC-BY-SA-2.0-KR','creator':'NIKL','url':'https://krdict.korean.go.kr/example'}
  result=m.trusted_provenance(SimpleNamespace(payload={'candidate':{'provenance':source}}),{},True)
  self.assertEqual(result,{**source,'kind':'licensed-source'});self.assertNotIn('kind',source)
 def test_json_rejects_incomplete_nonobjects_and_extra_prose(self):
  self.assertEqual(m.json_answer('```json\n{"text":"hello"}\n```'),{'text':'hello'})
  for text in ['[]','{"text":','Here is the answer: {"text":"hello"}']:
   with self.assertRaises((ValueError,json.JSONDecodeError)):m.json_answer(text)
 def test_model_startup_failure_recovers_claims_without_blame_on_content(self):
  with tempfile.TemporaryDirectory() as folder:
   job=SimpleNamespace(id=1,study_language='en',entry_id='book',task='native_example',locale='en',input_hash='hash',claim_token='claim',payload={'word':'book','part_of_speech':'noun','entry':{'word':'book','partOfSpeech':'noun'},'meaning_en':'a printed work'})
   fake=SimpleNamespace(open_queue=Mock(return_value=object()),LANGUAGES=('en',),claim_jobs=Mock(return_value=[job]),recover_running_jobs=Mock(),fail_job=Mock())
   args=SimpleNamespace(db='unused',recover_running=False,worker_id='test',run_dir=folder,draft_only=True,battery_floor=20,batch_size=1,translation_model='',model='missing',memory_gb=9,max_tokens=10)
   with patch.object(m,'queue',fake),patch.object(m,'read_power',return_value={'percent':100,'ac':True}),patch.object(m.runtime,'MetalModel',side_effect=RuntimeError('weights missing')):
    with self.assertRaisesRegex(RuntimeError,'weights missing'):m.run_queue(args)
   fake.recover_running_jobs.assert_called_once();fake.fail_job.assert_not_called()
   self.assertEqual(json.loads((Path(folder)/'status.json').read_text())['state'],'runtime-error')
 def test_drive_backup_is_verified_single_file_and_preserves_old_copy(self):
  with tempfile.TemporaryDirectory() as folder:
   source=Path(folder)/'live.sqlite';destination=Path(folder)/'drive.sqlite';conn=sqlite3.connect(source)
   conn.execute('PRAGMA journal_mode=WAL');conn.executescript('CREATE TABLE entries(id); CREATE TABLE jobs(id); INSERT INTO entries VALUES(1); INSERT INTO jobs VALUES(2);');conn.commit()
   result=m.backup_to_drive(conn,destination);self.assertEqual(result['integrity'],'ok');self.assertEqual(result['entries'],1)
   copy=sqlite3.connect(destination);self.assertEqual(copy.execute('PRAGMA journal_mode').fetchone()[0],'delete');self.assertEqual(copy.execute('SELECT id FROM jobs').fetchone()[0],2);copy.close()
   self.assertFalse(Path(str(destination)+'-wal').exists());self.assertEqual(list(Path(folder).glob('*.pending*')),[])
   second=m.backup_to_drive(conn,destination);self.assertNotEqual(second['path'],str(destination));self.assertTrue(destination.exists())
   with self.assertRaises(ValueError):m.backup_to_drive(conn,source)
   conn.close()
 def test_generation_completion_cannot_ignore_missing_or_failed_fields(self):
  conn=sqlite3.connect(':memory:');conn.executescript('CREATE TABLE entries(id);CREATE TABLE jobs(task,status);CREATE TABLE metadata(key,value_json);INSERT INTO entries VALUES(1);')
  coverage={'entries':1,'missing_native_examples':1,'missing_meanings':1,'missing_existing_example_translations':0,'deferred_translation_fields':6}
  conn.execute('INSERT INTO metadata VALUES(?,?)',('coverage',json.dumps(coverage)));conn.execute("INSERT INTO jobs VALUES('native_example','draft')")
  self.assertFalse(m.generation_finished(conn))
  conn.executemany('INSERT INTO jobs VALUES(?,?)',[('meaning','draft')]+[('example_translation','draft')]*6)
  self.assertTrue(m.generation_finished(conn));conn.execute("UPDATE jobs SET status='failed' WHERE task='meaning'");self.assertFalse(m.generation_finished(conn));conn.close()

if __name__=='__main__':unittest.main()
