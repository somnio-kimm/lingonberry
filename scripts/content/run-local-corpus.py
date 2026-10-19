"""Continuous, resumable Mac GPU authoring. No network inference or publication.

Drafting, field checking and review are separate persisted steps. This process
never treats a populated field as a reviewed complete entry.
"""
from __future__ import annotations
import argparse,gc,importlib.util,json,os,re,signal,sqlite3,subprocess,sys,time,unicodedata,uuid
from pathlib import Path

HERE=Path(__file__).resolve().parent

def load_module(name,file):
    spec=importlib.util.spec_from_file_location(name,HERE/file);module=importlib.util.module_from_spec(spec);sys.modules[name]=module;spec.loader.exec_module(module);return module

runtime=load_module('corpus_metal_runtime','run-mlx-content.py')
queue=load_module('corpus_queue','prepare-gpu-jobs.py')
quality=load_module('corpus_quality','check-gpu-content.py')
digest=runtime.digest
NAMES={'de':'German','en':'British English','es':'Spanish','fr':'French','ja':'Japanese','ko':'Korean','zh':'Simplified Chinese'}
STOP=False

def stop(*_):
    global STOP
    STOP=True

def json_answer(raw):
    raw=raw.strip()
    if raw.startswith('```') and raw.endswith('```'):raw=raw.split('\n',1)[1].rsplit('```',1)[0].strip()
    value=json.loads(raw)
    if not isinstance(value,dict):raise ValueError('Expected an object')
    return value

def normalise_native(value):
    text=unicodedata.normalize('NFC',value.get('text','')).strip();focus=unicodedata.normalize('NFC',value.get('focus',{}).get('text','')).strip()
    if not text or not focus or text.count(focus)!=1:raise ValueError('Native focus absent or ambiguous')
    index=text.index(focus);offset=len(text[:index].encode('utf-16-le'))//2
    uncertainties=value.get('uncertainties',[])
    if not isinstance(uncertainties,list):raise ValueError('Uncertainties must be an array')
    return {'text':text,'focus':{'text':focus,'start':offset},'uncertainties':uncertainties}

def lean_context(job):
    p=job.payload;e=p.get('entry',{})
    return {'headword_language':NAMES[job.study_language],'headword':p.get('word',e.get('word')),'part_of_speech':p.get('part_of_speech',e.get('partOfSpeech')),'level':p.get('level'),
            'selected_meaning_english':p.get('meaning_en'),'selected_meaning_korean':p.get('meaning_ko'),
            **({'article':e['article']} if e.get('article') else {})}

def native_prompt(job):
    c=lean_context(job)
    rule='Write ONE short original natural '+NAMES[job.study_language]+' usage sentence. Use the specified headword in the specified sense AND syntactic part of speech, not a synonym. Return only JSON {"text":"sentence","focus":{"text":"exact inflected target span"},"uncertainties":[]}. Do not calculate offsets. Use ordinary concrete context; no dictionary definitions or generic discussion of the word.'
    if str(c['headword']).lower()=='long' and c['part_of_speech']=='adverb':rule+=' Adverb long modifies a verb (wait long); long in a long time is an adjective and is not valid here.'
    if str(c['headword']).lower()=='use' and c['part_of_speech']=='noun':rule+=' Use must be a noun, such as after use or the use of something, not a verb.'
    if job.payload.get('revision_request'):c['repair_request']=job.payload['revision_request'];c['previous_draft']=job.payload.get('previous_draft')
    if job.payload.get('last_error'):c['format_repair']={'error':job.payload['last_error'],'previous_response':job.payload.get('previous_response')}
    return rule+'\nDATA: '+json.dumps(c,ensure_ascii=False)

