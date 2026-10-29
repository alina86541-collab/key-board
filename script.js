const STORAGE_KEY = 'keyboardTrainer_v2';

const LANG_LABELS = { en: 'English', ru: 'Русский' };
const DIFF_LABELS = { easy: 'Лёгкий', medium: 'Средний', hard: 'Сложный' };
const TIME_LABELS = { 30: '30 сек', 120: '2 мин' };

const WORDS = {
  en: {
    easy: ['cat','dog','sun','red','big','run','sit','cup','bed','car','map','pen','key','code','web','app','fan','box','hot','cut','top','sea','sky','moon','star','tree','fish','bird','hand','leg'],
    medium: ['keyboard','screen','window','browser','display','mouse','laptop','tablet','phone','chair','table','plant','clock','mirror','bottle','paper','pencil','network','server','router','monitor','printer','camera','folder','graphic','music','video','player','system','memory'],
    hard: ['authentication','configuration','asynchronous','implementation','optimization','architecture','infrastructure','cryptocurrency','cybersecurity','blockchain','microservice','containerization','orchestration','decentralization','internationalization','compression','serialization','deserialization','virtualization','authorization','encryption','deployment','kubernetes','docker','repository','frontend','backend','middleware','dependency','scalability']
  },
  ru: {
    easy: ['дом','кот','солнце','красный','большой','бежать','сидеть','чашка','кровать','машина','карта','ручка','ключ','код','веб','вент','коробка','горячий','лес','море','небо','луна','звезда','дерево','рыба','птица','рука','нога','глаз'],
    medium: ['клавиатура','экран','окно','браузер','дисплей','мышь','ноутбук','планшет','телефон','стул','стол','растение','часы','зеркало','бутылка','бумага','карандаш','сеть','сервер','роутер','монитор','принтер','камера','папка','графика','музыка','видео','плеер','система','память'],
    hard: ['аутентификация','конфигурация','асинхронность','реализация','оптимизация','архитектура','инфраструктура','шифрование','криптовалюта','кибербезопасность','блокчейн','микросервис','контейнеризация','оркестрация','децентрализация','интернационализация','сжатие','сериализация','десериализация','виртуализация','развёртывание','репозиторий','фронтенд','бэкенд','middleware','зависимость','масштабируемость']
  }
};

const KB_LAYOUTS = {
  en: [
    ['1','2','3','4','5','6','7','8','9','0','-','=','Backspace'],
    ['Tab','q','w','e','r','t','y','u','i','o','p','[',']','\\','Enter'],
    ['CapsLock','a','s','d','f','g','h','j','k','l',';',"'"],
    ['Shift','z','x','c','v','b','n','m',',','.','/','Shift'],
    [' ']
  ],
  ru: [
    ['1','2','3','4','5','6','7','8','9','0','-','=','Backspace'],
    ['Tab','й','ц','у','к','е','н','г','ш','щ','з','х','ъ','Enter'],
    ['CapsLock','ф','ы','в','а','п','р','о','л','д','ж','э'],
    ['Shift','я','ч','с','м','и','т','ь','б','ю','.',':','Shift'],
    [' ']
  ]
};

const KB_SPECIAL = {
  'Backspace':{label:'⌫ Назад',wide:true},
  'Tab':{label:'Tab',wide:true},
  'CapsLock':{label:'CapsLock',wide:true},
  'Enter':{label:'Ввод',wide:true},
  'Shift':{label:'Shift',wide:true},
  ' ':{label:'Пробел',wide:true,big:true}
};

let state = { language:'en', difficulty:'easy', timeLimit:30, trainings:[], logins:[], dailyStats:{}, showKeyboard:true };

let current = {
  active:false, words:[], wordIndex:0, caret:0, prevWord:'',
  correct:0, errors:0, charsTyped:0, blockHistory:[],
  startedAt:0, endsAt:0, timerId:null
};

function $(id){ return document.getElementById(id); }

function save(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

function load(){
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw){ try { state = Object.assign({}, state, JSON.parse(raw)); } catch(e) {} }
}

