#!/usr/bin/env python3
"""Publish authoring data only with complete ID-matched bilingual meanings and source hashes."""
import argparse
import collections
import hashlib
import json
from pathlib import Path
import re

parser=argparse.ArgumentParser()
parser.add_argument('--directory',type=Path,default=Path('local-data/morpheme-inventory'))
parser.add_argument('--output',type=Path,default=Path('language-packages/sources/exercises/english-morpheme-inventory.json'))
args=parser.parse_args();directory=args.directory
read=lambda name:json.loads((directory/name).read_text())
entries=read('inventory-draft.json');translations={};review_files=[]
for part in range(1,4):
 path=directory/f'translation-output-{part}.jsonl'
 rows=[json.loads(line)for line in path.read_text().splitlines()if line.strip()]
 expected={r['id']for r in map(json.loads,(directory/f'translation-input-{part}.jsonl').read_text().splitlines())}
 actual={r['id']for r in rows}
 if len(rows)!=len(actual)or actual!=expected:raise ValueError(f'Incomplete or duplicate translation part {part}: {len(expected-actual)} missing / {len(actual-expected)} extra')
 for row in rows:
  text=row.get('ko','').strip()
  if not text or not re.search('[가-힣]',text)or len(text)>4000:raise ValueError('Missing Korean explanation '+row['id'])
  translations[row['id']]=text
 review_files.append({'part':part,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'rows':len(rows)})
for row in entries:
 for sense in row['senses']:sense['ko']=translations[sense['id']]
source_corrections=[]
for path in sorted(directory.glob('review-*.json')):
 review=json.loads(path.read_text())
 if isinstance(review,dict):source_corrections+=review.get('sourceCorrections',[])
by_sense={s['id']:s for row in entries for s in row['senses']}
for correction in source_corrections:
 if 'correctEnglish' in correction:
  sense=by_sense[correction['id']]
  if sense['en']!=correction['inputEnglish']:raise ValueError('Changed correction baseline')
  sense['en']=correction['correctEnglish']
  if correction.get('korean'):sense['ko']=correction['korean']
entries+=read('supplemental-roots.json')
entries.sort(key=lambda row:(row['form'].strip('-').lower(),row['kind'],row['id']))
ids=set();sense_ids=set()
for row in entries:
 if row['id']in ids:raise ValueError('Duplicate row')
 ids.add(row['id'])
 for label in [row['form'],*row['variants']]:
  if not re.fullmatch("-?[A-Za-z]+(?:[-'][A-Za-z]+)*-?",label):raise ValueError('Unreadable form '+label)
 for sense in row['senses']:
  if sense['id']in sense_ids:raise ValueError('Duplicate sense')
  sense_ids.add(sense['id'])
  if not sense['en'].strip()or not sense['ko'].strip():raise ValueError('Empty meaning')
report={'entries':len(entries),'distinctPrimaryForms':len({r['form']for r in entries}),'senses':len(sense_ids),'byKind':dict(collections.Counter(r['kind']for r in entries)),
 'completeEnglishMeanings':len(sense_ids),'completeKoreanMeanings':len(sense_ids),'missingEnglish':0,'missingKorean':0,
 'reconstructedDisplayForms':0,'nativeSpeakerCertification':False,
 'scope':'All defined ASCII-labelled English affix records in the complete cached Wiktionary snapshot, plus all defined Greek/Latin root table rows and five independently checked blank-row supplements. Three remaining blank table rows already occur as variants in defined groups. Source records preserve homonymous etymologies; totals are entries and senses, not a claim of this many unique families in English.',
 'translationReview':review_files,'sourceCorrections':source_corrections}
source={'version':1,'license':'CC-BY-SA-4.0','creator':'English Wiktionary contributors; Wikipedia contributors; Lingonberry Korean translation and editorial adaptations',
 'notice':'Source text and derived Korean translations are CC BY-SA 4.0. Existing vocabulary licences remain unchanged. Extraction and AI-assisted translation checks do not constitute native-speaking lexicographer certification. Historical notation remains outside display forms. Unknown origins are explicitly labelled; no ancestry is invented.',
 'snapshots':read('source-snapshots.json'),'coverage':report,'entries':entries}
args.output.parent.mkdir(parents=True,exist_ok=True);args.output.write_text(json.dumps(source,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(report,ensure_ascii=False,indent=2))