def meaning_prompt(job):
    c=lean_context(job);c['required_output_language']=NAMES[job.locale]
    rule='Give a concise natural learner definition or gloss in '+NAMES[job.locale]+' for this headword\'s SELECTED meaning. Output language is independent of headword language. Preserve explicit alternatives and grammatical function. Numerals need numeral words, not arithmetic paraphrases. Classifiers need their counting function, not just the counted noun. Return only JSON {"text":"gloss"}.'
    if job.payload.get('revision_request'):c['repair_request']=job.payload['revision_request'];c['previous_draft']=job.payload.get('previous_draft')
    if job.payload.get('last_error'):c['format_repair']={'error':job.payload['last_error'],'previous_response':job.payload.get('previous_response')}
    return rule+'\nDATA: '+json.dumps(c,ensure_ascii=False)

def translation_prompt(job):
    p=job.payload;c={'source_language':NAMES[p['source_language']],'required_output_language':NAMES[job.locale],'source_text':p['text']}
    if p.get('revision_request'):c['repair_request']=p['revision_request'];c['previous_draft']=p.get('previous_draft')
    c['scene_context']=p.get('context',p.get('source_example',{}).get('context'))
    c['trusted_reference_translations']=p.get('reference_translations',{})
    c['headword_context']=lean_context(job)
    if p.get('last_error'):c['format_repair']={'error':p['last_error'],'previous_response':p.get('previous_response')}
    return 'Translate naturally into '+NAMES[job.locale]+'. Preserve participants, polarity, quantities, tense and register. More means additional, not no more. Return only JSON {"text":"translation"}.\nDATA: '+json.dumps(c,ensure_ascii=False)

class TranslationModel(runtime.MetalModel):
    def __init__(self,path,memory_gb=None):
        super().__init__(path,memory_gb)
        # Gemma's chat template ends a turn before the generic <eos> token.
        self.tokenizer.add_eos_token('<end_of_turn>')
        runtime.emit({'event':'translation_stop_tokens','ids':sorted(self.tokenizer.eos_token_ids)})
    def tokens(self,request):
        if not isinstance(request,dict):raise ValueError('Translation model requires an explicit source/target/text object')
        messages=[{'role':'user','content':[{'type':'text','source_lang_code':request['source'],'target_lang_code':request['target'],'text':request['text']}]}]
        return self.tokenizer.apply_chat_template(messages,tokenize=True,add_generation_prompt=True)

def read_power():
    try:
        value=subprocess.check_output(['pmset','-g','batt'],text=True,timeout=5)
        match=re.search(r'(\d+)%;',value)
        return {'percent':int(match.group(1)) if match else None,'ac':'AC Power' in value}
    except (OSError,subprocess.SubprocessError):return {'percent':None,'ac':None}

def atomic_json(path,value):
    temporary=Path(str(path)+'.pending');temporary.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n');temporary.replace(path)

def trusted_provenance(job,output,source_import=False):
    p=job.payload
    if source_import:
        candidate=p.get('licensed_source_candidate') or p['candidate']
        src=dict(candidate['provenance']);src.setdefault('kind','licensed-source');return src
    if job.task=='native_example':return {'kind':'app-authored','license':'CC-BY-4.0','creator':'Learn Language contributors','method':'local-model-original-example'}
    if job.task=='example_translation':
        src=dict(p.get('source_example',{}).get('provenance',{}))
        if src.get('kind')=='app-authored':return {**src,'method':'local-model-translation'}
        sources=src.get('sources') or ([src.get('source')] if src.get('source') else [src])
    else:
        sources=[p.get('evidence',{}).get('meanings',{}).get('en',{}).get('provenance') or p.get('source') or {}]
    # Keep raw evidence for the assembler; do not invent a creator or URL.
    src=next((s for s in sources if isinstance(s,dict) and s.get('license') and s.get('url') and (s.get('creator') or s.get('author'))),None)
    if src:
        license='CC-BY-SA-4.0' if 'BY-SA' in src['license'] else src['license']
        return {'kind':'licensed-adaptation','license':license,'creator':'Learn Language contributors; '+(src.get('creator') or src['author']),'url':src['url'],'sources':sources,'method':'local-model-translation'}
    return {'kind':'unresolved-attribution','sourceEvidence':sources,'requiresSourceAudit':True}

