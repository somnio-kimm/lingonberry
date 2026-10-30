import Capacitor
import WebKit

// Opt-in simulator smoke checks; no test code is compiled into release builds.
class AppViewController: CAPBridgeViewController {
    #if DEBUG
    private var verificationStarted = false
    override func capacitorDidLoad() {
        if ProcessInfo.processInfo.arguments.contains("--verify-offline-packages") {
            let script = """
            const originalFetch = window.fetch;
            window.fetch = (input, options) => {
              const url = new URL(input.url || input, location.href);
              if (url.protocol === 'https:' || url.protocol === 'http:') return Promise.reject(new Error('Native offline test'));
              return originalFetch(input, options);
            };
            """
            webView?.configuration.userContentController.addUserScript(WKUserScript(source: script, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        }
    }
    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        let arguments = ProcessInfo.processInfo.arguments
        guard !verificationStarted && (arguments.contains("--verify-language-packages") || arguments.contains("--verify-offline-packages") || arguments.contains("--verify-english-corrections") || arguments.contains("--verify-japanese-corrections") || arguments.contains("--verify-dictation-design") || arguments.contains("--verify-shared-settings") || arguments.contains("--verify-japanese-furigana") || arguments.contains("--verify-japanese-okurigana")) else { return }
        verificationStarted = true
        verifyPackages(attempt: 0)
    }
    private func verifyPackages(attempt: Int) {
        webView?.evaluateJavaScript("Boolean(document.documentElement.dataset.catalogState === 'ready')") { [weak self] value, _ in
            guard let self = self else { return }
            guard value as? Bool == true else {
                if attempt < 50 { DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { self.verifyPackages(attempt: attempt + 1) } }
                else { print("NATIVE_PACKAGE_QA_ERROR app did not become ready") }
                return
            }
            self.webView?.callAsyncJavaScript("""
                const wait = async predicate => {
                  const deadline = Date.now() + 45000;
                  while (!predicate()) {
                    if (!document.querySelector('#retry').hidden) throw new Error(document.querySelector('#status').textContent);
                    if (Date.now() > deadline) throw new Error('Timed out waiting for native study view');
                    await new Promise(resolve => setTimeout(resolve, 100));
                  }
                };
                const select = (id, value) => {
                  const element = document.getElementById(id);element.value = value;
                  element.dispatchEvent(new Event('change', {bubbles:true}));
                };
                if (!window.crypto?.subtle) throw new Error('Web Crypto is unavailable in the native WebView');
                if (okurigana) {
                  const {createPackageStorage}=await import('./js/packages/storage.js'),{installedPairs}=await import('./js/packages/library.js'),{assembleStudy}=await import('./js/packages/study.js'),{studyWords}=await import('./js/presentation/study-profiles.js'),{prepareLanguageExercises}=await import('./js/shared/exercise-pools.js'),{exerciseAnswerCorrect}=await import('./js/shared/language-exercises.js'),{renderExercisePrompt}=await import('./js/shared/exercise-view.js');
                  const storage=createPackageStorage(),pairs=installedPairs(await storage.list()).filter(row=>row.targetLanguage==='ja'&&['en','ko'].includes(row.explanationLanguage)),checks=[];
                  if(!pairs.length)throw new Error('A Japanese explanation package must be installed');
                  for(const pair of pairs) {
                    const study=assembleStudy(await storage.get('ja-core',pair.studyVersion),await storage.get(pair.id,pair.version)),words=studyWords(study),word=words.find(row=>row.lemma==='久しい'),rows=prepareLanguageExercises(study,words);
                    const typed=rows.find(row=>row.entryId===word?.id&&row.category==='okurigana'&&row.route==='vocabinput'),choice=rows.find(row=>row.entryId===word?.id&&row.category==='okurigana'&&row.route==='vocabmeaning');
                    if(typed?.prompt!=='ひさしい'||typed.answer!=='久しい'||!exerciseAnswerCorrect(typed,'久しい')||exerciseAnswerCorrect(typed,'ひさしい')||exerciseAnswerCorrect(typed,'久い')||!choice?.options.includes('久い')||choice.options.length<3||choice.options.some(value=>!value.startsWith('久')))throw new Error('Incorrect kana-to-complete-word Okurigana exercise');
                    const prompt=renderExercisePrompt({...typed,exercise:true,word});
                    if(prompt.includes('久しい')||prompt.includes('<rt>'))throw new Error('Okurigana question reveals the written answer');
                    const act=words.find(row=>row.lemma==='行う'),variant=rows.find(row=>row.entryId===act?.id&&row.category==='okurigana'&&row.route==='vocabinput');
                    if(!variant||!exerciseAnswerCorrect(variant,'行なう'))throw new Error('Dictionary-authorised alternative spelling was rejected');
                    checks.push({locale:pair.explanationLanguage,prompt:typed.prompt,answer:typed.answer,options:choice.options,acceptedVariant:'行なう'});
                  }
                  return JSON.stringify({passed:true,checks});
                }
                if (furigana) {
                  const {renderJapaneseRuby}=await import('./js/shared/japanese-furigana.js');
                  const host=document.createElement('div'),checks=[];host.style.cssText='position:absolute;left:-10000px;top:0';document.body.append(host);
                  try {
                    for(const context of ['lexicon-detail','lexicon-view'])for(const width of [260,640]) {
                      host.className=context;host.style.width=width+'px';
                      host.innerHTML=`<p class="example-sentence" lang="ja">あ${renderJapaneseRuby('食べる','たべる')}い</p><p class="example-sentence" lang="ja">${('あ'+renderJapaneseRuby('取り扱う','とりあつかう')+'い。').repeat(8)}</p>`;
                      await document.fonts.ready;
                      for(const [index,sentence]of [...host.children].entries()) {
                        const style=getComputedStyle(sentence),line=parseFloat(style.lineHeight),font=parseFloat(style.fontSize),glyphs=[],canvas=document.createElement('canvas').getContext('2d');
                        const ink=(text,node,box)=>{const s=getComputedStyle(node);canvas.font=`${s.fontWeight} ${s.fontSize} ${s.fontFamily}`;const m=canvas.measureText(text),baseline=box.bottom-m.fontBoundingBoxDescent;return {top:baseline-m.actualBoundingBoxAscent,bottom:baseline+m.actualBoundingBoxDescent};};
                        const walker=document.createTreeWalker(sentence,NodeFilter.SHOW_TEXT);let text;
                        while(text=walker.nextNode()) {
                          if(text.parentElement.closest('rt'))continue;let at=0;
                          for(const character of text.textContent){const end=at+character.length;if(/[^。]/u.test(character)){const range=document.createRange();range.setStart(text,at);range.setEnd(text,end);const box=range.getBoundingClientRect();glyphs.push({top:box.top,ink:ink(character,text.parentElement,box)});}at=end;}
                        }
                        const rows=[];for(const glyph of glyphs){let row=rows.find(row=>Math.abs(row[0].top-glyph.top)<line/2);if(!row){row=[];rows.push(row);}row.push(glyph);}
                        if(line<font*2.2||(!index&&rows.length!==1)||rows.some(row=>Math.max(...row.map(g=>g.top))-Math.min(...row.map(g=>g.top))>=1))throw new Error('Japanese sentence baseline/reading clearance differs');
                        for(const rt of sentence.querySelectorAll('rt')) {
                          const box=rt.getBoundingClientRect(),bounds=ink(rt.textContent,rt,box),base=rt.parentElement.firstChild,baseRange=document.createRange();baseRange.selectNodeContents(base);const baseInk=ink(base.textContent,rt.parentElement,baseRange.getBoundingClientRect());
                          if(getComputedStyle(rt.parentElement).display.includes('flex')||bounds.bottom>baseInk.top+.5||box.top<sentence.getBoundingClientRect().top-1||!Number.isFinite(bounds.top)||glyphs.some(g=>Math.min(g.ink.bottom,bounds.bottom)-Math.max(g.ink.top,bounds.top)>.5))throw new Error('Japanese furigana overlaps or lacks reserved space: '+JSON.stringify({context,width,index,display:getComputedStyle(rt).display,rubyDisplay:getComputedStyle(rt.parentElement).display,top:box.top,bottom:box.bottom,sentenceTop:sentence.getBoundingClientRect().top,bounds,glyphs}));
                        }
                        checks.push({context,width,wrapped:!!index,rows:rows.length,lineHeight:line,fontSize:font});
                      }
                    }
                    return JSON.stringify({passed:true,checks});
                  }finally{host.remove();}
                }
                if (settings) {
                  const original=JSON.parse(localStorage.getItem('learn-language.preferences.v1')||'{}');
                  const settingsPage=async()=>{document.querySelector('[data-tab=settings]').click();await wait(()=>document.querySelector('#target')&&document.querySelector('main').dataset.viewState==='ready');};
                  const values=()=>({theme:document.documentElement.dataset.theme,uiLanguage:document.querySelector('#display-language').value,hapticEnabled:document.querySelector('#set-haptic').getAttribute('aria-checked')==='true',autoRemoveResolvedWrongs:document.querySelector('#set-hide-resolved').getAttribute('aria-checked')==='true'});
                  const open=async(target,explanation)=>{
                    await settingsPage();select('target',target);
                    await wait(()=>document.querySelector('main').dataset.viewState==='ready'&&document.querySelector('#package-status').dataset.state!=='loading');
                    const options=[...document.querySelector('#explanation').options].map(option=>option.value).filter(Boolean);
                    const chosen=options.includes(explanation)?explanation:options.includes('en')?'en':options[0];
                    if(chosen){select('explanation',chosen);await wait(()=>document.querySelector('#package-status').dataset.state==='ready'&&document.querySelector('main').dataset.viewState==='ready');}
                  };
                  await settingsPage();const expected=values(),targets=[...document.querySelector('#target').options].map(option=>option.value).filter(Boolean),checks=[];
                  if(!targets.length)throw new Error('No installed languages available for the settings check');
                  for(const target of targets){
                    await open(target,original.explanation);const actual=values();
                    if(JSON.stringify(actual)!==JSON.stringify(expected))throw new Error('App settings changed for '+target+': '+JSON.stringify(actual));
                    checks.push({language:target,settings:actual});
                  }
                  await open(original.target||targets[0],original.explanation);
                  return JSON.stringify({passed:true,checks,restored:original.target||targets[0]});
                }
                if (dictation) {
                  const original = JSON.parse(localStorage.getItem('learn-language.preferences.v1') || '{}');
                  const open = async (target, explanation) => {
                    document.querySelector('[data-tab=settings]').click();
                    await wait(()=>document.querySelector('#target'));
                    select('target',target);
                    await wait(()=>document.querySelector('#explanation option[value="en"],#explanation option[value="ko"]'));
                    const value = explanation || (document.querySelector('#explanation option[value="en"]')?'en':'ko');
                    select('explanation',value);
                    await wait(()=>document.querySelector('#package-status').dataset.state==='ready');
                    document.querySelector('[data-tab=home]').click();
                    await wait(()=>document.querySelector('[data-route=listening],[data-quiz=listening]'));
                    document.querySelector('[data-route=listening],[data-quiz=listening]').click();
                    await wait(()=>document.querySelector('.listening-mode-controls') && document.querySelector('.filter-fold'));
                  };
                  const checks=[],baselines=new Map();
                  const measure = () => {
                    const q=document.querySelector('.listening-question'),box=q.getBoundingClientRect(),filter=document.querySelector('.filter-fold').getBoundingClientRect();
                    const item = selector => {const node=document.querySelector(selector),b=node.getBoundingClientRect(),style=getComputedStyle(node);return {x:b.left-box.left,y:b.top-box.top,width:b.width,height:b.height,radius:style.borderRadius,font:style.fontSize};};
                    return {width:box.width,height:box.height,gap:box.top-filter.bottom,speaker:item('#listening-play'),answer:item('.listening-question .vocab-answer-cell'),field:item('#listening-answer'),hint:item('#listening-hint'),submit:item('#listening-submit'),skip:item('#listening-skip')};
                  };
                  for(const language of ['de','zh','en','ja']) {
                    await open(language);
                    if(document.querySelector('.filter-fold').open)document.querySelector('.filter-fold>summary').click();
                    for(const mode of ['listenword','listensentence']) {
                      document.querySelector(`button[data-listening-mode="${mode}"]`).click();
                      await wait(()=>document.querySelector('.listening-test')?.dataset.listeningMode===mode && document.querySelector('#listening-answer'));
                      const geometry=measure(),target=language==='ja'?'zh':'de',key=target+':'+mode;
                      if(language==='de'||language==='zh')baselines.set(language+':'+mode,geometry);
                      else if(JSON.stringify(geometry)!==JSON.stringify(baselines.get(key)))throw new Error('Full Dictation differs from '+target+': '+language+' '+mode+' '+JSON.stringify(geometry));
                      if(document.querySelector('#listening-answer').tagName!=='TEXTAREA'||document.querySelector('.listening-transcript rt'))throw new Error('Invalid answer field or early reading disclosure');
                      checks.push({language,mode,geometry});
                    }
                  }
                  const {createPackageStorage}=await import('./js/packages/storage.js'),storage=createPackageStorage(),records=await storage.list();
                  const coreRecord=records.filter(row=>row.id==='ja-core').sort((a,b)=>b.version.localeCompare(a.version,undefined,{numeric:true}))[0],core=await storage.get(coreRecord.id,coreRecord.version),entry=core.entries.find(row=>row.word==='食べる');
                  const {renderJapaneseRuby}=await import('./js/shared/japanese-furigana.js');
                  const sample=document.createElement('div');sample.className='listening-transcript';sample.lang='ja-JP';sample.style.cssText='position:absolute;top:-10000px';sample.innerHTML=renderJapaneseRuby(entry.word,entry.pronunciation);document.querySelector('main').append(sample);
                  const rt=sample.querySelector('rt');if(!rt)throw new Error('Japanese furigana is missing');const ruby={reading:rt.textContent,font:getComputedStyle(rt).fontSize};sample.remove();
                  if(ruby.reading!=='た'||ruby.font!=='13px')throw new Error('Japanese furigana/okurigana alignment differs');
                  await open(original.target || 'en',original.explanation);
                  return JSON.stringify({passed:true,checks,furigana:ruby,restored:original.target || 'en'});
                }
                const pairs = [];
                const originalEnglishLevel = JSON.parse(localStorage.getItem('learn-language.en.lexicon.v1') || '{}').preferences?.studyLevel;
                const checks = japanese ? [['ja','en','ja-lex-7985a44e7b819ef6641a','in what manner'],['ja','ko','ja-lex-7985a44e7b819ef6641a','어떻게']] : english ? [['en','en','en-lex-d2e8946b4935cf8fc6d1','angular momentum'],['en','ko','en-lex-d2e8946b4935cf8fc6d1','각운동량']] : [['de','ko','de-noun-abend-editorial-main','저녁'],['de','en','de-noun-abend-editorial-main','evening'],['zh','en','hsk1_1','to love; to like deeply'],['zh','ko','hsk1_1','사랑하다; 좋아하다']];
                for (const [target, explanation, entryId, meaning] of checks) {
                  document.querySelector('[data-tab=settings]').click();
                  await wait(() => document.querySelector('#manage-packages'));
                  if (!offline) {
                    document.querySelector('#manage-packages').click();
                    await wait(() => document.querySelector(`[data-language=${target}]`));
                    document.querySelector(`[data-language=${target}]`).click();
                    await wait(() => document.querySelector(`[data-explanation=${explanation}]`));
                    const missing = document.querySelector(`[data-explanation="${explanation}"] .download-package`);
                    if (missing) {missing.click();await wait(() => document.querySelector(`[data-package="${target}-${explanation}"]`) && !document.querySelector(`[data-explanation="${explanation}"] .download-package`));}
                    document.querySelector('[data-tab=settings]').click();
                  }
                  await wait(() => document.querySelector('#target'));
                  select('target',target);
                  await wait(() => document.querySelector(`#explanation option[value=${explanation}]`));
                  select('explanation',explanation);
                  await wait(() => document.querySelector('#package-status').dataset.state === 'ready');
                  document.querySelector('[data-tab=home]').click();
                  await wait(() => document.querySelector('[data-route=wordlist],[data-quiz=wordlist]'));
                  if (english || japanese) {const level=japanese?'N5':'IELTS 4.0–6.5';document.querySelector(`[data-level="${level}"]`).click();await wait(() => document.querySelector('[data-route=wordlist]'));}
                  document.querySelector('[data-route=wordlist],[data-quiz=wordlist]').click();
                  if (english || japanese) {
                    await wait(() => document.querySelector('#search-input'));
                    const input=document.querySelector('#search-input');input.value=japanese?'どう':'spin';input.dispatchEvent(new Event('input',{bubbles:true}));
                    const found = () => document.querySelector(`.wl-row[data-word="${entryId}"] .wl-meaning`)?.textContent.includes(meaning);
                    for (const level of [...document.querySelectorAll('[data-level-filter] option')].map(option => option.value)) {
                      if (found()) break;
                      const filter = document.querySelector('[data-level-filter]');filter.value = level;
                      filter.dispatchEvent(new Event('change', {bubbles:true}));
                      await new Promise(resolve => setTimeout(resolve, 100));
                    }
                    await wait(found);
                  } else await wait(() => document.querySelector(`.wl-row[data-id="${entryId}"] .wl-meaning`)?.textContent === meaning);
                  pairs.push(target + '-' + explanation);
                }
                const result = {passed:true,pairs,origin:location.origin,wordCount:document.querySelectorAll('.wl-row').length,locale:document.documentElement.lang};
                if (english || japanese) {
                  document.querySelector('[data-tab=home]').click();
                  await wait(() => document.querySelector('[data-route=vocabinput]'));
                  const routes = japanese ? ['reading','onyomi','kunyomi','okurigana'] : ['roots','collocations'];
                  result.exerciseRoutes = routes.every(route => document.querySelector(`[data-route=${route}]`));
                  if (!result.exerciseRoutes) throw new Error('Installed language exercise routes are missing');
                  if (japanese && document.querySelector('[data-route=collocations],[data-route=transitivity],[data-route=forms],[data-route=particles],[data-route=counters],[data-route=kanji]')) throw new Error('Removed Japanese test is still visible');
                  if (english && document.querySelector('[data-route=articles],[data-route=confusables],[data-route=patterns],[data-route=phrasal]')) throw new Error('Removed English test is still visible');
                  document.querySelector('[data-route=vocabinput]').click();
                  await wait(() => document.querySelector('.vocab-question'));
                  if (document.querySelector('[data-exercise]') || document.querySelector('[data-exercise-id]')?.dataset.exerciseId) throw new Error('Default vocabulary contains specialist questions');
                  result.isolatedVocabulary = true;
                  document.querySelector('[data-tab=home]').click();
                  await wait(() => document.querySelector('[data-level]'));
                  [...document.querySelectorAll('[data-level]')].at(-1).click();
                  document.querySelector(`[data-route=${japanese ? 'reading' : 'roots'}]`).click();
                  if (japanese) {
                    await wait(() => document.querySelector('.vocab-question[data-exercise-id]'));
                    result.readingPractice = !!document.querySelector('.vocab-question')?.dataset.exerciseId;
                    if (!result.readingPractice) throw new Error('Japanese reading practice is missing');
                  } else {
                    await wait(() => document.querySelector('[data-root-view=browse]'));
                    document.querySelector('[data-root-view=browse]').click();
                    await wait(() => document.querySelector('[data-root-kind]'));
                    result.rootInventory=document.querySelector('[data-root-count]')?.textContent;
                    result.rootInventoryTotal=Number(document.querySelector('[data-root-count]')?.dataset.total);
                    const {createPackageStorage} = await import('./js/packages/storage.js');
                    const storage = createPackageStorage(), records = await storage.list();
                    const core = records.filter(row => row.id === 'en-core').sort((a,b) => b.version.localeCompare(a.version,undefined,{numeric:true}))[0];
                    result.englishPackages = records.filter(row => row.targetLanguage === 'en').map(row => ({id:row.id,version:row.version}));
                    const installed = core && await storage.get(core.id,core.version);
                    result.installedRootCount = installed?.morphemes?.length || 0;
                    if (result.rootInventoryTotal !== result.installedRootCount || result.rootInventoryTotal < 1000) throw new Error('Visible full root inventory does not match the installed package');
                    const rootSearch=document.querySelector('#root-search');rootSearch.value='aud';rootSearch.dispatchEvent(new Event('input',{bubbles:true}));
                    result.rootMembers = document.querySelectorAll('[data-root-word]').length;
                    if (result.rootMembers < 3 || !document.querySelector('.root-origin')) throw new Error('Learner root families are missing');
                    if (installed.contentReview?.commonCoverage) {
                      result.commonCoverage = installed.contentReview.commonCoverage;
                      result.commonWords = [];
                      const pair = await storage.get('en-ko',core.version), meanings = new Map(pair.entries.map(row=>[row.id,row.meaning]));
                      for (const spelling of ['the','and','email','trousers','Monday','March','May','parent','spin']) {
                        const entry = installed.entries.find(row=>row.word===spelling && row.level==='IELTS 1.0–3.5');
                        if (!entry) throw new Error('Missing basic dictionary entry: '+spelling);
                        document.querySelector('[data-tab=home]').click();
                        await wait(()=>document.querySelector('[data-level]'));
                        document.querySelector(`[data-level="${entry.level}"]`).click();
                        document.querySelector('[data-route=wordlist]').click();
                        await wait(()=>document.querySelector('#search-input'));
                        const input=document.querySelector('#search-input');input.value=spelling;input.dispatchEvent(new Event('input',{bubbles:true}));
                        await wait(()=>document.querySelector(`.wl-row[data-word="${entry.id}"] .wl-meaning`)?.textContent===meanings.get(entry.id));
                        result.commonWords.push(spelling);
                      }
                    }

                  }

                  document.querySelector('[data-tab=home]').click();
                  await wait(() => document.querySelector('[data-level]'));
                  if (english) {
                    const original = [...document.querySelectorAll('[data-level]')].find(node => node.dataset.level === originalEnglishLevel);
                    original?.click();
                    document.querySelector('[data-route=roots]').click();
                    await wait(() => document.querySelector('[data-root-view=browse]'));
                    document.querySelector('[data-root-view=browse]').click();
                    const search = document.querySelector('#root-search');search.value='';search.dispatchEvent(new Event('input',{bubbles:true}));
                  }
                  return JSON.stringify(result);
                }
                document.querySelector('[data-tab=settings]').click();
                await wait(() => document.querySelector('#target'));
                select('target','');
                await wait(() => document.querySelector('#explanation'));
                select('explanation','');
                await wait(() => document.querySelector('#target option:checked') && document.querySelector('#explanation option:checked'));
                result.placeholders = [document.querySelector('#target option:checked').textContent,document.querySelector('#explanation option:checked').textContent];
                return JSON.stringify(result);
                """, arguments: ["okurigana":ProcessInfo.processInfo.arguments.contains("--verify-japanese-okurigana"),"furigana":ProcessInfo.processInfo.arguments.contains("--verify-japanese-furigana"),"settings":ProcessInfo.processInfo.arguments.contains("--verify-shared-settings"),"dictation":ProcessInfo.processInfo.arguments.contains("--verify-dictation-design"),"offline":ProcessInfo.processInfo.arguments.contains("--verify-offline-packages"),"english":ProcessInfo.processInfo.arguments.contains("--verify-english-corrections"),"japanese":ProcessInfo.processInfo.arguments.contains("--verify-japanese-corrections")], in: nil, in: .page) { result in
                    switch result {
                    case .success(let value): print("NATIVE_PACKAGE_QA_RESULT \(value)")
                    case .failure(let error): print("NATIVE_PACKAGE_QA_ERROR \(error)")
                    }
                }
        }
    }
    #endif
}
