import {createListeningEngine} from '../../../../js/shared/listening.js';
import {vocabularyWord} from './vocabulary-tests.js';
export {LISTENING_MODES} from '../../../../js/shared/listening.js';
const article=word=>word.pos==='noun'&&word.article?word.article+' ':'';
export const {listeningQuestions,normalizeListeningAnswer,listeningAnswerCorrect,validListeningQuestion,snapshotListeningQuestion}=createListeningEngine({
 language:'de-DE',spokenWord:word=>article(word)+vocabularyWord(word),
 wordAnswers:(_words,word)=>{const spellings=[vocabularyWord(word),...(word.listeningAliases||[])],prefix=article(word);return [...new Set(spellings.flatMap(spelling=>[spelling,...(prefix?[prefix+spelling,prefix[0].toUpperCase()+prefix.slice(1)+spelling]:[])]))];},
 normalize:(text,question)=>text.replace(question.kind==='sentence'?/\p{P}/gu:/$^/gu,'').replace(/\s+/gu,' '),
});
