#!/usr/bin/env python3
"""Import supplied phonetic text only. No audio, inference, APIs or guessed sounds."""
import gzip
import hashlib
import json
from pathlib import Path
import re
import sys
import unittest
from urllib.parse import quote
ROOT = Path(__file__).resolve().parents[2]
POS = {'adj':'adjective','adv':'adverb','proper-noun':'noun','proper noun':'noun','plural noun':'noun','phrase':'expression','phrasal-verb':'verb','num':'numeral','pron':'pronoun','prep':'preposition','conj':'conjunction','intj':'interjection','det':'determiner'}
EXCLUDED = {'obsolete','archaic','dated','rare','nonstandard','reconstructed','past','past-tense','plural','comparative','superlative','third-person','present-participle','past-participle','inflected'}
def pos(value):
    return POS.get(value, value)
def select_sound(sounds, language, part):
    ranked=[]
    for sound in sounds:
        ipa=sound.get('ipa','').strip(); tags=set(sound.get('tags',[]))
        if sound.get('form') or tags & EXCLUDED or not re.fullmatch(r'/[^/\n]{1,160}/|\[[^\]\n]{1,160}\]',ipa) or '*' in ipa:
            continue
        tagged_pos={pos(tag) for tag in tags if pos(tag) in {'noun','verb','adjective','adverb'}}
        if tagged_pos and part not in tagged_pos:
            continue
        if language=='en':
            accent=0 if tags & {'UK','British','Received-Pronunciation','RP','British-English'} else 1 if not tags or tags<= {'noun','verb','adjective','adverb','standard'} else 2 if tags & {'US','General-American','American'} else 3
        else:
            accent=0 if not tags or tags & {'Germany','Standard-German','standard'} else 1
        # Prefer a broad transcription over a narrow allophonic rendering of it.
        ranked.append(((accent,0 if ipa.startswith('/') else 1),ipa,sorted(tags)))
    if not ranked:
        return None
    best=min(item[0] for item in ranked); choices={ipa for rank,ipa,_ in ranked if rank==best}
    if len(choices)!=1:
        return None  # e.g. lead /li:d/ vs /led/: do not assign a heteronym by guesswork.
    ipa=next(iter(choices))
    return {'pronunciation':ipa,'tags':next(tags for rank,value,tags in ranked if rank==best and value==ipa)}
def digest(path):
    result=hashlib.sha256()
    with path.open('rb') as source:
        for block in iter(lambda:source.read(8*1024*1024),b''):
            result.update(block)
    return result.hexdigest()
def build():
    configurations=[('en','language-packages/en-core-7.0.5.json','local-data/feature-sources/en-wiktionary.jsonl'),('de','language-packages/de-core-4.0.0.json','local-data/sources/legacy-german-dictionary-downloads/de-extract.jsonl.gz')]
    sources=[];output=[];report={}
    for language,core_path,relative in configurations:
        core=json.loads((ROOT/core_path).read_text()); wanted={(entry['word'],pos(entry['partOfSpeech'])) for entry in core['entries'] if not entry.get('pronunciation')}; spellings={word for word,_ in wanted}; grouped={}; path=ROOT/relative
        opener=gzip.open if path.suffix=='.gz' else open
        with opener(path,'rt') as source:
            for line in source:
                row=json.loads(line)
                if row.get('lang_code',language)!=language or row.get('word') not in spellings:
                    continue
                identity=(row['word'],pos(row.get('pos')))
                if identity in wanted:
                    grouped.setdefault(identity,[]).extend(row.get('sounds',[]))
        source_hash=digest(path); sources.append({'language':language,'edition':language,'creator':('English' if language=='en' else 'German')+' Wiktionary contributors','sourceFile':relative,'sourceSha256':source_hash,'extraction':'Kaikki / Wiktextract','extractionUrl':'https://kaikki.org/dictionary/rawdata.html','snapshotNote':'Existing cached extraction; exact upstream dump date is not recorded.','license':'CC-BY-SA-4.0','licenseUrl':'https://creativecommons.org/licenses/by-sa/4.0/'})
        selected={}
        for (word,part),sounds in sorted(grouped.items()):
            result=select_sound(sounds,language,part)
            if result:
                selected[(word,part)]=result
                output.append({'language':language,'word':word,'partOfSpeech':part,**result,'sourceUrl':f'https://{language}.wiktionary.org/wiki/{quote(word,safe="")}','historyUrl':f'https://{language}.wiktionary.org/w/index.php?title={quote(word,safe="")}&action=history'})
        count=sum((row['word'],pos(row['partOfSpeech'])) in selected for row in core['entries']);report[language]={'sourceHeadwordPosGroups':len(grouped),'selectedHeadwordPosGroups':len(selected),'addedEntryReadings':count,'totalEntries':len(core['entries'])};print(language,report[language],flush=True)
    data={'schemaVersion':1,'license':'CC-BY-SA-4.0','licenseUrl':'https://creativecommons.org/licenses/by-sa/4.0/','creators':['English Wiktionary contributors','German Wiktionary contributors','Lingonberry contributors'],'changes':'Selected current supplied IPA by exact headword and normalised part of speech; preferred British English and broad transcription; omitted ambiguous best-ranked pronunciations, historical/inflected readings and audio. No phonetic transcription was generated.','sources':sources,'coverage':report,'entries':output}
    destination=ROOT/'language-packages/sources/dictionary-pronunciations-20261118.json';destination.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n');print(destination,flush=True)
class Boundaries(unittest.TestCase):
    def test_british_priority(self):
        self.assertEqual(select_sound([{'ipa':'/kɑɹ/','tags':['General-American']},{'ipa':'/kɑː/','tags':['Received-Pronunciation']},{'ipa':'[kʰɑː]','tags':['Received-Pronunciation']}],'en','noun')['pronunciation'],'/kɑː/')
    def test_heteronym_ambiguity(self):
        self.assertIsNone(select_sound([{'ipa':'/liːd/'},{'ipa':'/lɛd/'}],'en','verb'))
    def test_forms_and_pos(self):
        for sound in [{'ipa':'/kɑː/','form':'cars'},{'ipa':'/kɑː/','tags':['archaic']},{'ipa':'/kɑː/','tags':['verb']},{'ipa':'made-up'}]:
            self.assertIsNone(select_sound([sound],'en','noun'))
    def test_german_and_duplicates(self):
        self.assertEqual(select_sound([{'ipa':'[ˈaʊ̯to]'},{'ipa':'[ˈaʊ̯to]'}],'de','noun')['pronunciation'],'[ˈaʊ̯to]')
        self.assertEqual(pos('adj'),'adjective')
if __name__=='__main__':
    if '--self-test' in sys.argv:unittest.main(argv=[sys.argv[0]])
    else:build()
