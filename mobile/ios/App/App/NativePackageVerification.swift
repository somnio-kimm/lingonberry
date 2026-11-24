#if DEBUG
import Foundation

/// Opt-in QA scripts and flags; excluded from the Release executable.
enum NativePackageVerification {
    static let triggerFlags: Set<String> = ["--update-installed-language-packages","--verify-language-packages","--verify-offline-packages","--verify-english-corrections","--verify-english-examples","--verify-japanese-korean-meanings","--verify-japanese-corrections","--verify-japanese-completion","--verify-dictation-design","--verify-shared-settings","--verify-japanese-furigana","--verify-japanese-okurigana","--verify-japanese-reading-target"]
    static func isRequested(_ flags: [String]) -> Bool {
        !triggerFlags.isDisjoint(with: flags)
    }
    static func arguments(for flags: [String]) -> [String: Any] {
        ["updateInstalled":flags.contains("--update-installed-language-packages"),"englishExamples":flags.contains("--verify-english-examples"),"japaneseKoreanMeanings":flags.contains("--verify-japanese-korean-meanings"),"readingTarget":flags.contains("--verify-japanese-reading-target"),"okurigana":flags.contains("--verify-japanese-okurigana"),"furigana":flags.contains("--verify-japanese-furigana"),"settings":flags.contains("--verify-shared-settings"),"dictation":flags.contains("--verify-dictation-design"),"offline":flags.contains("--verify-offline-packages"),"english":flags.contains("--verify-english-corrections"),"japanese":flags.contains("--verify-japanese-corrections") || flags.contains("--verify-japanese-completion"),"completion":flags.contains("--verify-japanese-completion")]
    }
    static let offlineScript = """
    const originalFetch = window.fetch;
    window.__lingonberryRestoreFetch = () => { window.fetch = originalFetch; delete window.__lingonberryRestoreFetch; };
    window.fetch = (input, options) => {
      const url = new URL(input.url || input, location.href);
      if (url.protocol === 'https:' || url.protocol === 'http:') return Promise.reject(new Error('Native offline test'));
      return originalFetch(input, options);
    };
    """
    static let progressCaptureScript = """
    window.__lingonberryLegacyProgress = Object.fromEntries(['en','ja'].map(language => {
      const raw = localStorage.getItem(`learn-language.${language}.lexicon.v1`);
      return [language, raw];
    }));
    """
    static let script = """
    const wait = async (predicate, timeout = 45000) => {
      const deadline = Date.now() + timeout;
      while (!predicate()) {
        if (!document.querySelector('#retry').hidden) throw new Error(document.querySelector('#status').textContent);
        if (Date.now() > deadline) throw new Error('Timed out waiting for native study view: '+JSON.stringify({stage:window.__lingonberryVerificationStage||'startup',waitingFor:String(predicate).slice(0,350),title:document.querySelector('#header-title')?.textContent,state:document.querySelector('main')?.dataset.viewState,setSize:document.querySelector('[data-set-size]')?.value,setTotal:document.querySelector('#flashcard-count')?.dataset.setTotal,sound:document.querySelector('#set-answer-sounds')?.getAttribute('aria-checked')}));
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    };
    const select = (id, value) => {
      const element = document.getElementById(id);element.value = value;
      element.dispatchEvent(new Event('change', {bubbles:true}));
    };
    if (!window.crypto?.subtle) throw new Error('Web Crypto is unavailable in the native WebView');
    // BEGIN INSTALLED_PACKAGE_UPDATE_CHECK
    if (updateInstalled) {
      const markUxStage=stage=>{window.__lingonberryVerificationStage=stage;console.log('NATIVE_UX_STAGE '+stage);};
      // BEGIN PROGRESS_MIGRATION_CHECK
      const progressMigration = [];
      const captured = window.__lingonberryLegacyProgress;
      if (captured) {
        const [{createLexiconStorage},{createLexiconStore},{studyProfiles}] = await Promise.all([import('./js/shared/lexicon-storage.js'),import('./js/shared/lexicon-store.js'),import('./js/presentation/study-profiles.js')]);
        const backend = createLexiconStorage();
        const canonical = value => JSON.stringify(value, (_, item) => item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.keys(item).sort().map(key => [key,item[key]])) : item);
        const digest = async value => [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(byte => byte.toString(16).padStart(2,'0')).join('');
        for (const language of ['en','ja']) {
          const legacy = captured[language] == null ? null : JSON.parse(captured[language]);
          const store = createLexiconStore(localStorage,studyProfiles[language],{progressStorage:backend});
          await store.ready();if (!await store.flush()) throw new Error('Progress migration did not finish: '+language);
          const state = await backend.load(language), current = canonical({wordStatus:state.wordStatus,wrongs:state.wrongs});
          const comparedLegacy = legacy?.version === 1;
          if (comparedLegacy && current !== canonical({wordStatus:legacy.wordStatus,wrongs:legacy.wrongs})) throw new Error('Legacy progress changed during migration: '+language);
          progressMigration.push({language,comparedLegacy,preserved:comparedLegacy?true:null,statuses:Object.keys(state.wordStatus).length,wrongs:Object.keys(state.wrongs).length,sha256:await digest(current)});
        }
        delete window.__lingonberryLegacyProgress;
      }
      // END PROGRESS_MIGRATION_CHECK
      const originalPreferences=localStorage.getItem('learn-language.preferences.v1'),originalSetSize=localStorage.getItem('learn-language.flashcards.setSize.v1');
      const original=JSON.parse(originalPreferences||'{}');
      const {AnswerSounds:originalSounds}=await import('./js/shared/answer-sounds.js'),originalSound=originalSounds.enabled;
      let verificationError;
      const {APP_VERSION}=await import('./js/shared/app-config.js');
      const {createPackageStorage}=await import('./js/packages/storage.js'),{installedPairs}=await import('./js/packages/library.js');
      const {isStudyLanguageAvailable}=await import('./js/shared/language-pairs.js');
      const storage=createPackageStorage(),initial=installedPairs(await storage.list()).filter(row=>isStudyLanguageAvailable(row.targetLanguage)),catalog=await fetch('./catalog.json').then(response=>response.json()),checks=[];
      const settingsPage=async()=>{document.querySelector('[data-tab=settings]').click();await wait(()=>document.querySelector('#target')&&document.querySelector('main').dataset.viewState==='ready');};
      const open=async(target,explanation)=>{await settingsPage();select('target',target);await wait(()=>document.querySelector(`#explanation option[value="${explanation}"]`));select('explanation',explanation);await wait(()=>document.querySelector('#package-status').dataset.state==='ready');};
      try {
        for(const before of initial){
          markUxStage(before.id+':package-check');const descriptor=catalog.find(row=>row.id===before.id);if(!descriptor)continue;
          await settingsPage();document.querySelector('#manage-packages').click();await wait(()=>document.querySelector(`[data-language="${before.targetLanguage}"]`));document.querySelector(`[data-language="${before.targetLanguage}"]`).click();await wait(()=>document.querySelector(`[data-explanation="${before.explanationLanguage}"]`));
          const button=document.querySelector(`[data-explanation="${before.explanationLanguage}"] .download-package`);
          if(button){button.click();await wait(()=>document.querySelector(`[data-package="${before.id}"]`)&&!document.querySelector(`[data-explanation="${before.explanationLanguage}"] .download-package`),300000);}
          const pair=await storage.get(before.id,descriptor.version),core=pair&&await storage.get(before.targetLanguage+'-core',pair.studyVersion);
          if(!pair||!core||pair.studyVersion!==descriptor.studyVersion)throw new Error('Installed pair did not reach its catalogue version: '+before.id);
          const check={id:before.id,from:before.version,to:pair.version,studyVersion:core.version,updated:before.version!==pair.version};
          if(before.targetLanguage==='en'){
            const meanings=new Map(pair.entries.map(row=>[row.id,row]));
            const {ENGLISH_LEVELS}=await import('./js/shared/english-levels.js');
              await open('en',before.explanationLanguage);document.querySelector('[data-tab=home]').click();await wait(()=>document.querySelector('[data-level]'));
              const savedLevel=document.querySelector('[data-level][aria-pressed=true]')?.dataset.level;check.groupedHeadwords=[];
              try{
                for(const level of [ENGLISH_LEVELS[1],ENGLISH_LEVELS[2]]){
                  document.querySelector('[data-tab=home]').click();await wait(()=>document.querySelector('[data-level]'));[...document.querySelectorAll('[data-level]')].find(node=>node.dataset.level===level).click();
                  document.querySelector('[data-route=wordlist]').click();await wait(()=>document.querySelector('#search-input'));
                  const search=document.querySelector('#search-input');search.value='appeal';search.dispatchEvent(new Event('input',{bubbles:true}));await wait(()=>document.querySelector('#wordlist-results')?.dataset.query==='appeal');
                  const expected=core.entries.filter(row=>row.word==='appeal'&&row.level===level),rows=[...document.querySelectorAll('#wordlist-results [data-word]')].filter(row=>row.querySelector('.lexicon-word')?.textContent==='appeal');
                  if(rows.length!==1||Number(rows[0].dataset.senseCount)!==expected.length)throw new Error('English headwords are not grouped within level');
                  if(document.querySelector('[data-tag="plural noun"],[data-tag="proper noun"]'))throw new Error('Noun categories were not simplified');
                  rows[0].querySelector('.wl-main').click();await wait(()=>document.querySelector('[role=dialog]'));
                  if(document.querySelectorAll('.study-example[data-sense-id]').length!==expected.length)throw new Error('Grouped word examples are missing');
                  for(const sense of expected){const node=[...document.querySelectorAll('.study-example[data-sense-id]')].find(node=>node.dataset.senseId===sense.id);if(node?.querySelector('.example-sentence')?.textContent!==sense.example.text)throw new Error('An example belongs to the wrong sense');}
                  document.querySelector('[data-close]').click();check.groupedHeadwords.push({word:'appeal',level,senses:expected.length});
                }
              }finally{document.querySelector('[data-tab=home]').click();await wait(()=>document.querySelector('[data-level]'));[...document.querySelectorAll('[data-level]')].find(node=>node.dataset.level===savedLevel)?.click();}
              check.words=core.entries.length;check.examples=core.entries.filter(row=>row.example?.text?.trim()).length;
            check.translations=core.entries.filter(row=>meanings.get(row.id)?.meaning?.trim()&&meanings.get(row.id)?.exampleTranslation?.trim()).length;
            check.reviewSnapshot=core.contentReview?.effectiveReviewSha256;check.perSenseLevels=core.contentReview?.perSenseLevels===true;
            check.rootGroups=core.morphemes?.length||0;
            if(!core.contentReview?.sourceAndSenseReviewComplete||!check.perSenseLevels||check.words!==check.examples||check.words!==check.translations)throw new Error('Reviewed English bilingual coverage is incomplete');
            if(core.morphemes?.some(row=>!row.examples.length))throw new Error('An English root has no active related words');
            if(core.contentReview.rootSuffixSupplement){
              await open('en',before.explanationLanguage);document.querySelector('[data-tab=home]').click();await wait(()=>document.querySelector('[data-route=roots]'));document.querySelector('[data-route=roots]').click();await wait(()=>document.querySelector('#root-search'));
              if(document.querySelector('[data-root-view],[data-answer-mode],[data-submit],.vocab-question'))throw new Error('Root Families still contains practice controls');
              if(document.querySelector('[data-root-list] details,[data-root-list] summary,[data-root-list] a'))throw new Error('Root Families still contains a word disclosure or source link');
              if(!document.querySelector('[data-root-entry]'))throw new Error('Root Families words are not visible');
              const {meaningDisplayLines}=await import('./js/shared/meaning-display.js');
              const search=document.querySelector('#root-search');check.suffixForms=[];check.newVerbs=[];
              for(const form of ['-ify','-ise','-ize','-tion','-sion','-ment']){
                const row=core.morphemes.find(row=>row.form===form);if(!row)throw new Error('Restored suffix is missing: '+form);
                search.value=form;search.dispatchEvent(new Event('input',{bubbles:true}));await wait(()=>document.querySelector(`[data-morpheme="${row.id}"]`));check.suffixForms.push(form);
              }
              for(const spelling of ['beautify','nationalise','privatise']){
                const entry=core.entries.find(row=>row.word===spelling),translation=entry&&meanings.get(entry.id);if(!entry||!translation)throw new Error('New verb is missing: '+spelling);
                search.value=spelling;search.dispatchEvent(new Event('input',{bubbles:true}));
                const selector=`[data-root-entry="${entry.id}"]`;
                for(let page=0;!document.querySelector(selector)&&page<5;page++){const more=[...document.querySelectorAll('[data-more-related]')].find(button=>!button.hidden);if(!more)break;more.click();}
                await wait(()=>document.querySelector(selector));document.querySelector(selector+' .wl-meaning').click();await wait(()=>document.querySelector('[role=dialog]'));
                if(document.querySelector('.study-sheet-meaning')?.innerText!==meaningDisplayLines(translation.meaning).join(String.fromCharCode(10))||!document.querySelector('.example-sentence')?.textContent.includes(entry.example.text))throw new Error('New verb detail differs: '+spelling);
                document.querySelector('[data-close]').click();await wait(()=>!document.querySelector('[role=dialog]'));check.newVerbs.push(spelling);
              }
              search.value='';search.dispatchEvent(new Event('input',{bubbles:true}));check.rootReferenceOnly=true;
              const [{assembleStudy},{studyWords,studyProfiles},{createLexiconQuestions},{chooseCombinedCloze},{renderLexiconSentence}]=await Promise.all([import('./js/packages/study.js'),import('./js/presentation/study-profiles.js'),import('./js/shared/lexicon-questions.js'),import('./js/shared/combined-cloze.js'),import('./js/shared/lexicon-sentence-view.js')]);
              const clozeStudy=assembleStudy(core,pair),clozeWords=studyWords(clozeStudy),cases=[clozeStudy.exercises.find(row=>row.id==='en-ex-collocations-homework'),clozeStudy.exercises.find(row=>row.route==='vocabinput'&&row.gapFill?.answers.length===2)];check.clozeChecks=[];
              for(const row of cases){
                if(!row)throw new Error('A Cloze verification source is missing');
                const question=chooseCombinedCloze({engine:createLexiconQuestions(studyProfiles.en),words:clozeWords,exercises:[row],locale:pair.explanationLanguage,answerMode:'input',random:()=>0});if(!question)throw new Error('Translated Cloze source is not eligible');
                const host=document.createElement('div');host.className='lexicon-view';host.setAttribute('aria-hidden','true');host.style.cssText='position:absolute;left:-10000px;top:0;width:300px';document.body.append(host);
                try{
                  renderLexiconSentence(host,{question,chosenTokens:[],showTranslation:true,t:key=>key},{language:'en',uiLanguage:pair.explanationLanguage,submit(){}});
                  const hint=host.querySelector('.sentence-translation')?.textContent,expected=pair.explanationLanguage==='en'?question.word.studyMeaning:question.context;
                  if(!expected||hint!==expected||pair.explanationLanguage==='ko'&&hint===question.word.studyMeaning)throw new Error('Cloze hint is not the requested meaning or sentence translation');
                  const metrics=[...host.querySelectorAll('[data-phrase-gap]')].map(input=>{
                    const field=input.closest('.phrase-gap-field'),marker=document.createElement('span');marker.style.cssText='display:inline-block;width:0;height:0;padding:0;margin:0;vertical-align:baseline';input.before(marker);
                    const rect=input.getBoundingClientRect(),style=getComputedStyle(input),font=parseFloat(style.fontSize),offset=rect.bottom-parseFloat(style.borderBottomWidth)-marker.getBoundingClientRect().top;
                    if(!field||field.getBoundingClientRect().height<44||rect.height>font*1.3||offset<0||offset>8)throw new Error('Cloze underline or tap geometry differs');
                    return {font,inputHeight:rect.height,tapHeight:field.getBoundingClientRect().height,underlineOffset:offset};
                  });
                  if(metrics.length!==question.gapFill.answers.length)throw new Error('Cloze blank count differs');check.clozeChecks.push({id:row.id,hint,metrics});
                }finally{host.remove();}
              }
            }
          }
          if(before.targetLanguage==='ja'&&['en','ko'].includes(before.explanationLanguage)){
            const id=core.entries.find(row=>row.word==='車')?.id,meaning=pair.entries.find(row=>row.id===id)?.meaning,expected=before.explanationLanguage==='ko'?'자동차':'car';
            if(meaning!==expected)throw new Error('Concise Japanese meaning is missing: '+before.id);
            check.words=core.entries.length;check.examples=core.entries.filter(row=>row.example?.text?.trim()).length;check.translations=pair.entries.filter(row=>row.exampleTranslation?.trim()).length;check.carMeaning=meaning;
            if(check.examples!==check.words||check.translations!==check.words)throw new Error('Japanese example coverage is incomplete');
          }
          if(['de','zh'].includes(before.targetLanguage)){
            await open(before.targetLanguage,before.explanationLanguage);document.querySelector('[data-tab=home]').click();await wait(()=>document.querySelector('[data-route=wordlist],[data-quiz=wordlist]'));
            if(document.querySelector('[data-route=collocations],[data-quiz=collocations]'))throw new Error('Retired Collocations route is visible');check.collocationsRetired=true;if(before.targetLanguage==='zh'){if(!document.querySelector('[data-quiz=pronunciation]')||document.querySelector('[data-quiz=pinyin],[data-quiz=tone]'))throw new Error('Chinese pronunciation menu is stale');check.pronunciationMerged=true;}
          }
          const [{assembleStudy:assembleChoices},{germanWords:germanChoiceWords,chineseWords:chineseChoiceWords},{studyWords:genericChoiceWords},{createVocabularyEngine},{readChoiceInitial,readChoiceOpening}]=await Promise.all([import('./js/packages/study.js'),import('./js/presentation/words.js'),import('./js/presentation/study-profiles.js'),import('./js/shared/vocabulary.js'),import('./js/shared/meaning-distractors.js')]);
          const choiceStudy=assembleChoices(core,pair),choiceWords=(before.targetLanguage==='de'?germanChoiceWords:before.targetLanguage==='zh'?chineseChoiceWords:genericChoiceWords)(choiceStudy),readChoiceLevel=word=>word.level??word.cefr??word.hskLevel,activeChoices=choiceWords.filter(word=>readChoiceLevel(word)===readChoiceLevel(choiceWords[0])),choicePool=createVocabularyEngine().createVocabularyPool('vocabmeaning',activeChoices,before.explanationLanguage,'vocabulary',{meaningWords:choiceWords});let choiceSeed=17,previousChoice;
          const drawChoiceRandom=()=>{choiceSeed=(Math.imul(choiceSeed,1664525)+1013904223)>>>0;return choiceSeed/2**32;};
          for(let sample=0;sample<20;sample++){
            const question=choicePool.choose(previousChoice,drawChoiceRandom);if(!question)throw new Error('Meaning Quiz has no valid question');previousChoice=question.id;const initials=new Map(),openings=new Map();
            for(const option of question.options){if(option.type!==question.type)throw new Error('Meaning Quiz mixes parts of speech');const initial=readChoiceInitial(option.text);initials.set(initial,(initials.get(initial)||0)+1);const opening=readChoiceOpening(option.text);openings.set(opening,(openings.get(opening)||0)+1);}
            for(const patterns of [initials,openings])if(question.options.length>=3&&patterns.size>1&&Math.max(...patterns.values())===question.options.length-1)throw new Error('Meaning Quiz has a visible answer outlier');
          }
          check.balancedMeaningQuestions=20;
          const [{withVocabularyLearning,vocabularyLearningContent},{renderVocabularyHints},{snapshotQuestion},{listeningReadingHint}]=await Promise.all([import('./js/shared/vocabulary-learning.js'),import('./js/shared/vocabulary-learning-view.js'),import('./js/shared/question-snapshot.js'),import('./js/shared/listening.js')]);
          const inputProbe=createVocabularyEngine().createVocabularyPool('vocabinput',activeChoices,before.explanationLanguage).choose(undefined,drawChoiceRandom);
          if(!inputProbe)throw new Error('Vocabulary learning probe has no eligible word');
          const learned=snapshotQuestion(withVocabularyLearning(inputProbe,{language:before.targetLanguage,locale:before.explanationLanguage})),learning=vocabularyLearningContent(learned,{language:before.targetLanguage,locale:before.explanationLanguage}),learningHost=document.createElement('div');
          learningHost.style.cssText='position:absolute;left:-10000px;top:0;width:300px';document.body.append(learningHost);
          try{
            learningHost.innerHTML=renderVocabularyHints(inputProbe,{language:before.targetLanguage,locale:before.explanationLanguage});
            const hintPanel=learningHost.querySelector('.study-hint');
            if(Boolean(hintPanel)!==Boolean(learning.hint)||hintPanel?.open||hintPanel?.querySelector('button'))throw new Error('Vocabulary hints must show a closed example only when available');
            if(!learning.example||learned.learningExample?.text!==learning.example.text||learned.word.examples||learned.word.sentences)throw new Error('Saved vocabulary learning example differs');
            check.vocabularyLearning={hintsClosed:true,savedExample:true};
          }finally{learningHost.remove();}
          const sourceReadings=core.entries.filter(row=>row.pronunciation).length,projectedReadings=choiceWords.filter(row=>row.pronunciation).length;
          if(sourceReadings!==projectedReadings)throw new Error('Word pronunciation projection differs');
          const readingWord=choiceWords.find(row=>row.pronunciation&&row.pronunciation!== (row.lemma||row.hanzi));
          check.pronunciationHints={sourceReadings,projectedReadings,supplied:readingWord?!!listeningReadingHint({kind:'word',word:readingWord,answer:readingWord.lemma||readingWord.hanzi}):false};

          const openStudyMode=async mode=>{
            document.querySelector('[data-tab=home]').click();const chineseMode=mode==='flashcards'?'flashcard':mode;
            await wait(()=>document.querySelector('[data-route="'+mode+'"],[data-quiz="'+chineseMode+'"]'));
            const grid=document.querySelector('.menu-grid,.quiz-grid');if(!grid||getComputedStyle(grid).gridTemplateColumns.split(' ').length!==2)throw new Error('Study menu is not two columns');
            document.querySelector('[data-route="'+mode+'"],[data-quiz="'+chineseMode+'"]').click();
          };
          markUxStage(before.id+':wordlist-open');await open(before.targetLanguage,before.explanationLanguage);await openStudyMode('wordlist');await wait(()=>document.querySelector('[data-word-initial]'));
          const indexSearch=document.querySelector('#search-input');if(indexSearch){indexSearch.value='';indexSearch.dispatchEvent(new Event('input',{bubbles:true}));await wait(()=>document.querySelector('#wordlist-results')?.dataset.query==='');}
          const initialControl=document.querySelector('[data-word-initial]');if(initialControl.dataset.selected!=='all')throw new Error('Word index did not reset on a new visit');
          const initialOption=[...initialControl.querySelectorAll('[data-initial-value]')].find(option=>option.dataset.initialValue!=='all'&&!option.disabled);
          if(initialOption){
            initialOption.click();
            const {readWordInitial}=await import('./js/shared/word-initial-index.js'),choiceById=new Map(choiceWords.map(word=>[word.id,word]));
            const visible=[...document.querySelectorAll('.wl-row')].map(node=>choiceById.get(node.dataset.word||node.dataset.id)).filter(Boolean);
            if(!visible.length||visible.some(word=>readWordInitial(word,before.targetLanguage)!==initialOption.dataset.initialValue))throw new Error('Word initial filter escaped its selected group');
            check.wordIndex={value:initialOption.dataset.initialValue,visible:visible.length};initialControl.querySelector('[data-initial-value=all]').click();
          }
          const {readFlashcardSetSize}=await import('./js/shared/flashcard-session.js'),savedSetSize=readFlashcardSetSize(),savedSetPreference=localStorage.getItem('learn-language.flashcards.setSize.v1');
          markUxStage(before.id+':flashcards-open');await openStudyMode('flashcards');await wait(()=>document.querySelector('[data-set-size]'));
          markUxStage(before.id+':flashcards-resize');const setSize=document.querySelector('[data-set-size]');setSize.value='10';setSize.dispatchEvent(new Event('change',{bubbles:true}));
          await wait(()=>document.querySelector('main').dataset.viewState==='ready'&&document.querySelector('[data-set-size]')?.value==='10'&&Number(document.querySelector('#flashcard-count')?.dataset.setTotal)<=10);
          if(!document.querySelector('.flashcard')){document.querySelector('[data-f=all]')?.click();await wait(()=>document.querySelector('main').dataset.viewState==='ready'&&(document.querySelector('.flashcard')||document.querySelector('.empty-wrong')));}
          const shownSet=Number(document.querySelector('#flashcard-count')?.dataset.setTotal),classify=[...document.querySelectorAll('.fc-classify button')];
          if(document.querySelector('.flashcard')){
            if(shownSet<1||shownSet>10||classify.length!==2||classify.some(button=>button.getBoundingClientRect().height<44))throw new Error('Flashcard set cap/actions differ');
            const expectedActions=before.explanationLanguage==='ko'?['학습 중','학습 완료']:['Learning','Mastered'];if(classify.some((button,index)=>button.textContent!==expectedActions[index]))throw new Error('Flashcard action language differs');
          }
          check.flashcardSet={selected:10,total:shownSet,actions:classify.length};markUxStage(before.id+':flashcards-restore');const restoreSet=document.querySelector('[data-set-size]');restoreSet.value=String(savedSetSize);restoreSet.dispatchEvent(new Event('change',{bubbles:true}));await wait(()=>document.querySelector('main').dataset.viewState==='ready'&&document.querySelector('[data-set-size]')?.value===String(savedSetSize));if(savedSetPreference===null)localStorage.removeItem('learn-language.flashcards.setSize.v1');else localStorage.setItem('learn-language.flashcards.setSize.v1',savedSetPreference);
          markUxStage(before.id+':scramble-tools');await openStudyMode('scramble');await wait(()=>document.querySelector('.sentence-question'));
          const resetButton=document.querySelector('.study-reset');if(!resetButton?.closest('.scramble-answer')||resetButton.getBoundingClientRect().height<44||document.querySelector('.sentence-reset-controls'))throw new Error('Scramble reset placement differs');
          const scrambleTranslation=document.querySelector('.scramble-question .sentence-translation');if(scrambleTranslation&&getComputedStyle(scrambleTranslation).fontSize!=='17px')throw new Error('Scramble translation is too small');
          check.scrambleTools={resetBesideAnswer:true,translationSize:scrambleTranslation?'17px':null};
          const [{findTranslationFocus},{renderTranslationTarget}]=await Promise.all([import('./js/shared/translation-focus.js'),import('./js/shared/translation-target-view.js')]);
          if(before.targetLanguage==='en'&&before.explanationLanguage==='en')check.translationTarget={definitionOnly:true};
          else{
            let matched;
            for(const word of choiceWords){for(const example of word.examples||word.sentences||[]){const text=example.studyTranslation;if(text&&findTranslationFocus({text,word,locale:before.explanationLanguage,studyLanguage:before.targetLanguage}).length){matched={word,text};break;}}if(matched)break;}
            if(!matched)throw new Error('No translation target available for native style check');
            const probe=document.createElement('p');probe.className='sentence-translation';probe.style.cssText='position:absolute;left:-10000px;top:0;width:300px';probe.innerHTML=renderTranslationTarget(matched.text,{word:matched.word,locale:before.explanationLanguage,studyLanguage:before.targetLanguage});document.body.append(probe);
            try{const target=probe.querySelector('.translation-target'),style=target&&getComputedStyle(target);if(probe.textContent!==matched.text||!style?.textDecorationLine.includes('underline')||parseFloat(style.textDecorationThickness)!==2)throw new Error('Translation target text/style differs');check.translationTarget={matched:true,underline:style.textDecorationLine};}finally{probe.remove();}
          }
          markUxStage(before.id+':sound-open');await settingsPage();const savedSound=document.querySelector('#set-answer-sounds')?.getAttribute('aria-checked');if(!['true','false'].includes(savedSound))throw new Error('Answer Sounds setting missing');
          markUxStage(before.id+':sound-toggle');document.querySelector('#set-answer-sounds').click();await wait(()=>document.querySelector('#set-answer-sounds')?.getAttribute('aria-checked')!==savedSound);const {AnswerSounds}=await import('./js/shared/answer-sounds.js');if(AnswerSounds.enabled!==(savedSound==='false'))throw new Error('Answer Sounds setting did not reach feedback service');
          markUxStage(before.id+':sound-restore');document.querySelector('#set-answer-sounds').click();await wait(()=>document.querySelector('#set-answer-sounds')?.getAttribute('aria-checked')===savedSound);check.answerSounds={settingRoundTrip:true,restored:savedSound==='true',webAudioAvailable:!!(window.AudioContext||window.webkitAudioContext)};

          checks.push(check);
        }
      } catch(error) {
        verificationError=error;throw error;
      } finally {
        try {
          await settingsPage();
          if(document.querySelector('#set-answer-sounds')?.getAttribute('aria-checked')!==String(originalSound)){
            document.querySelector('#set-answer-sounds')?.click();
            await wait(()=>document.querySelector('#set-answer-sounds')?.getAttribute('aria-checked')===String(originalSound));
          }
          if(original.target&&original.explanation)await open(original.target,original.explanation);
          if(original.target)document.querySelector('[data-tab=home]').click();
        } catch(cleanupError) {
          if(!verificationError)throw cleanupError;
          console.warn('NATIVE_UX_CLEANUP_ERROR '+cleanupError.message);
        } finally {
          originalSounds.setEnabled(originalSound);
          for(const [key,value]of [['learn-language.preferences.v1',originalPreferences],['learn-language.flashcards.setSize.v1',originalSetSize]]){
            if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value);
          }
        }
      }
      const {verbFormQuestions,verbFormCorrect}=await import('./languages/de/js/core/grammar-quizzes.js');
      const fixture={id:'native-qa-swim',lemma:'schwimmen',pos:'verb',auxiliary:'haben / sein',meaning_en:['swim'],meaning_ko:['수영하다'],forms:{perfekt:'hat geschwommen / ist geschwommen'}};
      const grammarWords=[fixture,{lemma:'haben',pos:'verb',forms:{praesens:{ich:'habe'},praeteritum:{ich:'hatte'}}},{lemma:'sein',pos:'verb',forms:{praesens:{ich:'bin'},praeteritum:{ich:'war'}}}];
      const grammarQuestions=verbFormQuestions([fixture],grammarWords),compoundChecks=[];
      for(const [tense,expected]of [['perfekt',['habe geschwommen','bin geschwommen']],['plusquamperfekt',['hatte geschwommen','war geschwommen']],['futur_ii',['werde geschwommen haben','werde geschwommen sein']]]){
        const question=grammarQuestions.find(row=>row.tense===tense&&row.person==='ich');
        if(!question||expected.some(answer=>!verbFormCorrect(question,answer))||verbFormCorrect(question,'bin hat geschwommen'))throw new Error('Mixed perfect auxiliary grading differs');
        compoundChecks.push({tense,accepted:question.acceptedAnswers});
      }
      const {germanWords}=await import('./js/presentation/words.js');
      const {vocabularyQuestions,vocabularyAnswerCorrect,snapshotVocabularyQuestion}=await import('./languages/de/js/core/vocabulary-tests.js'),aliasChecks=[],optionalArticleChecks=[];
      for(const locale of ['en','ko']){
        const word=germanWords({targetLanguage:'de',explanationLanguage:locale,entries:[{id:'native-qa-yoghurt',word:'Joghurt',aliases:['Jogurt'],article:'der',partOfSpeech:'noun',meaning:locale==='en'?'yoghurt':'요구르트'}]})[0];
        const question=vocabularyQuestions('vocabinput',[word],locale)[0];
        if(!vocabularyAnswerCorrect(question,'der Jogurt')||vocabularyAnswerCorrect(question,'Jogurt'))throw new Error('Declared spelling alias grading differs');
        aliasChecks.push({locale,accepted:question.acceptedAnswers});
        const name={id:'native-qa-language',lemma:'Deutsch',pos:'noun',article:'das',article_optional:true,declension:{nom:['Deutsch / das Deutsche',null]},meaning_en:['German (language)'],meaning_ko:['독일어']};
        const optional=vocabularyQuestions('vocabinput',[name],locale)[0],saved=snapshotVocabularyQuestion(optional);
        if(optional.answer!=='Deutsch'||!saved.word.article_optional||!vocabularyAnswerCorrect(saved,'Deutsch')||!vocabularyAnswerCorrect(saved,'das Deutsche')||vocabularyAnswerCorrect(saved,'die Deutsch'))throw new Error('Optional article grading or snapshot differs');
        optionalArticleChecks.push({locale,accepted:saved.acceptedAnswers});
      }
      const reflexive={id:'native-qa-recover',lemma:'erholen',pos:'verb',reflexive_case:'accusative',infinitive:'sich erholen',meaning_en:['recover'],meaning_ko:['회복하다'],forms:{perfekt:'hat sich erholt'}},reflexiveChecks=[];
      const reflexiveQuestions=verbFormQuestions([reflexive],grammarWords);
      for(const [tense,answer]of [['perfekt','habe mich erholt'],['plusquamperfekt','hatte mich erholt'],['futur_i','werde mich erholen'],['futur_ii','werde mich erholt haben']]){
        const question=reflexiveQuestions.find(row=>row.tense===tense&&row.person==='ich');
        if(!question||!verbFormCorrect(question,answer)||verbFormCorrect(question,answer.replace('mich','sich')))throw new Error('Reflexive person grading differs');
        reflexiveChecks.push({tense,accepted:question.acceptedAnswers});
      }
      const {clozeQuestions,clozeOptions}=await import('./languages/de/js/core/sentence-quizzes.js');
      const focusText='Gut zu wissen: Das ist eine gute Idee.',focusStart=focusText.indexOf('gute');
      const focusQuestion=clozeQuestions([{id:'native-qa-focus',lemma:'gut',pos:'adjective',examples:[{de:focusText,focus:{start:focusStart,text:'gute'}}]}])[0];
      if(focusQuestion?.start!==focusStart||focusQuestion.answer!=='gute')throw new Error('Explicit German Cloze focus differs');
      const focusChoices=clozeOptions(focusQuestion,[focusQuestion.word,{id:'native-qa-modern',lemma:'modern',pos:'adjective'}]).map(option=>option.text);
      if(!focusChoices.includes('moderne')||focusChoices.includes('modern'))throw new Error('Inflected German Cloze distractor differs');
      const {wordHeading}=await import('./languages/de/js/core/words.js');
      const pluralWord=germanWords({targetLanguage:'de',explanationLanguage:'en',entries:[{id:'native-qa-plural',word:'Ferien',article:'die',partOfSpeech:'noun',meaning:'holidays',grammar:{gender:null,genders:[],number_restriction:'plural'}}]})[0];
      const pluralSaved=snapshotVocabularyQuestion(vocabularyQuestions('vocabinput',[pluralWord],'en')[0]).word;
      if(pluralWord.gender!==null||pluralSaved.gender!==null||pluralSaved.number_restriction!=='plural'||!wordHeading(pluralSaved).includes('noun-article plural'))throw new Error('Plural-only gender classification differs');
      markUxStage('progress-idle');await wait(()=>['en','ja'].every(language=>{const raw=localStorage.getItem('learn-language.'+language+'.lexicon.v1.pending');if(!raw)return true;const pending=JSON.parse(raw);return !pending.base&&!Object.keys(pending.statuses||{}).length&&!Object.keys(pending.wrongs||{}).length;}));
      return JSON.stringify({passed:true,webVersion:APP_VERSION,progressMigration,checks,compoundChecks,aliasChecks,reflexiveChecks,optionalArticleChecks,focusCheck:{start:focusQuestion.start,answer:focusQuestion.answer,choices:focusChoices},pluralGenderCheck:{gender:pluralSaved.gender,number:pluralSaved.number_restriction},restored:original.target||null});
    }
    // END INSTALLED_PACKAGE_UPDATE_CHECK
    if (japaneseKoreanMeanings) {
      const original=localStorage.getItem('learn-language.preferences.v1');
      const {createPackageStorage}=await import('./js/packages/storage.js'),{assembleStudy}=await import('./js/packages/study.js'),{studyWords}=await import('./js/presentation/study-profiles.js'),{selectWordExample}=await import('./js/shared/word-example.js');
      const storage=createPackageStorage(),catalog=await fetch('./catalog.json').then(response=>response.json()),descriptor=id=>catalog.find(row=>row.id===id),core=await storage.get('ja-core',descriptor('ja-core').version),pair=await storage.get('ja-ko',descriptor('ja-ko').version);
      if(!core||!pair||pair.studyVersion!==core.version||pair.meaningPolicy!=='natural-concise-korean-equivalents'||!pair.meaningReview?.completeDecisionCoverage)throw new Error('Installed natural Korean explanation update is missing');
      const words=studyWords(assembleStudy(core,pair)),checks=[];
      for(const word of words){const shown=selectWordExample(word,'ja');if(!shown?.text?.trim()||!shown.studyTranslation?.trim())throw new Error('Japanese example or Korean translation is missing: '+word.id);}
      for(const [spelling,reading,expected]of [['明日','みょうにち','내일'],['作','さく','작품'],['女優','じょゆう','여배우'],['幅','はば','너비; 폭'],['祖父','そふ','할아버지'],['空欄','くうらん','빈칸'],['鼻汁','はなじる','콧물']]){
        const word=words.find(row=>row.lemma===spelling&&row.pronunciation===reading);if(word?.studyMeaning!==expected)throw new Error('Corrected Korean meaning is missing: '+spelling);checks.push({word:spelling,meaning:word.studyMeaning});
      }
      if(localStorage.getItem('learn-language.preferences.v1')!==original)throw new Error('Read-only meaning check changed preferences');
      return JSON.stringify({passed:true,version:pair.version,words:words.length,examples:words.length,corrections:pair.meaningReview.changed,checks,preferencesUnchanged:true});
    }
    if (englishExamples) {
      const {createPackageStorage}=await import('./js/packages/storage.js'),{assembleStudy}=await import('./js/packages/study.js'),{studyWords}=await import('./js/presentation/study-profiles.js'),{selectWordExample}=await import('./js/shared/word-example.js');
      const storage=createPackageStorage(),catalog=await fetch('./catalog.json').then(response=>response.json()),descriptor=id=>catalog.find(row=>row.id===id),checks=[];
      let independentlyReviewed=0;
      for(const locale of ['en','ko']){
        const pair=await storage.get('en-'+locale,descriptor('en-'+locale).version),core=pair&&await storage.get('en-core',pair.studyVersion);
        if(!core?.contentReview?.completionReview?.fullCoverage)throw new Error('Installed English completion proof is missing');
        const words=studyWords(assembleStudy(core,pair)),withExamples=words.filter(word=>word.examples.length);
        if(words.length-withExamples.length!==core.contentReview.examplesPending)throw new Error('English primary example count differs from the catalogue');
        independentlyReviewed=core.contentReview.completionReview.independentlyReviewed;
        for(const word of withExamples){const shown=selectWordExample(word,'en');if(!shown?.text?.trim()||(locale==='ko'&&!shown.studyTranslation?.trim())||(locale==='en'&&shown.studyTranslation))throw new Error('English dictionary example display is incomplete: '+word.id);}
        checks.push({locale,entries:words.length,examples:withExamples.length,version:core.version});
      }
      return JSON.stringify({passed:true,checks,independentlyReviewed,preferencesUnchanged:true});
    }
    if (okurigana || readingTarget) {
      const {renderExerciseReview}=await import('./js/shared/exercise-review-view.js'),{createExerciseQuestions}=await import('./js/shared/language-exercises.js'),{lexiconText}=await import('./js/shared/lexicon-text.js');
      const checkReview=(row,word,display,explanation,words)=>{
        const question=createExerciseQuestions([row],words,row.route,row.category,explanation,()=>.3)[0],input=question.options?question.options.find(option=>option.id!==question.correctOption).id:'久い',record={question,input},before=JSON.stringify(record),host=document.createElement('div');
        host.className='lexicon-view';host.style.cssText='position:absolute;left:-10000px;top:0;width:300px';host.innerHTML='<section class="panel wrong-card"><div class="review-answer-details">'+renderExerciseReview(record,{word,headword:word.lemma,language:'ja',displayLanguage:display,t:value=>lexiconText(display,value)})+'</div></section>';document.body.append(host);
        try{
          const wrong=host.querySelector('.wrong-answer-value--wrong'),expected=question.options?question.options.find(option=>option.id===input).text:input;
          if(!wrong||wrong.textContent!==expected||getComputedStyle(wrong).fontSize!=='16px'||host.querySelector('.vocab-instruction,.vocab-prompt,.wrong-correct-line,.exercise-explanation p'))throw new Error('Specialist Review differs from compact baseline');
          if(host.querySelector('.reading-segments'))throw new Error('Review repeats the reading breakdown');
          if(JSON.stringify(record)!==before)throw new Error('Review rewrote its original snapshot');
          return {wrong:expected,font:getComputedStyle(wrong).fontSize,segments:0,snapshotPreserved:true};
        }finally{host.remove();}
      };
      const {createPackageStorage}=await import('./js/packages/storage.js'),{installedPairs}=await import('./js/packages/library.js'),{assembleStudy}=await import('./js/packages/study.js'),{studyWords}=await import('./js/presentation/study-profiles.js'),{prepareLanguageExercises}=await import('./js/shared/exercise-pools.js'),{exerciseAnswerCorrect,exerciseLabel,exerciseModes}=await import('./js/shared/language-exercises.js'),{renderExercisePrompt}=await import('./js/shared/exercise-view.js');
      const storage=createPackageStorage(),pairs=installedPairs(await storage.list()).filter(row=>row.targetLanguage==='ja'&&['en','ko'].includes(row.explanationLanguage)),checks=[];
      if(!pairs.length)throw new Error('A Japanese explanation package must be installed');
      for(const pair of pairs) {
        const study=assembleStudy(await storage.get('ja-core',pair.studyVersion),await storage.get(pair.id,pair.version)),words=studyWords(study),word=words.find(row=>row.lemma==='久しい'),rows=prepareLanguageExercises(study,words);
        if(readingTarget) {
          if(exerciseModes('ja').onyomi||exerciseModes('ja').kunyomi||rows.some(row=>['onyomi','kunyomi'].includes(row.category)))throw new Error('Removed character-reading sections are active');
          const school=words.find(row=>row.lemma==='学校'),question=rows.find(row=>row.entryId===school?.id&&row.category==='reading'&&row.route==='vocabmeaning');
          if(!question||question.answer!=='がっこう'||question.prompt.split('学校').length!==2||question.prompt.startsWith('学校'+String.fromCharCode(10)))throw new Error('Reading target repeats the headword');
          const byId=new Map(words.map(row=>[row.id,row])),reviewedSource=study.exercises.find(row=>row.category==='reading'&&row.route==='vocabinput'&&row.readingFocus?.start>0&&row.readingFocus.text===byId.get(row.entryId)?.lemma),reviewedWord=byId.get(reviewedSource?.entryId),reviewedQuestion=rows.find(row=>row.id===reviewedSource?.id);
          if(!reviewedQuestion||reviewedQuestion.prompt!==reviewedSource.prompt||reviewedQuestion.readingFocus?.start!==reviewedSource.readingFocus.start||reviewedQuestion.readingFocus?.text!==reviewedSource.readingFocus.text)throw new Error('Reviewed reading span lost its sentence');
          const {createReadingChoiceSampler}=await import('./js/shared/reading-choices.js'),{normaliseKana}=await import('./js/shared/japanese-reading.js');
          const allowed=new Set(rows.filter(row=>row.category==='reading'&&row.route==='vocabinput'&&byId.get(row.entryId)?.pos===school.pos).map(row=>normaliseKana(row.answer))),sample=createReadingChoiceSampler(rows,words),samples=[sample(question,()=>0),sample(question,()=>.5)];
          if(allowed.size<=128||samples.some(row=>!row||row.options.length!==4||new Set(row.options.map(normaliseKana)).size!==4||row.options.some(value=>!allowed.has(normaliseKana(value)))))throw new Error('Reading choices do not use the full verified same-POS pool');
          if(samples[0].options.slice().sort().join('|')===samples[1].options.slice().sort().join('|'))throw new Error('Reading distractors are fixed');
          let matchedEndings=0;
          for(const row of rows.filter(row=>row.category==='reading'&&row.route==='vocabmeaning')){
            const written=row.readingFocus?.text||byId.get(row.entryId)?.lemma||'';
            const ending=/[ぁ-ゖー]+$/u.exec(written)?.[0];
            if(!ending||!/\\p{Script=Han}/u.test(written))continue;
            if(row.options.length<3||row.options.some(reading=>!reading.endsWith(ending)||reading.length<=ending.length))throw new Error('Wrong hiragana ending on '+written);
            matchedEndings++;
          }
          if(!matchedEndings)throw new Error('Mixed Japanese Word Reading choices were not checked');

          if(exerciseLabel('reading','ko')!=='한자 읽기'||exerciseLabel('okurigana','ko')!=='오쿠리가나')throw new Error('Korean reading labels differ');
          for(const display of ['en','ko']) {
            const host=document.createElement('div');host.className='lexicon-view';host.style.cssText='position:absolute;left:-10000px;top:0;width:300px';host.innerHTML=renderExercisePrompt({...question,word:school},{uiLanguage:display});document.body.append(host);
            try {
              const target=host.querySelector('.study-reading-target'),instruction=host.querySelector('.vocab-instruction'),text=host.querySelector('.vocab-prompt').textContent,style=target&&getComputedStyle(target);
              if(target?.textContent!=='学校'||text.split('学校').length!==2||instruction||!style.textDecorationLine.includes('underline')||host.querySelector('rt'))throw new Error('Reading target UI/locale differs');
              const clue=host.querySelector('.exercise-context')?.textContent;
              if(!clue||clue!==question.context||clue===school.studyMeaning)throw new Error('Reading sentence translation is missing');
              const spanHost=document.createElement('div');spanHost.innerHTML=renderExercisePrompt({...reviewedQuestion,word:reviewedWord},{uiLanguage:display});
              const spanTarget=spanHost.querySelector('.study-reading-target')?.textContent,spanPrompt=spanHost.querySelector('.vocab-prompt')?.textContent,spanTranslation=spanHost.querySelector('.exercise-context')?.textContent;
              if(spanTarget!==reviewedWord.lemma||spanPrompt!==reviewedSource.prompt||spanTranslation!==reviewedQuestion.context||spanHost.querySelector('.vocab-instruction'))throw new Error('Reviewed span UI lost its sentence or translation');
              checks.push({explanation:pair.explanationLanguage,display,prompt:text,target:target.textContent,translation:clue,reviewedSpan:{target:spanTarget,prompt:spanPrompt,translation:spanTranslation},sections:Object.keys(exerciseModes('ja')),samePosReadings:allowed.size,matchedEndings,distractorSamples:samples.map(row=>row.options),review:checkReview(question,school,display,pair.explanationLanguage,words)});
            }finally{host.remove();}
          }
          continue;
        }
        const typed=rows.find(row=>row.entryId===word?.id&&row.category==='okurigana'&&row.route==='vocabinput'),choice=rows.find(row=>row.entryId===word?.id&&row.category==='okurigana'&&row.route==='vocabmeaning');
        if(typed?.prompt!=='ひさしい'||typed.answer!=='久しい'||!exerciseAnswerCorrect(typed,'久しい')||exerciseAnswerCorrect(typed,'ひさしい')||exerciseAnswerCorrect(typed,'久い')||!choice?.options.includes('久い')||choice.options.length<3||choice.options.some(value=>!value.startsWith('久')))throw new Error('Incorrect kana-to-complete-word Okurigana exercise');
        for(const display of ['en','ko'])for(const row of [typed,choice]){
          const host=document.createElement('div');host.innerHTML=renderExercisePrompt({...row,exercise:true,word,locale:pair.explanationLanguage},{uiLanguage:display});
          const instruction=host.querySelector('.vocab-instruction'),prompt=host.querySelector('.vocab-prompt')?.textContent,meaning=host.querySelector('.exercise-context')?.textContent;
          if(instruction||prompt!=='ひさしい'||host.querySelector('rt')||meaning!==word.studyMeaning)throw new Error('Display-language instruction or explanation-language meaning differs');
          checks.push({explanation:pair.explanationLanguage,display,mode:row.options?'choice':'input',prompt,meaning,review:checkReview(row,word,display,pair.explanationLanguage,words)});
        }
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
      const values=()=>({theme:document.documentElement.dataset.theme,hapticEnabled:document.querySelector('#set-haptic').getAttribute('aria-checked')==='true',autoRemoveResolvedWrongs:document.querySelector('#set-hide-resolved').getAttribute('aria-checked')==='true'});
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
    const {meaningDisplayLines}=await import('./js/shared/meaning-display.js');
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
        const found = () => meaningDisplayLines(meaning).every(gloss=>document.querySelector(`.wl-row[data-word="${entryId}"] .wl-meaning`)?.innerText.includes(gloss));
        for (const level of [...document.querySelectorAll('[data-level-filter] option')].map(option => option.value)) {
          if (found()) break;
          const filter = document.querySelector('[data-level-filter]');filter.value = level;
          filter.dispatchEvent(new Event('change', {bubbles:true}));
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        await wait(found);
      } else await wait(() => document.querySelector(`.wl-row[data-id="${entryId}"] .wl-meaning`)?.innerText===meaningDisplayLines(meaning).join(String.fromCharCode(10)));
      pairs.push(target + '-' + explanation);
    }
    const result = {passed:true,pairs,origin:location.origin,wordCount:document.querySelectorAll('.wl-row').length,locale:document.documentElement.lang};
    if (completion) {
      const {createPackageStorage}=await import('./js/packages/storage.js'),storage=createPackageStorage(),catalog=await fetch('./catalog.json').then(response=>response.json());
      const descriptor=id=>catalog.find(row=>row.id===id),core=await storage.get('ja-core',descriptor('ja-core').version);
      if(!core?.contentReview?.completionReview?.fullCoverage)throw new Error('Installed Japanese completion proof is missing');
      const count=core.entries.length,native=core.entries.filter(row=>row.example?.text?.trim()).length,translations={};
      if(count!==core.contentReview.entries||native!==count)throw new Error('Japanese primary example coverage is incomplete');
      for(const locale of ['en','ko']){
        const pair=await storage.get('ja-'+locale,descriptor('ja-'+locale).version);
        if(pair?.studyVersion!==core.version||pair.entries.length!==count)throw new Error('Japanese completion explanation is incompatible');
        translations[locale]=pair.entries.filter(row=>row.meaning?.trim()&&row.exampleTranslation?.trim()).length;
        if(translations[locale]!==count)throw new Error('Japanese completion translations are missing');
      }
      result.japaneseExampleCoverage={version:core.version,words:count,examples:native,translations,independentlyReviewed:core.contentReview.completionReview.independentlyReviewed,nativeSpeakerReview:core.contentReview.nativeSpeakerReview};
    }
    if (english || japanese) {
      document.querySelector('[data-tab=home]').click();
      await wait(() => document.querySelector('[data-route=vocabinput]'));
      const routes = japanese ? ['reading','okurigana'] : ['roots','collocations'];
      result.exerciseRoutes = routes.every(route => document.querySelector(`[data-route=${route}]`));
      if (!result.exerciseRoutes) throw new Error('Installed language exercise routes are missing');
      if (japanese && document.querySelector('[data-route=collocations],[data-route=transitivity],[data-route=forms],[data-route=particles],[data-route=counters],[data-route=kanji],[data-route=onyomi],[data-route=kunyomi]')) throw new Error('Removed Japanese test is still visible');
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
        await wait(() => document.querySelector('#root-search'));
        if(document.querySelector('[data-root-view]'))throw new Error('Retired root practice tab is visible');
        await wait(() => document.querySelector('[data-root-kind]'));
        result.rootInventoryTotal=Number(document.querySelector('[data-root-list]')?.dataset.total);
        const {createPackageStorage} = await import('./js/packages/storage.js');
        const storage = createPackageStorage(), records = await storage.list();
        const {installedPairs} = await import('./js/packages/library.js');
        const activePair = installedPairs(records).find(row => row.id === 'en-ko');
        const core = records.find(row => row.id === 'en-core' && row.version === activePair?.studyVersion);
        result.englishPackages = records.filter(row => row.targetLanguage === 'en').map(row => ({id:row.id,version:row.version}));
        const installed = core && await storage.get(core.id,core.version);
        const normalise = value => value.normalize('NFKC').trim().toLowerCase();
        const spellings = new Set((installed?.entries||[]).flatMap(entry=>[entry.word,...(entry.aliases||[])]).map(normalise));
        result.installedRootCount = installed?.morphemes?.filter(row=>row.examples.some(example=>spellings.has(normalise(example)))).length || 0;
        if (result.rootInventoryTotal !== result.installedRootCount || !result.rootInventoryTotal) throw new Error('Visible root families do not match the installed Word List');
        const rootSearch=document.querySelector('#root-search');rootSearch.value='aud';rootSearch.dispatchEvent(new Event('input',{bubbles:true}));
        result.rootMembers = document.querySelectorAll('[data-root-word]').length;
        if (result.rootMembers < 3 || !document.querySelector('.root-origin')) throw new Error('Learner root families are missing');
        if (installed.contentReview?.commonCoverage) {
          result.commonCoverage = installed.contentReview.commonCoverage;
          result.commonWords = [];
          const pair = await storage.get(activePair.id,activePair.version), meanings = new Map(pair.entries.map(row=>[row.id,row.meaning]));
          for (const spelling of ['the','and','email','trousers','Monday','March','May','parent','spin']) {
            const entry = installed.entries.find(row=>row.word===spelling && row.level==='IELTS 1.0–3.5');
            if (!entry) throw new Error('Missing basic dictionary entry: '+spelling);
            document.querySelector('[data-tab=home]').click();
            await wait(()=>document.querySelector('[data-level]'));
            document.querySelector(`[data-level="${entry.level}"]`).click();
            document.querySelector('[data-route=wordlist]').click();
            await wait(()=>document.querySelector('#search-input'));
            const input=document.querySelector('#search-input');input.value=spelling;input.dispatchEvent(new Event('input',{bubbles:true}));
            await wait(()=>document.querySelector(`.wl-row[data-word="${entry.id}"] .wl-meaning`)?.innerText===meaningDisplayLines(meanings.get(entry.id)).join(String.fromCharCode(10)));
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
        await wait(() => document.querySelector('#root-search'));
        if(document.querySelector('[data-root-view]'))throw new Error('Retired root practice tab is visible');
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
    """
}
#endif
