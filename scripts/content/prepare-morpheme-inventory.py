#!/usr/bin/env python3
"""Prepare readable reference rows and translation tasks from fixed, attributed source snapshots.

Run after inventory-english-morphemes.py. Raw HTML and extraction state remain local;
release authoring JSON and hashes are stored separately after review.
"""
from pathlib import Path
from bs4 import BeautifulSoup
import re,json,hashlib,collections
import argparse
parser=argparse.ArgumentParser()
parser.add_argument('--directory',type=Path,default=Path('local-data/morpheme-inventory'))
args=parser.parse_args()
root=args.directory;rows=[];rejected=[]
for p in sorted(root.glob('roots-*.html')):
 soup=BeautifulSoup(p.read_text(),'html.parser');url='https://en.wikipedia.org/wiki/List_of_Greek_and_Latin_roots_in_English/'+p.stem[6:]
 for x in soup.select('sup,.sortkey,.mw-editsection'):x.decompose()
 for table in soup.select('table'):
  spans={}
  for tr in table.select('tr'):
   cells={};col=0
   for k,(v,n) in list(spans.items()):
    cells[k]=v
    if n>1:spans[k]=(v,n-1)
    else:del spans[k]
   for c in tr.find_all(['td','th'],recursive=False):
    while col in cells:col+=1
    for _ in range(int(c.get('colspan',1))):
     cells[col]=c
     if int(c.get('rowspan',1))>1:spans[col]=(c,int(c['rowspan'])-1)
     col+=1
   if len(cells)!=5 or any(c.name=='th' for c in cells.values()):continue
   c=[cells[i] for i in range(5)];raw=c[0].get_text(' ',strip=True)
   term=re.sub(r'\([^)]*\)','',raw);term=re.sub(r'\s*-\s*','-',term)
   forms=[x.strip() for x in re.split(r'[,;/]',term) if re.fullmatch("-?[A-Za-z]+(?:[-'][A-Za-z]+)*-?",x.strip())]
   meaning=c[1].get_text(' ',strip=True);origin=c[2].get_text(' ',strip=True) or 'Not specified'
   origin=origin.replace('Ancient Greek','Greek')
   examples=[re.sub(r'\([^)]*\)','',x).strip() for x in c[4].get_text('',strip=False).split(',')]
   examples=[re.sub(r'\s+',' ',x) for x in examples if re.fullmatch("[A-Za-z][A-Za-z '\n-]{0,70}",x)]
   if not forms or not meaning or not re.fullmatch('[A-Za-z ,/()-]+',origin):rejected.append({'form':raw,'meaning':meaning,'origin':origin});continue
   identity=json.dumps([forms,meaning,origin]);id='root-'+hashlib.sha256(identity.encode()).hexdigest()[:20]
   rows.append({'id':id,'form':forms[0],'variants':forms[1:],'kind':'root','origin':origin,'senses':[{'id':id+'-0','en':meaning}],'examples':list(dict.fromkeys(examples)),'source':url,'license':'CC-BY-SA-4.0'})
rows=list({x['id']:x for x in rows}.values());(root/'roots-without-meaning.json').write_text(json.dumps(rejected,ensure_ascii=False,indent=2)+'\n');print('roots',len(rows),'rejected',rejected)
for raw in map(json.loads,(root/'affixes.jsonl').read_text().splitlines()):
 identity=[raw['form'],raw['partOfSpeech'],raw['etymologyNumber'],[s['glosses'] for s in raw['senses']]];id='affix-'+hashlib.sha256(json.dumps(identity).encode()).hexdigest()[:20]
 names={'la':'Latin','grc':'Greek','ang':'Old English','enm':'Middle English','en':'English','fr':'French','fro':'Old French','de':'German','it':'Italian','es':'Spanish','pt':'Portuguese','nl':'Dutch','non':'Old Norse','he':'Hebrew','ar':'Arabic','sa':'Sanskrit','ja':'Japanese','ko':'Korean','zh':'Chinese','ru':'Russian','la-new':'New Latin','la-med':'Medieval Latin','la-lat':'Late Latin'}
 langs=[]
 for t in raw['etymologyTemplates']:
  a=t.get('args',{});name=t['name']
  if a.get('1')!='en':continue
  if name in ['bor','bor+','borrowed','lbor','lbor+','learned borrowing','slbor','slbor+','der','der+','derived','inh','inh+','inherited','uder','unadapted borrowing']:
   if a.get('2')in names:langs.append(a['2'])
  if name=='ety':
   code=re.match(r'([a-z-]+):',a.get('3',''))
   if code and code[1]in names:langs.append(code[1])
 origin=names[langs[0]]if langs else 'Not specified'
 if not langs:
  # Read explicit prose attribution only. A tree ending in "English FORM" is not origin evidence.
  for clause in re.findall(r'(?:^|\n)(?:From|Borrowed from|Learned borrowing from|Inherited from) ([^.,;()\n]+)',raw['etymologyText']):
   found=next((label for label in sorted(set(names.values()),key=len,reverse=True)if clause.startswith(label+' ')or clause==label),None)
   if found:origin=found;break
 examples=[x['word'] for x in raw['derived'] if isinstance(x,dict) and 'word'in x and re.fullmatch("[A-Za-z][A-Za-z '-]{0,70}",x['word'])]
 for s in raw['senses']:
  for e in s['examples']:
   txt=e.get('text','');right=txt.split('→')[-1].strip() if '→'in txt else txt
   if re.fullmatch("[A-Za-z][A-Za-z '-]{0,70}",right):examples.append(right)
 rows.append({'id':id,'form':raw['form'],'variants':[],'kind':raw['partOfSpeech'],'origin':origin,'senses':[{'id':id+'-'+str(s['ordinal']),'en':' '.join(dict.fromkeys(s['glosses'])),'tags':s['tags']} for s in raw['senses']], 'examples':list(dict.fromkeys(examples)), 'source':raw['provenance']['url'],'sourceLine':raw['provenance']['sourceLine'],'license':'CC-BY-SA-4.0'})
rows=list({x['id']:x for x in rows}.values());(root/'inventory-draft.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n')
tasks=[{'id':s['id'],'form':r['form'],'kind':r['kind'],'origin':r['origin'],'en':s['en']}for r in rows for s in r['senses']]
for part in range(3):
 subset=tasks[part::3];(root/f'translation-input-{part+1}.jsonl').write_text(''.join(json.dumps(x,ensure_ascii=False)+'\n'for x in subset));print('part',part+1,len(subset))
print('source groups',len(rows),'senses',len(tasks),'forms',len(set(r['form']for r in rows)))
