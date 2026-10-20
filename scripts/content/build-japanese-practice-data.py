#!/usr/bin/env python3
"""Compile reviewed Japanese inflections into compact, offline runtime data.

This deterministic projection consumes hash-bound audit inputs. It does not
guess conjugation classes, fetch dictionaries, write a core, or restart content
generation. Full source/rule proofs remain in the companion local audit.
"""
from __future__ import annotations
import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
import re

REPO=Path(__file__).resolve().parents[2]
KINDS={'te','past','negative','potential','passive','causative','causative-passive',
       'conditional','volitional','adjective'}
SUBKINDS={'negative','past','past-negative','te','conditional','adnominal','adverbial'}
EXCLUDED={'archaic','obsolete','classical','historical','polite','formal','honorific',
          'humble','respectful','romanization','error-unrecognized-form','kyūjitai',
          'dated','dialectal','colloquial'}
APPROVED={'source-verified-form-transformation','reviewed-form-transformation'}
IDEOGRAPH=re.compile('[\u3400-\u9fff\U00020000-\U0003134f]')


def read(path):
    return json.loads(path.read_text(encoding='utf-8'))


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def reject(message):
    raise ValueError(message)


def checked_inputs(audit_dir, manifest):
    if manifest.get('reviewStatus')!='peer-accepted':
        reject('Japanese practice inputs have not passed the recorded peer review')
    loaded={}
    for name,expected in manifest['inputs'].items():
        path=audit_dir/name
        if digest(path)!=expected:
            reject('Stale or modified reviewed input: '+name)
        loaded[name]=read(path)
    return loaded


def reference_urls(group, sources):
    urls=set()
    for variant in group.get('variants',[]):
        if not isinstance(variant,dict):
            continue
        for proof in variant.get('evidence',[]):
            key=proof['sourceKey']
            if key not in sources:
                reject('Unknown source proof key: '+key)
            source=sources[key]
            source=source.get('provenance',source)
            for field in ['creator','license','licenseUrl','url','historyUrl','snapshotSha256','sourceLine','sourceRowDigest']:
                if not source.get(field):
                    reject('Incomplete source provenance: '+key+'/'+field)
            urls.add(source['url'])
            if 'derivation' in proof:
                urls.add(proof['derivation']['referenceUrl'])
    urls.update(group.get('rule',{}).get('references',[]))
    for evidence in group.get('classEvidence',[]):
        if evidence.get('sourceKey'):
            source=sources[evidence['sourceKey']]
            urls.add(source.get('provenance',source)['url'])
        for field in ['url','corroboratingUrl','predicateReference']:
            if evidence.get(field):urls.add(evidence[field])
        for key in evidence.get('lexicalSourceKeys',[]):
            source=sources[key]
            urls.add(source.get('provenance',source)['url'])
    if not urls or any(not u.startswith('https://') for u in urls):
        reject('Every emitted group requires HTTPS factual references')
    return sorted(urls)


def is_gated(entry, kind, eligibility):
    for gate in eligibility['gates']:
        if (entry['word'] in gate['words'] and kind in gate['groups'] and
                entry['pronunciation']==gate.get('readings',{}).get(entry['word'])):
            return True
    return any(s.get('honorificLexeme') for s in entry.get('alignedSources',[])) and kind in eligibility['honorificLexemePolicy']['withhold']


def standard_answers(group, entry):
    kind=group['formKind'];answers=set()
    classes={c for s in entry.get('alignedSources',[]) for c in s.get('explicitClasses',[])}
    if group.get('rule',{}).get('verifiedClass'):
        classes.add(group['rule']['verifiedClass'])
    for variant in group['variants']:
        if isinstance(variant,str):
            text=variant
        else:
            text=variant['text']
            if variant.get('register')!='plain':continue
            proofs=variant.get('evidence',[])
            if not proofs:reject('Source variant without evidence: '+entry['id'])
            if not any(not (set(p.get('sourceTags',[]))|set(p.get('sourceTableTags',[])))&EXCLUDED for p in proofs):
                continue
        if not text or re.search('[A-Za-z0-9\s]',text):
            reject('Malformed Japanese answer: '+repr(text))
        # Full-form prompts must not reject a legitimate contracted response by
        # silently implying that all causative variants are being tested.
        if kind=='causative' and not text.endswith('せる'):continue
        if kind=='causative-passive' and not text.endswith('せられる'):continue
        if kind=='potential' and classes&{'2','ichidan','kuru'} and not text.endswith('られる'):
            continue
        answers.add(text)
    # Prefer ordinary written answers; keep source-supported kana alternatives.
    return sorted(answers,key=lambda text:(not bool(IDEOGRAPH.search(text)),text))