function today(){
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function todayAt(d){
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function recordLogin(){
  const t = today();
  if (!state.logins.includes(t)) state.logins.push(t);
  save();
}

function getStreak(){
  const set = new Set(state.logins);
  let s = 0;
  const d = new Date();
  while (true){
    const ds = todayAt(d);
    if (set.has(ds)){ s++; const nd = new Date(d); nd.setDate(nd.getDate() - 1); d.setTime(nd.getTime()); } else break;
  }
  return s;
}

function getSkippedDays(){
  if (!state.trainings.length) return 0;
  const first = new Date(Math.min.apply(null, state.trainings.map(t => new Date(t.date))));
  const end = new Date(today());
  let skipped = 0;
  for (let d = new Date(first); d <= end; d.setDate(d.getDate() + 1)){
    const ds = todayAt(d);
    if (!state.trainings.some(t => t.date === ds)) skipped++;
  }
  return skipped;
}

function showScreen(id){
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $(id).classList.add('active');
  const headerTrain = $('header-train');
  if (headerTrain){
    headerTrain.style.display = (id === 'screen-training') ? 'flex' : 'none';
  }
  if (id === 'screen-training'){
    const input = $('typing-input');
    setTimeout(() => input.focus({ preventScroll: true }), 0);
  }
}

function updateHomeSettings(){
  $('chip-lang').textContent = LANG_LABELS[state.language] || 'English';
  $('chip-diff').textContent = DIFF_LABELS[state.difficulty] || 'Лёгкий';
  $('chip-time').textContent = TIME_LABELS[state.timeLimit] || '30 сек';
  $('chip-keyboard').textContent = state.showKeyboard ? 'Вкл' : 'Выкл';
}

function pickWord(){
  const list = WORDS[state.language][state.difficulty];
  let word;
  if (list.length === 1) word = list[0];
  else {
    do { word = list[Math.floor(Math.random() * list.length)]; }
    while (word === current.prevWord && list.length > 1);
  }
  current.prevWord = word;
  return word;
}

function tick(){
  if (!current.active) return;
  const remain = Math.max(0, Math.ceil((current.endsAt - Date.now()) / 1000));
  const timerEl = $('train-timer');
  if (timerEl) timerEl.textContent = String(remain);
  if (remain <= 0){ clearInterval(current.timerId); current.timerId = null; finishTraining(); }
}

function startTraining(){
  current = { active:true, words:[], wordIndex:0, caret:0, prevWord:'', correct:0, errors:0, charsTyped:0, blockHistory:[], startedAt:Date.now(), endsAt:Date.now() + state.timeLimit * 1000, timerId:null };
  showScreen('screen-training');
  initTraining();
  if (current.timerId) clearInterval(current.timerId);
  current.timerId = setInterval(tick, 1000);
  tick();
}

function restartTraining(){
  current = { active:true, words:[], wordIndex:0, caret:0, prevWord:'', correct:0, errors:0, charsTyped:0, blockHistory:[], startedAt:Date.now(), endsAt:Date.now() + state.timeLimit * 1000, timerId:null };
  initTraining();
  if (current.timerId) clearInterval(current.timerId);
  current.timerId = setInterval(tick, 1000);
  tick();
}

function finishTraining(){
  clearInterval(current.timerId); current.timerId = null; current.active = false;
  const words = current.correct;
  const errors = current.errors;
  const accuracy = (words + errors) === 0 ? 100 : Math.round((words / (words + errors)) * 100);
  const wpm = Math.max(0, Math.round(words / (state.timeLimit / 60)));
  const t = { date: today(), words, errors, accuracy, wpm, chars: current.charsTyped };
  state.trainings.push(t);
  state.dailyStats[t.date] = { words, errors, accuracy, chars: current.charsTyped };
  save();
  showResults(t);
}

function showResults(t){
  const last = state.trainings.length ? state.trainings[state.trainings.length - 1] : null;
  const words = t ? t.words : (last ? last.words : 0);
  const errors = t ? t.errors : (last ? last.errors : 0);
  const accuracy = t ? t.accuracy : (last ? last.accuracy : 0);
  const wpm = t ? t.wpm : (last ? last.wpm : 0);
  const chars = t ? t.chars : (last ? last.chars : 0);
  $('res-words').textContent = words;
  $('res-errors').textContent = errors;
  $('res-accuracy').textContent = (accuracy || 0) + '%';
  $('res-wpm').textContent = wpm;
  $('res-chars').textContent = chars;
  const streak = getStreak();
  const skipped = getSkippedDays();
  $('streak-info').innerHTML = 'Дней подряд: <b>' + streak + '</b> &nbsp;·&nbsp; Пропущенных дней: <b>' + skipped + '</b>';
  showScreen('screen-results');
  // Рисуем график после того как страница «Итоги» уже вёрстается —
  // иначе размеры контейнера равны 0 и график сжимается в «трубочку».
  requestAnimationFrame(() => drawGraph());
}

function drawGraph(){
  const canvas = $('progress-chart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  // Подгоняем разрешение канваса под отображаемый размер контейнера меню «Итоги»,
  // чтобы график был чётким и занимал всё свободное пространство без сжатия.
  const parent = canvas.parentElement;
  const logicalW = parent.clientWidth || 700;
  const logicalH = parent.clientHeight || Math.round(logicalW * 300 / 700);
  const dpr = window.devicePixelRatio || 1;
  canvas.width = logicalW * dpr;
  canvas.height = logicalH * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const w = logicalW, h = logicalH;
  ctx.clearRect(0, 0, w, h);
  const empty = $('empty-graph');
  if (!state.trainings.length){
    if (empty) empty.style.display = '';
    canvas.style.display = 'none';
    return;
  }
  if (empty) empty.style.display = 'none';
  canvas.style.display = '';
  const first = new Date(Math.min.apply(null, state.trainings.map(t => new Date(t.date))));
  const endD = new Date(today());
  const dates = [];
  for (let d = new Date(first); d <= endD; d.setDate(d.getDate() + 1)){
    dates.push(todayAt(d));
  }
  const values = dates.map(ds => (state.dailyStats[ds] ? state.dailyStats[ds].words : 0));
  const maxV = Math.max(1, Math.max.apply(null, values));
  const padL = 38, padR = 12, padT = 14, padB = 24;
  const iw = w - padL - padR, ih = h - padT - padB;
  const n = dates.length;
  const stepX = n > 1 ? iw / (n - 1) : 0;
  ctx.strokeStyle = 'rgba(148,163,184,0.18)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++){
    const y = padT + ih - (i / 4) * ih;
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke();
    ctx.fillStyle = '#7c8db0';
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.fillText(String(Math.round((maxV * i) / 4)), padL - 6, y);
  }
  const xFor = (i) => padL + (n > 1 ? i * stepX : iw / 2);
  const yFor = (v) => padT + ih - (v / maxV) * ih;
  ctx.beginPath();
  values.forEach((v, i) => {
    const x = xFor(i), y = yFor(v);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = '#4f8cff';
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  ctx.stroke();
  values.forEach((v, i) => {
    const x = xFor(i), y = yFor(v);
    ctx.fillStyle = v > 0 ? '#22c55e' : '#94a3b8';
    ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#0b1120';
    ctx.lineWidth = 2;
    ctx.stroke();
  });
  ctx.fillStyle = '#7c8db0';
  ctx.font = '10px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const step = Math.max(1, Math.ceil(n / 6));
  for (let i = 0; i < n; i += step){
    const x = xFor(i);
    const label = dates[i].slice(5).replace('-', '');
    ctx.fillText(label, x, h - 8);
  }
}

function buildKeyboard(){
  const kb = $('keyboard');
  if (!kb) return;
  if (!state.showKeyboard){ kb.style.display = 'none'; return; }
  kb.style.display = '';
  kb.innerHTML = '';
  const layout = KB_LAYOUTS[state.language];
  for (const row of layout){
    const rowDiv = document.createElement('div');
    rowDiv.className = 'kb-row';
    for (const k of row){
      const spec = KB_SPECIAL[k];
      const key = document.createElement('div');
      key.className = 'key' + (spec && spec.wide ? ' wide' : '') + (spec && spec.big ? ' space' : '');
      key.dataset.key = k;
      key.textContent = spec ? spec.label : k;
      rowDiv.appendChild(key);
    }
    kb.appendChild(rowDiv);
  }
}

function wireEvents(){
  $('btn-start').addEventListener('click', startTraining);
  $('btn-stats').addEventListener('click', () => { showResults(null); });
  $('settings-open').addEventListener('click', () => showScreen('screen-settings'));
  $('train-restart').addEventListener('click', restartTraining);
  $('settings-back').addEventListener('click', () => showScreen('screen-home'));
  $('settings-save').addEventListener('click', () => {
    state.language = document.querySelector('#lang-segmented .seg-btn.active').dataset.lang;
    state.difficulty = document.querySelector('#diff-segmented .seg-btn.active').dataset.diff;
    state.timeLimit = parseInt(document.querySelector('#time-segmented .seg-btn.active').dataset.time);
    state.showKeyboard = document.querySelector('#keyboard-segmented .seg-btn.active').dataset.kb === '1';
    save();
    updateHomeSettings();
    buildKeyboard();
    showScreen('screen-home');
  });
  ['lang-segmented','diff-segmented','time-segmented','keyboard-segmented'].forEach(id => {
    document.querySelectorAll('#' + id + ' .seg-btn').forEach(b => {
      b.addEventListener('click', () => {
        document.querySelectorAll('#' + id + ' .seg-btn').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
      });
    });
  });
  $('results-back').addEventListener('click', () => showScreen('screen-home'));
  $('btn-again').addEventListener('click', startTraining);
  $('btn-home').addEventListener('click', () => showScreen('screen-home'));

  document.addEventListener('keydown', handleKeydown);

  const input = $('typing-input');
  $('word-panel').addEventListener('click', () => input.focus({ preventScroll: true }));
}

function init(){ showScreen('screen-home'); }

/* ================= Training input (monkeytype style, 3 lines, no scroll) ================= */

function ensureWords(minCount){
  while (current.words.length < minCount){
    current.words.push({ text: pickWord(), typed: '', result: null });
  }
}

function getLineHeight(el){
  const style = getComputedStyle(el);
  const lh = parseFloat(style.lineHeight);
  if (lh && !isNaN(lh) && lh > 2) return lh;
  const fs = parseFloat(style.fontSize);
  if (lh && fs) return lh * fs;
  return fs || 20;
}

function setPanelHeight(targetRows){
  const panel = $('word-panel');
  const grid = panel.querySelector('.words-grid');
  if (!panel || !grid) return;
  const cs = getComputedStyle(grid);
  const lhRaw = parseFloat(cs.lineHeight);
  const fs = parseFloat(cs.fontSize);
  const lh = (lhRaw > 2) ? lhRaw : lhRaw * fs;
  const ps = getComputedStyle(panel);
  const pt = parseFloat(ps.paddingTop) || 0;
  const pb = parseFloat(ps.paddingBottom) || 0;
  const h = lh * targetRows + pt + pb;
  panel.style.height = h + 'px';
  panel.style.maxHeight = h + 'px';
  panel.style.overflow = 'hidden';
}

function countRows(){
  const panel = $('word-panel');
  const grid = panel.querySelector('.words-grid');
  if (!grid) return 0;
  const lh = getLineHeight(grid);
  if (!lh) return 0;
  return Math.ceil(grid.scrollHeight / lh);
}

function fillBlock(targetRows){
  let guard = 0;
  while (guard++ < 60){
    ensureWords(current.words.length + 6);
    render();
    const rows = countRows();
    if (rows >= targetRows) break;
  }
  let g2 = 0;
  while (g2++ < 60){
    const rows = countRows();
    if (rows <= targetRows || current.words.length === 0) break;
    current.words.pop();
    render();
  }
  setPanelHeight(targetRows);
}

function refreshBlock(){
  // завершённый блок (3 строки) запоминается — при нажатии Backspace в самом
  // начале нового блока можно вернуться к нему и исправить символы назад.
  if (current.words.length){
    current.blockHistory.unshift(current.words.map(w => ({
      text: w.text,
      typed: w.typed,
      result: w.result
    })));
    if (current.blockHistory.length > 8){
      current.blockHistory.pop();
    }
  }
  current.words = [];
  current.wordIndex = 0;
  current.caret = 0;
  fillBlock(3);
  render();
}

function initTraining(){
  current.words = [];
  current.wordIndex = 0;
  current.caret = 0;
  current.blockHistory = [];
  fillBlock(3);
  render();
}

function render(){
  const panel = $('word-panel');
  panel.innerHTML = '';
  const grid = document.createElement('div');
  grid.className = 'words-grid';
  current.words.forEach((w, i) => {
    const wordEl = document.createElement('span');
    let wcls = 'word';
    if (i === current.wordIndex) wcls += ' active';
    else if (i < current.wordIndex) wcls += ' done';
    wordEl.className = wcls;
    const chars = [];
    const isCurrent = (i === current.wordIndex);
    for (let j = 0; j < w.text.length; j++){
      const ch = document.createElement('span');
      let cls = 'char ';
      if (isCurrent){
        cls += (j < w.typed.length ? (w.typed[j] === w.text[j] ? 'correct' : 'wrong') : 'untyped');
      } else if (i < current.wordIndex){
        // уже пройденное слово — подсветка посимвольная, без перекрашивания всего слова
        if (j < w.typed.length){
          cls += (w.typed[j] === w.text[j] ? 'correct' : 'wrong');
        } else {
          cls += 'untyped';
        }
      } else {
        cls += 'untyped';
      }
      ch.className = cls;
      ch.textContent = w.text[j];
      wordEl.appendChild(ch);
      chars.push(ch);
    }
    if (isCurrent){
      const caret = document.createElement('span');
      caret.className = 'caret';
      const ci = Math.min(current.caret, w.text.length);
      caret.dataset.pos = String(ci);
      if (ci < chars.length) wordEl.insertBefore(caret, chars[ci]);
      else wordEl.appendChild(caret);
    }
    grid.appendChild(wordEl);
    grid.appendChild(document.createTextNode(' '));
  });
  panel.appendChild(grid);
  updateCaretPosition();
  updateKeyboardHighlight();
}

function updateCaretPosition(){
  const caret = document.querySelector('#word-panel .caret');
  if (!caret) return;
  const chars = Array.from(caret.parentElement.querySelectorAll('.char'));
  const idx = parseInt(caret.dataset.pos, 10) || 0;
  let left = 0;
  if (idx > 0 && chars[idx - 1]){
    left = chars[idx - 1].offsetLeft + chars[idx - 1].offsetWidth;
  }
  caret.style.left = left + 'px';
}

function updateKeyboardHighlight(){
  const keys = document.querySelectorAll('#keyboard .key');
  const word = current.words[current.wordIndex];
  const need = (word && current.caret < word.text.length) ? word.text[current.caret] : null;
  keys.forEach(k => {
    const ch = k.dataset.key;
    k.classList.toggle('active', need !== null && ch.toLowerCase() === need.toLowerCase());
  });
}

function handleChar(key){
  if (!current.active) return;
  const word = current.words[current.wordIndex];
  if (!word) return;
  const text = word.text;
  if (current.caret >= text.length) return;
  const pendingError = word.typed.length > current.caret && word.typed[current.caret] !== text[current.caret];
  if (pendingError) return;
  const expected = text[current.caret];
  word.typed += key;
  if (key === expected) current.caret = word.typed.length;
  else current.caret = word.typed.length - 1;
  render();
}

function handleBackspace(){
  if (!current.active) return;
  const word = current.words[current.wordIndex];
  if (!word) return;
  const hasError = word.typed.length > current.caret && word.typed[current.caret] !== word.text[current.caret];
  if (hasError){
    word.typed = word.typed.slice(0, current.caret);
    render();
    return;
  }
  if (current.caret > 0){
    current.caret = current.caret - 1;
    word.typed = word.typed.slice(0, current.caret);
    render();
    return;
  }
  // Переход к предыдущему слову в рамках текущего блока (каретка в начале слова).
  if (current.wordIndex > 0){
    current.wordIndex = current.wordIndex - 1;
    const prev = current.words[current.wordIndex];
    current.caret = prev.typed.length;
    render();
    return;
  }
  // Начало первого слова первого блока — восстанавливаем предыдущий блок из истории,
  // чтобы можно было вернуться и исправить символы назад.
  if (current.wordIndex === 0 && current.caret === 0 && current.blockHistory && current.blockHistory.length){
    const prev = current.blockHistory.shift();
    current.words = prev.map(w => ({ text: w.text, typed: w.typed, result: w.result }));
    current.wordIndex = current.words.length - 1;
    const last = current.words[current.wordIndex];
    current.caret = last ? last.typed.length : 0;
    render();
    return;
  }
}

function submitWord(){
  if (!current.active) return;
  const word = current.words[current.wordIndex];
  if (!word) return;
  const typed = word.typed;
  if (typed.length > 0){
    if (typed === word.text){ current.correct++; word.result = 'ok'; }
    else { current.errors++; word.result = 'error'; }
    current.charsTyped += word.text.length;
  }
  current.wordIndex = current.wordIndex + 1;
  current.caret = 0;
  if (current.wordIndex >= current.words.length){
    refreshBlock();
  } else {
    render();
  }
}

function handleKeydown(e){
  if (!current.active) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const tag = e.target && e.target.tagName;
  if (tag === 'BUTTON' || tag === 'SELECT' || tag === 'TEXTAREA') return;
  const key = (e.key && e.key.length === 1) ? e.key.toLowerCase() : e.key;
  if (e.key === 'Backspace'){
    e.preventDefault();
    handleBackspace();
  } else if (e.key === ' ' || e.key === 'Enter'){
    e.preventDefault();
    submitWord();
  } else if (e.key.length === 1){
    handleChar(key);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  load();
  recordLogin();
  updateHomeSettings();
  buildKeyboard();
  wireEvents();
  init();
});
