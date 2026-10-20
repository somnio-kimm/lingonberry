const labels={
 'Topic':'주제',
 'Editorial Dictionary — Review Pending':'편집 기준 사전 · 검수 진행 중','Bilingual Example Under Review':'영어·한국어 번역이 있는 예문을 준비 중입니다.','No Example Available':'예문이 없어요.',
 'Study Level':'학습 레벨','All':'전체','Word List':'단어 목록','Flashcards':'플래시카드','Word Input':'단어 입력','Meaning Quiz':'뜻 선택','Cloze':'빈칸 채우기','Sentence Scramble':'문장 완성','Dictation':'받아쓰기','Review':'복습','Settings':'설정','Study':'학습',
 'Search':'검색','Filters':'필터','Part of Speech':'품사','Study Status':'학습 상태','New':'새 단어','Learning':'학습 중','Mastered':'숙달','Shuffle':'섞기','Next':'다음','Submit':'제출','Skip':'건너뛰기','Examples':'예문','Close':'닫기','Speak Word':'단어 듣기','Speak Example':'예문 듣기',
 'Noun':'명사','Verb':'동사','Adjective':'형용사','Adverb':'부사','Pronoun':'대명사','Expression':'표현','Particle':'불변화사','Conjunction':'접속사','Number':'수사','Numeral':'수사','Interjection':'감탄사','Preposition':'전치사','Determiner':'한정사','Classifier':'단위 명사','Prefix':'접두사','Suffix':'접미사',
 'Show More Words':'더 보기','No Matching Words':'조건에 맞는 단어가 없어요.','Tap to Flip':'눌러서 뒤집기','Your Answer':'오답','Correct Answer':'정답','No Wrong Answers':'오답이 없어요.','No Mistakes Match These Filters':'조건에 맞는 오답이 없어요.','Retest':'재시험','Delete All':'전체 삭제','Are you sure you want to delete?':'정말로 삭제할까요?','Wrong Answers':'오답 횟수','Remove':'삭제',
 'Retest Complete':'재시험 완료','Correct':'정답','Wrong':'오답','Skipped':'건너뛰기','Word':'단어','Sentence':'문장','Show Translation':'뜻 보기','No Questions Match':'조건에 맞는 문제가 없어요.','Speech Unavailable':'기기의 음성을 사용할 수 없어요. 해당 언어의 음성을 기기 설정에서 다운로드해 주세요.','Storage Unavailable':'학습 기록을 저장하지 못했어요. 기기 저장 공간을 확인해 주세요.',
};
export const lexiconText=(locale,text)=>locale==='ko'?labels[text]||text:text;
