#!/usr/bin/env python3
"""Import only KANJIDIC2 character readings used by a study core; no search codes.

python3 scripts/content/import-kanjidic-practice.py XML.gz CORE.json OUTPUT.json
Download: https://www.edrdg.org/kanjidic/kanjidic2.xml.gz
Imported readings: CC BY-SA 4.0; see output source attribution and project docs.
"""
import gzip, hashlib, json, sys, xml.etree.ElementTree as ET
from pathlib import Path

def compile_readings(source, core):
    raw=source.read_bytes()
    root=ET.fromstring(gzip.decompress(raw))
    chars=set(''.join(row['word'] for row in core['entries']))
    entries=[]
    for node in root.findall('character'):
        literal=node.findtext('literal')
        if literal not in chars: continue
        readings=node.findall('./reading_meaning/rmgroup/reading')
        entries.append({'literal':literal, **{kind:list(dict.fromkeys(row.text for row in readings if row.get('r_type')=='ja_'+kind)) for kind in ('on','kun')}})
    return {'version':1,'source':{'title':'KANJIDIC2','creator':'James William Breen and the Electronic Dictionary Research and Development Group','license':'CC-BY-SA-4.0','licenseUrl':'https://www.edrdg.org/edrdg/licence.html','documentationUrl':'https://www.edrdg.org/wiki/KANJIDIC_Project.html','downloadUrl':'https://www.edrdg.org/kanjidic/kanjidic2.xml.gz','sha256':hashlib.sha256(raw).hexdigest(),'created':root.findtext('header/date_of_creation'),'fields':['character/literal','reading_meaning/rmgroup/reading[@r_type="ja_on"]','reading_meaning/rmgroup/reading[@r_type="ja_kun"]']},'entries':entries}

if __name__=='__main__':
    source,core,output=map(Path,sys.argv[1:])
    result=compile_readings(source,json.loads(core.read_text()))
    output.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    print(f"Imported {len(result['entries'])} character reading records")