def review_prompt(job,target,flags):
    p=job.payload;c=lean_context(target)
    c={'headword':c['headword'],'headword_language':c['headword_language'],'part_of_speech':c['part_of_speech'],'meaning_english':c['selected_meaning_english'],'meaning_korean':c['selected_meaning_korean'],'required_output_language':NAMES[job.locale],'candidate':{k:v for k,v in p['candidate'].items() if k in ('text','focus','uncertainties')}}
    if target.task=='example_translation':c={'source_text':target.payload['text'],'source_language':NAMES[target.payload['source_language']],'required_output_language':NAMES[job.locale],'candidate':p['candidate']['text']}
    c['flags_to_check']=flags
    c['scene_context']=target.payload.get('context',target.payload.get('source_example',{}).get('context'))
    c['trusted_reference_translations']=target.payload.get('reference_translations',{})
    if p.get('last_error'):c['format_repair']={'error':p['last_error'],'previous_response':p.get('previous_response')}
    rule='Check this '+target.task+' for clear meaning, language, grammar or target-POS errors. Headword language and required output language are independent. Accept a correct natural variant; do not invent errors. Offsets were computed by software: review focus wording and syntax, not arithmetic offsets. Return only compact JSON {"verdict":"pass|revise|uncertain","issues":[{"code":"short category","detail":"specific problem, maximum 25 words"}]}. Use pass and [] if correct. No reasoning prose. A classifier gloss must express counting; numeral gloss must express the correct number. Do not strengthen most to almost all. Adverb long in wait long differs from adjective long in a long time.'
    return rule+'\nDATA: '+json.dumps(c,ensure_ascii=False)

def run_translation_pilot(args):
    backend=TranslationModel(args.translation_model,args.memory_gb)
    tasks=[json.loads(x) for x in Path(args.translation_pilot).read_text().splitlines() if x.strip()]
    tasks=[x for x in tasks if x['taskType'] in ('meaning_translation','sentence_translation')]
    with Path(args.output).open('w') as stream:
        for start in range(0,len(tasks),args.batch_size):
            if STOP:break
            group=tasks[start:start+args.batch_size];requests=[]
            for row in group:
                data=row['input'];text=data.get('sourceText') or data['selectedMeaningEn'];source=data.get('sourceLanguage','en')
                requests.append({'source':source,'target':row['targetLanguage'],'text':text})
            values=backend.infer(requests,args.max_tokens,args.batch_size)
            for row,value in zip(group,values):
                raw=value.pop('output');item={'id':row['id'],'output':json.dumps({'id':row['id'],'text':raw},ensure_ascii=False),**value,'status':'unreviewed-translation-pilot'}
                stream.write(json.dumps(item,ensure_ascii=False)+'\n');stream.flush();runtime.emit(item)

# Continuous queue execution is defined below; outputs remain bound to the job and source digest.

def generation_finished(conn):
    blockers=conn.execute("SELECT count(*) FROM jobs WHERE task!='review' AND status NOT IN ('draft','checked','superseded')").fetchone()[0]
    coverage=conn.execute("SELECT value_json FROM metadata WHERE key='coverage'").fetchone()
    if not coverage:return False
    c=json.loads(coverage[0]);expected=sum(c.get(k,0) for k in ('missing_native_examples','missing_meanings','missing_existing_example_translations','deferred_translation_fields'))
    active=conn.execute("SELECT count(*) FROM jobs WHERE task!='review' AND status!='superseded'").fetchone()[0]
    return blockers==0 and active==expected and conn.execute('SELECT count(*) FROM entries').fetchone()[0]==c['entries']