def compile_data(core, inputs, manifest, eligibility):
    base=inputs['candidates.json']
    additions=inputs['reviewed-additions.json']
    correction=inputs['corrected-reading-candidates.json']
    if additions['baselineCandidatesSha256']!=manifest['inputs']['candidates.json']:
        reject('Reviewed additions are bound to a different baseline audit')
    if base['report']['fullSourceSha256']!=additions['fullSourceSha256']:
        reject('Source snapshot selections differ between the two audit stages')
    if base['report']['sourceWarnings']:
        reject('Unresolved source provenance warnings')
    source_entries={e['id']:e for e in base['entries']}
    current={e['id']:e for e in core['entries'] if e['partOfSpeech'] in {'verb','adjective'}}
    if set(current)!=set(source_entries):
        reject('Applicable core entries differ from reviewed vocabulary; re-audit required')
    approved=manifest['readingCorrections']
    if len(approved)!=1 or any(correction.get(k)!=approved[0].get(k) for k in ['id','word','baselinePronunciation','correctedPronunciation']):
        reject('The reading override is not the approved correction')
    correction_id=correction['id']
    pending_core_corrections=[]
    for entry_id,e in source_entries.items():
        c=current[entry_id]
        if c['word']!=e['word'] or c['partOfSpeech']!=e['partOfSpeech']:
            reject('Stale lexical binding: '+entry_id)
        expected_readings={e['pronunciation']}
        if entry_id==correction_id:expected_readings.add(correction['correctedPronunciation'])
        if c.get('pronunciation') not in expected_readings:
            reject('Stale reading binding: '+entry_id)
        if entry_id==correction_id and c['pronunciation']!=correction['correctedPronunciation']:
            pending_core_corrections.append(approved[0])
    source_entries[correction_id]=correction['entry']
    sources={**base['sources'],**correction['sources']}
    extra={e['id']:e for e in additions['entries']}
    output=[];removed=Counter();counts=Counter()
    for entry_id,e in source_entries.items():
        groups=list(e['candidates'])+extra.get(entry_id,{}).get('addedGroups',[])
        merged={}
        for group in groups:
            kind=group['formKind'];sub=group.get('subKind')
            if kind not in KINDS or (kind=='adjective' and sub not in SUBKINDS) or (kind!='adjective' and sub is not None):
                reject('Invalid form group '+entry_id+'/'+kind)
            if group['runtimeEligibility'] not in APPROVED or is_gated(e,kind,eligibility):
                removed['withheldGroups']+=1
                continue
            answers=standard_answers(group,e)
            if not answers:
                removed['noStandardAnswerGroups']+=1
                continue
            key=(kind,sub)
            target=merged.setdefault(key,{'formKind':kind,**({'subKind':sub} if sub else {}),'answers':set(),'references':set()})
            target['answers'].update(answers)
            target['references'].update(reference_urls(group,sources))
        emitted=[]
        for _,g in sorted(merged.items(),key=lambda item:str(item[0])):
            g['answers']=sorted(g['answers'],key=lambda text:(not bool(IDEOGRAPH.search(text)),text))
            g['references']=sorted(g['references']);emitted.append(g)
            counts[g['formKind']]+=1
        if not emitted:reject('No supported standard form for '+entry_id)
        if len(emitted)>20 or any(len(g['answers'])>30 or len(g['references'])>30 for g in emitted):
            reject('Runtime group bounds exceeded for '+entry_id)
        output.append({'entryId':entry_id,'groups':emitted})
    result={'version':1,'forms':sorted(output,key=lambda e:e['entryId'])}
    excluded_features=sum(is_gated(e,kind,eligibility) for e in source_entries.values()
                          if e['partOfSpeech']=='verb' for kind in KINDS-{'adjective'})
    report={'entries':len(output),'groups':sum(len(e['groups']) for e in output),
            'answers':sum(len(g['answers']) for e in output for g in e['groups']),
            'groupsByKind':dict(sorted(counts.items())),**removed,
            'explicitlyExcludedFeatureGroups':excluded_features,
            'excludedFeaturesWithoutStoredCandidate':excluded_features-removed['withheldGroups'],
            'entriesWithoutSupportedForms':0,
            'requiredCoreCorrections':pending_core_corrections,
            'scope':'Approved standard pure-form transformations, not sentence-context certification.',
            'promptContracts':{'causative':'Request the full standardせる/させる form.',
                               'causative-passive':'Request the full uncontracted form.',
                               'potential':'Request the standard form, retainingら for ichidan/kuru.',
                               'conditional':'Verb groups useば; adjective subgroup conditions follow their actual answers.'}}
    for field,expected in manifest.get('expectedRuntimeCounts',{}).items():
        if report.get(field)!=expected:
            reject('Runtime coverage differs from approved review: '+field)
    return result,report


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--audit-dir',type=Path,default=REPO/'local-data/feature-coverage-ja')
    parser.add_argument('--core',type=Path,default=REPO/'language-packages/ja-core-4.1.0.json')
    parser.add_argument('--review',type=Path,default=REPO/'language-packages/sources/exercises/ja-practice-review.json')
    parser.add_argument('--eligibility',type=Path,default=REPO/'language-packages/sources/exercises/ja-form-eligibility.json')
    parser.add_argument('--out',type=Path,default=REPO/'local-data/feature-coverage-ja/runtime-data.json')
    parser.add_argument('--require-applied-corrections',action='store_true')
    args=parser.parse_args()
    manifest=read(args.review)
    if digest(args.eligibility)!=manifest['eligibilitySha256']:
        reject('Eligibility rules differ from the reviewed rules')
    inputs=checked_inputs(args.audit_dir,manifest)
    data,report=compile_data(read(args.core),inputs,manifest,read(args.eligibility))
    if args.require_applied_corrections and report['requiredCoreCorrections']:
        reject('Core reading correction must be applied before release')
    args.out.parent.mkdir(parents=True,exist_ok=True)
    content=json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n'
    args.out.write_text(content,encoding='utf-8')
    report.update(outputSha256=hashlib.sha256(content.encode()).hexdigest(),outputBytes=len(content.encode()),
                  reviewSha256=digest(args.review),coreSha256=digest(args.core))
    args.out.with_name(args.out.stem+'-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(report,ensure_ascii=False,indent=2))


if __name__=='__main__':main()
