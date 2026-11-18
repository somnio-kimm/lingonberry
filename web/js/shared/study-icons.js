const shapes={
 reset:'<path d="M4 4v6h6"/><path d="M5 9a8 8 0 1 1 1 9"/>',
 home:'<path d="M4 4h6a3 3 0 0 1 3 3v14a4 4 0 0 0-3-2H4z"/><path d="M13 7a3 3 0 0 1 3-3h4v15h-4a4 4 0 0 0-3 2"/>',
 wrong:'<path d="M4 6v5h5"/><path d="M5 10a8 8 0 1 1 1 8"/><path d="m9 13 2 2 4-5"/>',
 settings:'<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/>',
 wordlist:'<path d="M7 5h13M7 12h13M7 19h13"/><path d="M3 5h.01M3 12h.01M3 19h.01"/>',
 flashcards:'<rect x="6" y="5" width="14" height="16" rx="2"/><path d="M16 2H5a2 2 0 0 0-2 2v13M10 10h6M10 14h4"/>',
 vocabmeaning:'<circle cx="12" cy="12" r="8"/><path d="m8 12 3 3 5-6"/>',
 vocabinput:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 9h.01M11 9h.01M15 9h.01M18 9h.01M7 13h.01M11 13h.01M15 13h.01M8 16h8"/>',
 cloze:'<path d="M3 6h18M3 12h5m8 0h5M3 18h18M10 14h4"/>',
 scramble:'<path d="M3 7h3c5 0 7 10 12 10h3m-4-3 4 3-4 3M3 17h3c2 0 4-2 6-5s4-5 6-5h3m-4-3 4 3-4 3"/>',
 listening:'<path d="M4 14v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="12" width="4" height="8" rx="2"/><rect x="17" y="12" width="4" height="8" rx="2"/>',
 roots:'<circle cx="12" cy="5" r="2"/><path d="M12 7v5M5 17v-5h14v5"/><circle cx="5" cy="19" r="2"/><circle cx="12" cy="19" r="2"/><circle cx="19" cy="19" r="2"/><path d="M12 12v5"/>',
 forms:'<path d="m14 4 6 6-9 9-7 1 1-7zM12 6l6 6"/>',
 pronunciation:'<path d="M4 10v4m4-7v10m4-13v16m4-13v10m4-7v4"/>',
};
export function renderStudyIcon(name){const key=name==='flashcard'?'flashcards':['articles','verbforms','cases','adjendings','forms','okurigana'].includes(name)?'forms':['reading','pinyin','tone'].includes(name)?'pronunciation':name;return `<svg class="study-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${shapes[key]||shapes.forms}</svg>`;}