def backup_to_drive(conn,destination):
    """A consistent standalone SQLite snapshot; publish the filename atomically."""
    destination=Path(destination).resolve();destination.parent.mkdir(parents=True,exist_ok=True)
    active=Path(conn.execute('PRAGMA database_list').fetchone()[2]).resolve()
    if destination==active:raise ValueError('Backup destination must differ from live database')
    if destination.exists() or Path(str(destination)+'-wal').exists():
        destination=destination.with_name(destination.stem+'-'+time.strftime('%Y%m%d-%H%M%S')+'-'+uuid.uuid4().hex[:8]+destination.suffix)
    temporary=destination.with_name(destination.name+'.'+uuid.uuid4().hex+'.pending')
    snapshot=sqlite3.connect(temporary)
    try:
        conn.backup(snapshot)
        snapshot.execute('PRAGMA journal_mode=DELETE')
        if snapshot.execute('PRAGMA integrity_check').fetchone()[0]!='ok':raise ValueError('Backup integrity check failed')
        counts={'entries':snapshot.execute('SELECT count(*) FROM entries').fetchone()[0],'jobs':snapshot.execute('SELECT count(*) FROM jobs').fetchone()[0]}
    finally:
        snapshot.close()
        for suffix in ('-wal','-shm'):
            Path(str(temporary)+suffix).unlink(missing_ok=True)
    with temporary.open('rb') as stream:os.fsync(stream.fileno())
    temporary.replace(destination)
    return {'path':str(destination),'integrity':'ok',**counts}


class JobSchedule:
    """Finish ready priority-language drafts and their native prerequisites first."""
    def __init__(self,kinds,languages,priority_locales=(),examples_first=False):
        if (priority_locales or examples_first) and 'review' in kinds:
            raise ValueError('Generation priorities currently require --draft-only')
        standard=[(kind,lang,None) for lang in languages for kind in kinds]
        priority=[]
        for lang in languages:
            for kind in kinds:
                if kind=='native_example':priority.append((kind,lang,None))
                else:
                    priority.extend((kind,lang,locale) for locale in priority_locales
                                    if locale!=lang or (lang=='en' and kind=='meaning'))
        self.phases=[priority,standard] if priority_locales else [standard]
        self.names=['priority-explanations','remaining-explanations'] if priority_locales else ['all-explanations']
        if examples_first:
            self.phases=[[(kind,lang,locale) for kind,lang,locale in slots if kind!='native_example'] for slots in self.phases]
            self.phases.insert(0,[(kind,lang,None) for lang in languages for kind in kinds if kind=='native_example'])
            self.names.insert(0,'native-examples')
        self.phase=0;self.cursor=0

    @property
    def name(self):
        return self.names[self.phase] if self.phase<len(self.names) else 'no-ready-work'

    def claim(self,conn,worker_id,batch_size):
        while self.phase<len(self.phases):
            slots=self.phases[self.phase]
            for _ in range(len(slots)):
                kind,lang,locale=slots[self.cursor%len(slots)];self.cursor+=1
                jobs=queue.claim_jobs(conn,worker_id,limit=batch_size,kind=kind,study_language=lang,locale=locale)
                if jobs:return jobs
            self.phase+=1;self.cursor=0
        return []


def run_queue(args):
    conn=queue.open_queue(args.db)
    if args.recover_running:runtime.emit({'event':'recovered_claims','count':queue.recover_running_jobs(conn,worker_id=args.worker_id)})
    run_dir=Path(args.run_dir);run_dir.mkdir(parents=True,exist_ok=True)
    qwen=None;translator=None;processed=0;started=time.monotonic()
    def model():
        nonlocal qwen
        if qwen is None:qwen=runtime.MetalModel(args.model,args.memory_gb)
        return qwen
    def mt():
        nonlocal translator
        if translator is None:translator=TranslationModel(args.translation_model,args.memory_gb)
        return translator
    kinds=['native_example','meaning','example_translation'] if args.draft_only else ['native_example','review','meaning','review','example_translation','review']
    priority_locales=getattr(args,'priority_locales',())
    schedule=JobSchedule(kinds,queue.LANGUAGES,priority_locales,getattr(args,'examples_first',False))
    runtime.emit({'event':'generation_schedule','priority_locales':list(priority_locales),'examples_first':getattr(args,'examples_first',False),'phase':schedule.name})
    with (run_dir/'attempts.jsonl').open('a') as trace:
        while not STOP:
            power=read_power()
            if power['percent'] is not None and power['percent']<args.battery_floor:
                atomic_json(run_dir/'status.json',{'state':'paused-low-battery','power':power,'pid':os.getpid(),'processed_this_run':processed,'database':args.db})
                time.sleep(30);continue
            jobs=schedule.claim(conn,args.worker_id,args.batch_size)
            if not jobs:
                counts=queue.queue_counts(conn);state=('draft-generation-finished-review-pending' if generation_finished(conn) else 'generation-needs-repair') if args.draft_only else 'no-claimable-work'
                atomic_json(run_dir/'status.json',{'state':state,'counts':counts,'pid':os.getpid(),'processed_this_run':processed,'database':args.db})
                runtime.emit({'event':state,'counts':counts});break
            generated=[];prompts=[];bindings={}
            for job in jobs:
                p=job.payload
                if job.task!='review' and p.get('licensed_source_candidate') and not p.get('revision_request') and p.get('source_import_allowed',True):
                    candidate=queue.source_candidate_output(job)
                    check=quality.check_content(p,candidate)
                    if not check['structuralValid']:
                        queue.fail_job(conn,job.id,{'detail':'Bound source candidate failed structural validation','checks':check},worker_id=args.worker_id,claim_token=job.claim_token)
                        processed+=1;continue
                    source=p['licensed_source_candidate']
                    queue.finish_job(conn,job.id,candidate,worker_id=args.worker_id,claim_token=job.claim_token,producer={'role':'local-draft','method':'licensed-source-import','model':None,'revision':source['source_snapshot_sha256'],'prompt_digest':None,'source_digest':source['source_digest'],'candidate_digest':p['licensed_source_candidate_digest']})
                    processed+=1;continue
                if job.task=='meaning' and p.get('candidate') and not p.get('revision_request') and p.get('source_import_allowed',True):
                    candidate={'text':p['candidate']['text']};candidate['provenance']=trusted_provenance(job,candidate,True)
                    check=quality.check_content(p,candidate)
                    if check['structuralValid']:
                        queue.finish_job(conn,job.id,candidate,worker_id=args.worker_id,claim_token=job.claim_token,producer={'role':'local-draft','method':'licensed-source-import','model':None,'revision':p['candidate']['source_snapshot_sha256'],'prompt_digest':None,'source_digest':p['candidate']['source_digest']})
                        processed+=1;continue
                generated.append(job)
                if job.task=='review':
                    target=queue.get_job(conn,p['target_job_id']);draft=p['candidate'];checked=quality.check_content(target.payload,draft)
                    if not checked['structuralValid']:
                        prompts.append(None);bindings[job.id]=(target,None,checked);continue
                    request=quality.make_field_review_request(target.payload,draft);bindings[job.id]=(target,request['binding'],checked)
                    prompts.append(review_prompt(job,target,checked['reviewFlags']))
                elif job.task=='native_example':prompts.append(native_prompt(job))
                elif job.task=='meaning':prompts.append(meaning_prompt(job))
                else:prompts.append(translation_prompt(job))
            if generated:
                usable=[i for i,p in enumerate(prompts) if p is not None];results={}
                # A translation-specialised model receives source/target/text through its native template.
                use_mt=generated[0].task=='example_translation' and all(not j.payload.get('revision_request') for j in generated) and bool(args.translation_model)
                if usable:
                    actual_requests=[prompts[i] for i in usable]
                    if use_mt:
                        requests=[{'source':generated[i].payload['source_language'],'target':generated[i].locale,'text':generated[i].payload['text']} for i in usable]
                        actual_requests=requests
                    backend=None
                    try:
                        backend=mt() if use_mt else model()
                        inferred=backend.infer(actual_requests,args.max_tokens,args.batch_size)
                    except Exception as error:
                        # Runtime failures are not evidence that a dictionary entry is invalid.
                        if backend is None or not any(x in str(error).lower() for x in ('memory','allocation','out of')):
                            queue.recover_running_jobs(conn,worker_id=args.worker_id)
                            atomic_json(run_dir/'status.json',{'state':'runtime-error','error':str(error),'pid':os.getpid(),'claims_recovered':True})
                            raise
                        gc.collect();backend.mx.clear_cache()
                        if args.batch_size>1:
                            args.batch_size=max(1,args.batch_size//2)
                            queue.recover_running_jobs(conn,worker_id=args.worker_id)
                            runtime.emit({'event':'memory_backoff','batch_size':args.batch_size,'error':str(error)})
                            continue
                        # Include structural-review claims too; none may remain stranded.
                        for failed in generated:
                            queue.fail_job(conn,failed.id,str(error),worker_id=args.worker_id,claim_token=failed.claim_token)
                            queue.retry_failed_job(conn,failed.id,{'error':str(error)},max_rounds=3)
                        runtime.emit({'event':'inference_batch_failed','error':str(error),'jobs':[j.id for j in generated]})
                        continue
                    results=dict(zip(usable,inferred))
                for i,job in enumerate(generated):
                    response=results.get(i);pass_id=uuid.uuid4().hex
                    producer={'role':'local-review' if job.task=='review' else 'local-draft','model':args.translation_model if use_mt else args.model,'revision':args.translation_revision if use_mt else args.revision,'prompt_digest':digest(actual_requests[usable.index(i)] if i in usable else prompts[i]),'pass_id':pass_id,'template_digest':(translator if use_mt else qwen).template_digest if response else None}
                    trace.write(json.dumps({'job_id':job.id,'input_hash':job.input_hash,'producer':producer,'response':response},ensure_ascii=False)+'\n');trace.flush();os.fsync(trace.fileno())
                    try:
                        if job.task=='review' and response is None:
                            target,binding,checked=bindings[job.id]
                            review={'verdict':'revise','issues':[{'code':x['code'],'detail':x['message']} for x in checked['errors']]}
                        else:
                            if response['finish_reason']!='stop':raise ValueError('Truncated model response')
                            value={'text':response['output'].strip()} if use_mt else json_answer(response['output'])
                            if job.task=='review':
                                review=value;target,binding,checked=bindings[job.id]
                                validation=quality.validate_field_review(target.payload,job.payload['candidate'],review,binding=binding,author_pass_id=str(job.payload['generator'].get('pass_id','source-import-'+str(target.id))),reviewer_pass_id=pass_id)
                                if not validation['reviewValid']:raise ValueError('; '.join(validation['errors']))
                                if review['verdict']=='pass' and validation['reviewFlags']:
                                    review={'verdict':'uncertain','issues':[{'code':x['code'],'detail':x['message']} for x in validation['reviewFlags']],'model_verdict':value}
                            else:
                                output=normalise_native(value) if job.task=='native_example' else {'text':unicodedata.normalize('NFC',value.get('text','')).strip()}
                                checked=quality.check_content(job.payload,output)
                                if not checked['structuralValid']:raise ValueError(json.dumps(checked['errors'],ensure_ascii=False))
                                output['provenance']=trusted_provenance(job,output)
                                queue.finish_job(conn,job.id,output,worker_id=args.worker_id,claim_token=job.claim_token,producer=producer)
                        if job.task=='review':
                            status=queue.record_review(conn,job.id,review,worker_id=args.worker_id,claim_token=job.claim_token,producer=producer)
                            if status=='rejected':queue.enqueue_repair(conn,target.id,job.id,review,max_rounds=3)
                        processed+=1
                    except (ValueError,TypeError,KeyError,AttributeError) as error:
                        queue.fail_job(conn,job.id,str(error),worker_id=args.worker_id,claim_token=job.claim_token,response=response)
                        queue.retry_failed_job(conn,job.id,{'error':str(error),'previous_response':response},max_rounds=3)
                        runtime.emit({'event':'job_needs_repair','job_id':job.id,'error':str(error)})
            elapsed=time.monotonic()-started
            atomic_json(run_dir/'status.json',{'state':'running-drafts' if args.draft_only else 'running-generation-and-review','pid':os.getpid(),'database':args.db,'processed_this_run':processed,'elapsed_seconds':round(elapsed,1),'power':power,'last_job_ids':[j.id for j in jobs],'drafts_are_complete_entries':False,'all_entries':conn.execute('SELECT count(*) FROM entries').fetchone()[0],'all_pairs':43,'priority_locales':list(priority_locales),'generation_phase':schedule.name})
            runtime.emit({'event':'progress','processed_this_run':processed,'elapsed_seconds':round(elapsed,1),'jobs':[j.id for j in jobs]})
            if args.limit and processed>=args.limit:break
    summary={'counts':queue.queue_counts(conn),'stopped':STOP,'pid':os.getpid(),'processed_this_run':processed,'whole_entry_review_still_required':True}
    if not STOP and generation_finished(conn) and args.final_drive_backup:
        summary['drive_backup']=backup_to_drive(conn,args.final_drive_backup)
    atomic_json(run_dir/'final-snapshot.json',summary)
    final_state='interrupted' if STOP else 'startup-limit-reached' if args.limit and processed>=args.limit else 'generation-finished-review-pending' if generation_finished(conn) else 'generation-needs-repair'
    atomic_json(run_dir/'status.json',{**summary,'state':final_state,'database':args.db})
    conn.close()

def main():
    p=argparse.ArgumentParser(description=__doc__)
    g=p.add_mutually_exclusive_group(required=True);g.add_argument('--db');g.add_argument('--translation-pilot')
    p.add_argument('--model',default=str(Path.home()/'Library/Caches/LearnLanguage/models/qwen35-9b'));p.add_argument('--revision',default='8b2b98c00a6b4d291155e4890773ca8f769aee53')
    p.add_argument('--translation-model',default='');p.add_argument('--translation-revision',default='5788ec08c047f3f2e17808101b8d9566ac930d58')
    p.add_argument('--batch-size',type=int,default=4);p.add_argument('--max-tokens',type=int,default=256);p.add_argument('--memory-gb',type=float,default=None,help='Optional model allocation cap; omitted uses MLX/macOS defaults');p.add_argument('--battery-floor',type=int,default=20);p.add_argument('--output');p.add_argument('--run-dir',default='local-data/generation/run');p.add_argument('--final-drive-backup');p.add_argument('--worker-id',default='mac-gpu-full-corpus');p.add_argument('--recover-running',action='store_true');p.add_argument('--draft-only',action='store_true');p.add_argument('--limit',type=int,default=0);p.add_argument('--lock',default='local-data/generation/gpu.lock')
    p.add_argument('--priority-locales',nargs='+',choices=queue.LANGUAGES,default=(),help='Draft these explanations and prerequisite native examples before other locales')
    p.add_argument('--examples-first',action='store_true',help='Draft native examples across all study languages before any explanations')
    args=p.parse_args()
    args.priority_locales=tuple(dict.fromkeys(args.priority_locales))
    if (args.priority_locales or args.examples_first) and (not args.draft_only or not args.db):p.error('Generation priorities require --db and --draft-only')
    if not 1<=args.batch_size<=8 or not 1<=args.max_tokens<=2048 or args.limit<0:raise ValueError('Unsafe run bounds')
    signal.signal(signal.SIGINT,stop);signal.signal(signal.SIGTERM,stop)
    with runtime.gpu_lock(args.lock):
        if args.translation_pilot:
            if not args.output:raise ValueError('--output required for pilot')
            run_translation_pilot(args)
        else:run_queue(args)

if __name__=='__main__':main()
