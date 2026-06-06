// game.js — CliConVocabulary game logic
const VERSION = 'v0.4.1';
console.log('%cCliConVocabulary ' + VERSION + ' [game]', 'color:#6c5ce7;font-weight:bold;font-size:14px');
document.addEventListener('DOMContentLoaded', () => {
  const el = document.getElementById('version-display');
  if (el) el.textContent = VERSION;
});

// ── URL params ────────────────────────────────────────────────────────────────

const params      = new URLSearchParams(location.search);
const LEVEL_ID    = params.get('level');
const MODE        = params.get('mode')    || 'findword';
const SPEED       = parseInt(params.get('speed') || '0');
const SECONDS     = parseFloat(params.get('seconds') || '0');
const CHRONO      = SPEED > 0;
const AUDIO       = params.get('audio')   !== '0';
const AVATAR      = parseInt(params.get('avatar') || '1', 10);
const PLAYER      = params.get('player')  || '';
const PROFILE_ID  = params.get('profile') || '';

(function() {
  const avatar = document.getElementById('game-avatar');
  if (avatar) avatar.src = `assets/avatars/avatar${String(AVATAR).padStart(2, '0')}.png`;
  const name = document.getElementById('game-player-name');
  if (name) name.textContent = PLAYER;
})();

if (!LEVEL_ID) location.href = 'index.html';

// ── Constants (spec: principe_scores4cliconvocabulary.md) ─────────────────────

const MAX_LIVES            = 3;
const TIME_LIMIT           = SECONDS || GAME_CONFIG.modes.find(m => m.slug === MODE)?.speed_levels?.find(s => s.level === SPEED)?.seconds || 8;
const SCORE_MIN            = 100;    // points for slowest correct answer
const SCORE_MAX            = 1000;   // points for instant correct answer
const FEEDBACK_DELAY_OK    = 700;    // ms before next question after correct
const FEEDBACK_DELAY_WRONG = 2500;   // ms to show correct answer after error
const RETRY_OFFSET         = 2;      // positions later the retry is injected

// ── State ─────────────────────────────────────────────────────────────────────

let levelData         = null;
let allWords          = [];    // words that have a point
let score             = 0;
let lives             = MAX_LIVES;
let wrongCount        = 0;
let activeIdx         = -1;
let playQueue         = [];    // ordered list of word indices to ask
let playPos           = 0;     // next index to consume from playQueue
let answeredCorrectly = new Set();
let questionStartTime = 0;
let gameStartTime     = 0;
let locked            = false; // blocks input during transitions
let chronoStart       = null;
let chronoRaf         = null;
let _typeCleanup      = null;
let _audioUnlocked    = false;
let _currentAudio     = null;

// ── Audio ─────────────────────────────────────────────────────────────────────

function stopCurrentAudio() {
  if (!_currentAudio) return;
  _currentAudio.pause();
  _currentAudio.src = '';
  _currentAudio = null;
}

function playWordAudio(idx) {
  if (!AUDIO || !_audioUnlocked) return;
  const url = allWords[idx]?.audio_path;
  if (!url) return;
  stopCurrentAudio();
  _currentAudio = new Audio(url);
  _currentAudio.play().catch(() => {});
}

function showStartOverlay(onStart) {
  const overlay = document.createElement('div');
  overlay.id = 'start-overlay';
  overlay.innerHTML = `<button id="start-btn">▶ Commencer</button>`;
  document.getElementById('game-body').appendChild(overlay);
  document.getElementById('start-btn').addEventListener('click', () => {
    overlay.remove();
    _audioUnlocked = true;
    onStart();
    if (CHRONO) {
      if ((MODE === 'listenclick' || MODE === 'listentype') && _currentAudio) {
        _currentAudio.addEventListener('ended', () => startChrono(), { once: true });
        _currentAudio.addEventListener('error', () => startChrono(), { once: true });
      } else {
        startChrono();
      }
    }
  });
}

// ── Init ──────────────────────────────────────────────────────────────────────

async function init() {
  try {
    levelData = await gameService.getLevelById(LEVEL_ID);
    if (!levelData) { alert('Niveau introuvable.'); location.href = 'index.html'; return; }
    document.title = `${levelData.title || levelData.name} — CliConVocabulary`;
    console.log('[level]', {
      sel_color_override: levelData.sel_color_override,
      selected_fill:      levelData.selected_fill,
      selected_stroke:    levelData.selected_stroke,
      marker_color:       levelData.marker_color,
    });

    const raw = await gameService.getWords(LEVEL_ID);
    allWords = raw.filter(w => w.point);

    if (allWords.length === 0) {
      alert('Ce niveau n\'a pas encore de marqueurs placés.');
      location.href = 'index.html'; return;
    }

    renderLives();
    setupChronoBar();
    await loadImage();

    if (MODE === 'learning') {
      _audioUnlocked = true;
      document.querySelector('.game-lives-area').style.visibility = 'hidden';
      const stopBtn = document.querySelector('.game-stop-btn');
      if (stopBtn) { stopBtn.textContent = '←'; stopBtn.title = 'Retour'; }
      setupLearning();
    } else {
      setupPlay();
      showStartOverlay(() => { if (MODE === 'findword' || MODE === 'listenclick' || MODE === 'listentype') playWordAudio(activeIdx); });
    }

  } catch(err) {
    alert('Erreur : ' + err.message);
    location.href = 'index.html';
  }
}

// ── Layout ────────────────────────────────────────────────────────────────────

function setupChronoBar() {
  if (!CHRONO || MODE === 'learning') return;
  const bar  = document.createElement('div');
  bar.className = 'chrono-bar';
  const fill = document.createElement('div');
  fill.id = 'chrono-fill'; fill.className = 'chrono-fill';
  bar.appendChild(fill);
  document.getElementById('game-body').prepend(bar);
}

function loadImage() {
  return new Promise(resolve => {
    const img = document.getElementById('game-image');
    new ResizeObserver(() => renderCurrent()).observe(document.getElementById('game-image-area'));
    if (!levelData.image_path) { renderCurrent(); resolve(); return; }
    img.addEventListener('load',  () => { renderCurrent(); resolve(); }, { once: true });
    img.addEventListener('error', () => resolve(), { once: true });
    img.src = levelData.image_path;
  });
}

// Active point hidden before answer in modes where the marker would give away the answer
function renderCurrent() {
  const hideActive = MODE === 'findword' || MODE === 'listenclick' || MODE === 'listentype';
  renderMarkers(hideActive ? -1 : activeIdx);
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { stopChrono(); location.href = 'index.html'; }
});

// ── Lives & Score ─────────────────────────────────────────────────────────────

function renderCounter() {
  const el = document.getElementById('game-counter');
  if (!el) return;
  el.textContent = `${answeredCorrectly.size} / ${allWords.length}`;
}

function renderLives() {
  const zone = document.getElementById('lives-zone');
  zone.innerHTML = '';
  for (let i = 0; i < MAX_LIVES; i++) {
    const s = document.createElement('span');
    s.className = `life${i >= lives ? ' lost' : ''}`;
    s.textContent = '♥';
    zone.appendChild(s);
  }
}

function calcScore() {
  if (!CHRONO) return SCORE_MIN;
  const elapsed = (Date.now() - questionStartTime) / 1000;
  return Math.max(SCORE_MIN, SCORE_MAX - Math.floor((elapsed / TIME_LIMIT) * (SCORE_MAX - SCORE_MIN)));
}

function addScore(pts) {
  score += pts;
  document.getElementById('score-val').textContent = score;
}

function loseLife() {
  lives = Math.max(0, lives - 1);
  renderLives();
  return lives === 0;
}

// ── SVG markers ───────────────────────────────────────────────────────────────

function getImageRect() {
  const img = document.getElementById('game-image');
  const svg = document.getElementById('game-svg');
  if (!img.naturalWidth) return null;
  const iR = img.getBoundingClientRect();
  const sR = svg.getBoundingClientRect();
  return { x: iR.left - sR.left, y: iR.top - sR.top, width: iR.width, height: iR.height };
}

function toSvg(pct, r) {
  return { px: r.x + (pct.x / 100) * r.width, py: r.y + (pct.y / 100) * r.height };
}

function mkSvg(tag) { return document.createElementNS('http://www.w3.org/2000/svg', tag); }

function lightenColor(hex, factor = 0.55) {
  if (!hex || !hex.startsWith('#') || hex.length < 7) return '#ffffff';
  const r = parseInt(hex.slice(1,3), 16), g = parseInt(hex.slice(3,5), 16), b = parseInt(hex.slice(5,7), 16);
  const lr = Math.round(r+(255-r)*factor), lg = Math.round(g+(255-g)*factor), lb = Math.round(b+(255-b)*factor);
  return `#${lr.toString(16).padStart(2,'0')}${lg.toString(16).padStart(2,'0')}${lb.toString(16).padStart(2,'0')}`;
}

function renderMarkers(highlightIdx = activeIdx, wrongIdx = -1) {
  const svg = document.getElementById('game-svg');
  svg.innerHTML = '';
  const img = document.getElementById('game-image');
  if (!img || !img.naturalWidth) return;
  const r = getImageRect();
  if (!r) return;

  const W = svg.clientWidth  || svg.getBoundingClientRect().width;
  const H = svg.clientHeight || svg.getBoundingClientRect().height;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);

  const size    = levelData.marker_size         || 16;
  const aSize   = levelData.arrow_size          || 10;
  const color   = levelData.marker_color        || '#000000';
  const sColor  = levelData.marker_stroke_color || '#ffffff';
  const sWidth  = levelData.marker_stroke_width || 2;
  const lStyle  = levelData.line_style          || 'solid';
  const aHead   = levelData.arrow_head          || 'point';
  const opacity = (levelData.marker_opacity     || 80) / 100;

  allWords.forEach((w, i) => {
    if (!w.point) return;
    const isActive = i === highlightIdx;
    const isWrong  = i === wrongIdx;
    const selFill   = levelData.sel_color_override
      ? (levelData.selected_fill   || '#ffffff')
      : lightenColor(color);
    const selStroke = levelData.sel_color_override
      ? (levelData.selected_stroke || '#6c5ce7')
      : lightenColor(sColor);
    const pFill    = isActive ? selFill   : color;
    const pStroke  = isActive ? selStroke : sColor;

    const { px, py } = toSvg(w.point, r);
    const wG = mkSvg('g');
    wG.setAttribute('opacity', isActive ? 1 : opacity);

    // Arrows
    (w.arrows || []).forEach(a => {
      const { px: ax, py: ay } = toSvg(a, r);

      const line = mkSvg('line');
      line.setAttribute('x1', px); line.setAttribute('y1', py);
      line.setAttribute('x2', ax); line.setAttribute('y2', ay);
      line.setAttribute('stroke', pFill);
      line.setAttribute('stroke-width', Math.max(1, sWidth - 1));
      if (lStyle === 'dashed') line.setAttribute('stroke-dasharray', '7,4');
      line.setAttribute('stroke-linecap', 'round');
      wG.appendChild(line);

      if (aHead === 'filled') {
        const angle = Math.atan2(ay - py, ax - px);
        const hLen  = aSize * 0.8;
        const hAng  = Math.PI / 6;
        const poly  = mkSvg('polygon');
        poly.setAttribute('points', [
          `${ax},${ay}`,
          `${ax - hLen*Math.cos(angle-hAng)},${ay - hLen*Math.sin(angle-hAng)}`,
          `${ax - hLen*Math.cos(angle+hAng)},${ay - hLen*Math.sin(angle+hAng)}`,
        ].join(' '));
        poly.setAttribute('fill', pFill); poly.setAttribute('stroke', pStroke);
        poly.setAttribute('stroke-width', '1');
        wG.appendChild(poly);
      }

      const tipC = mkSvg('circle');
      tipC.setAttribute('cx', ax); tipC.setAttribute('cy', ay);
      tipC.setAttribute('r', aSize * 0.35);
      if (aHead === 'point') {
        tipC.setAttribute('fill', pFill); tipC.setAttribute('stroke', pStroke);
        tipC.setAttribute('stroke-width', sWidth);
      } else {
        tipC.setAttribute('fill', 'transparent'); tipC.setAttribute('stroke', 'none');
      }
      wG.appendChild(tipC);
    });

    // Point group — outer container (never transforms, so hit area stays fixed)
    const ptG = mkSvg('g');

    // Fixed hit area: matches visual extent at max zoom (size/2 * 1.35)
    const hitC = mkSvg('circle');
    hitC.setAttribute('cx', px); hitC.setAttribute('cy', py);
    hitC.setAttribute('r', size * 0.675);
    hitC.setAttribute('fill', 'transparent');
    hitC.setAttribute('stroke', 'none');
    hitC.setAttribute('pointer-events', 'all');
    ptG.appendChild(hitC);

    // Inner visual group — this one scales on hover/active/animations
    const ptInner = mkSvg('g');
    ptInner.classList.add('marker-pt-inner');
    const ptC = mkSvg('circle');
    ptC.setAttribute('cx', px); ptC.setAttribute('cy', py);
    ptC.setAttribute('r', size / 2);
    ptC.setAttribute('fill', pFill); ptC.setAttribute('stroke', pStroke);
    ptC.setAttribute('stroke-width', sWidth);
    ptInner.appendChild(ptC);
    ptG.appendChild(ptInner);

    ptG.classList.add('marker-pt');
    if (isActive && !isWrong) ptG.classList.add('marker-active-pulse');
    if (isWrong)              ptG.classList.add('marker-wrong-pulse');

    if (MODE === 'findword' || MODE === 'listenclick' || MODE === 'learning') {
      ptG.classList.add('marker-clickable');
      ptG.addEventListener('click', e => { e.stopPropagation(); onMarkerClick(i); });
    }

    wG.appendChild(ptG);
    svg.appendChild(wG);
  });
}

// ── Learning mode ─────────────────────────────────────────────────────────────

let _learnSortAsc = true;

function setupLearning() {
  activeIdx = -1;

  const container = document.createElement('div');
  container.className = 'learning-container'; container.id = 'learning-container';

  container.innerHTML = `
    <div class="learning-header">
      <button id="learn-sort-btn" class="learn-sort-btn" title="Trier">A↑</button>
      <span id="learn-word-count" class="learn-word-count"></span>
    </div>
    <div class="learning-list" id="learning-list"></div>
  `;
  document.getElementById('game-body').insertBefore(container, document.getElementById('game-image-area'));

  document.getElementById('learn-sort-btn').addEventListener('click', () => {
    _learnSortAsc = !_learnSortAsc;
    document.getElementById('learn-sort-btn').textContent = _learnSortAsc ? 'A↑' : 'A↓';
    renderLearningList(activeIdx);
  });

  renderLearningList(-1);
  document.getElementById('question-zone').innerHTML = '';
  renderMarkers(-1);
}

function _learningQuestion(selIdx) {
  const qz = document.getElementById('question-zone');
  if (!qz) return;
  if (selIdx < 0 || !allWords[selIdx]) { qz.innerHTML = ''; return; }
  const w = allWords[selIdx];
  qz.innerHTML = `<div class="question-learning">` +
    `<span class="question-word">${esc(w.en || w.fr)}</span>` +
    (w.fr ? `<span class="question-sep"> → </span><span class="question-fr">${esc(w.fr)}</span>` : '') +
    `</div>`;
}

function renderLearningList(selIdx) {
  const list = document.getElementById('learning-list');
  if (!list) return;

  const indices = allWords.map((_, i) => i).sort((a, b) => {
    const cmp = (allWords[a].en || allWords[a].fr).localeCompare(allWords[b].en || allWords[b].fr);
    return _learnSortAsc ? cmp : -cmp;
  });

  document.getElementById('learn-word-count').textContent = `${allWords.length} mots`;
  list.innerHTML = '';
  indices.forEach(i => {
    const w = allWords[i];
    const item = document.createElement('div');
    item.className = `learn-word-item${i === selIdx ? ' active' : ''}`;
    item.innerHTML = `<div class="learn-word-en">${esc(w.en || w.fr)}</div>`;
    item.addEventListener('click', () => { activeIdx = i; renderLearningList(i); renderMarkers(i); _learningQuestion(i); playWordAudio(i); });
    list.appendChild(item);
  });

  const displayPos = indices.indexOf(selIdx);
  if (displayPos >= 0) list.querySelectorAll('.learn-word-item')[displayPos]?.scrollIntoView({ block: 'nearest' });
  _learningQuestion(selIdx);
}

function onMarkerClick(idx) {
  if (MODE === 'learning') {
    activeIdx = idx; renderLearningList(idx); renderMarkers(idx); _learningQuestion(idx); playWordAudio(idx);
  } else if (MODE === 'findword' || MODE === 'listenclick') {
    handleClicWordAnswer(idx);
  }
}

// ── Play mode ─────────────────────────────────────────────────────────────────

function setupPlay() {
  playQueue         = shuffle(allWords.map((_, i) => i));
  playPos           = 0;
  answeredCorrectly = new Set();
  wrongCount        = 0;
  gameStartTime     = Date.now();
  renderCounter();
  nextQuestion();
}

function nextQuestion() {
  if (_typeCleanup) { _typeCleanup(); _typeCleanup = null; }
  if (lives <= 0)               { showEnd(false); return; }
  if (playPos >= playQueue.length) { showEnd(true);  return; }

  activeIdx         = playQueue[playPos++];
  questionStartTime = Date.now();
  locked            = false;
  stopCurrentAudio();
  renderCurrent();

  if      (MODE === 'findword')    setupClicWord();
  else if (MODE === 'listenclick') setupListenClick();
  else if (MODE === 'typeword')    setupTypeWord();
  else if (MODE === 'listentype')  setupListenType();
  else if (MODE === 'chooseword')  setupParmi3();

  if (CHRONO && _audioUnlocked) {
    const img = document.getElementById('game-image');
    const doStart = () => {
      if (img.complete && img.naturalWidth) startChrono();
      else img.addEventListener('load', () => startChrono(), { once: true });
    };
    if ((MODE === 'listenclick' || MODE === 'listentype') && _currentAudio) {
      _currentAudio.addEventListener('ended', doStart, { once: true });
      _currentAudio.addEventListener('error', doStart, { once: true });
    } else {
      doStart();
    }
  }
}

// ── Clic on word ──────────────────────────────────────────────────────────────

function setupListenClick() {
  const zone = document.getElementById('question-zone');
  zone.innerHTML =
    `<button class="audio-replay-btn" id="audio-replay-btn">${ICONS.speaker}</button>` +
    `<div class="question-hint">Cliquez sur le point correspondant à ce que vous entendez</div>`;
  document.getElementById('audio-replay-btn').addEventListener('click', e => {
    e.stopPropagation();
    playWordAudio(activeIdx);
  });
  playWordAudio(activeIdx);
}

function setupClicWord() {
  const w = allWords[activeIdx];
  document.getElementById('question-zone').innerHTML =
    `<div class="question-word">${esc(w.en || w.fr)}</div>` +
    `<div class="question-hint">Cliquez sur le point correspondant dans l'image</div>`;
  playWordAudio(activeIdx);
}

function handleClicWordAnswer(clickedIdx) {
  if (locked) return;
  stopChrono();
  if (clickedIdx === activeIdx) {
    renderMarkers(activeIdx); // briefly reveal the correct point
    onCorrect();
  } else {
    onWrong();
    renderMarkers(activeIdx, clickedIdx);
  }
}

// ── Type the word ─────────────────────────────────────────────────────────────

const AZERTY_ROWS = [
  ['A','Z','E','R','T','Y','U','I','O','P'],
  ['Q','S','D','F','G','H','J','K','L','M'],
  ['W','X','C','V','B','N','⌫'],
];

// ── TypeWord rules ────────────────────────────────────────────────────────────
// Rule 1: spaces in compound words (e.g. "guinea fowl") become visual
//         word-break separators — the player never types a space.

function twBuildTemplate(answer) {
  return answer.split('').map(c => {
    if (/[a-zA-Z]/.test(c)) return { type: 'letter' };
    if (c === ' ')           return { type: 'space' };
    return { type: 'sep', char: c };
  });
}

function twReconstruct(typed, template) {
  let li = 0;
  return template.map(t => {
    if (t.type === 'letter') return typed[li++];
    if (t.type === 'space')  return ' ';
    return t.char;
  }).join('');
}

// ── Shared keyboard + letter boxes (used by typeword and listentype) ──────────

function _attachTypeInput() {
  const zone        = document.getElementById('question-zone');
  const answer      = (allWords[activeIdx].en || '').trim();
  const template    = twBuildTemplate(answer);
  const letterCount = template.filter(t => t.type === 'letter').length;
  let typed = [];

  const boxes = document.createElement('div');
  boxes.className = 'type-boxes';
  const cells = [];

  template.forEach(t => {
    if (t.type === 'space') {
      const gap = document.createElement('span');
      gap.className = 'type-word-gap';
      boxes.appendChild(gap);
    } else if (t.type === 'sep') {
      const sep = document.createElement('span');
      sep.className = 'type-sep';
      sep.textContent = t.char;
      boxes.appendChild(sep);
    } else {
      const cell = document.createElement('span');
      cell.className = 'type-cell';
      boxes.appendChild(cell);
      cells.push(cell);
    }
  });
  zone.appendChild(boxes);

  function render() {
    cells.forEach((cell, i) => {
      cell.textContent = i < typed.length ? typed[i].toUpperCase() : '';
      cell.className = 'type-cell' +
        (i < typed.length ? ' type-cell-filled' : '') +
        (i === typed.length ? ' type-cell-active' : '');
    });
  }
  render();

  function pressKey(key) {
    if (locked) return;
    if (key === '⌫') {
      if (typed.length > 0) { typed.pop(); render(); }
      return;
    }
    if (typed.length < letterCount) {
      typed.push(key);
      render();
      if (typed.length === letterCount) {
        stopChrono();
        handleTypeWordAnswer(twReconstruct(typed, template));
      }
    }
  }

  function handleKey(e) {
    if (e.key === 'Backspace') { e.preventDefault(); pressKey('⌫'); return; }
    if (e.key.length === 1 && /[a-zA-Z]/.test(e.key)) pressKey(e.key.toUpperCase());
  }
  document.addEventListener('keydown', handleKey);

  const kb = document.createElement('div');
  kb.className = 'type-keyboard';
  AZERTY_ROWS.forEach(row => {
    const rowEl = document.createElement('div');
    rowEl.className = 'type-kb-row';
    row.forEach(k => {
      const btn = document.createElement('button');
      btn.className = 'type-kb-key' + (k === '⌫' ? ' type-kb-del' : '');
      btn.textContent = k;
      btn.addEventListener('pointerdown', e => { e.preventDefault(); pressKey(k); });
      rowEl.appendChild(btn);
    });
    kb.appendChild(rowEl);
  });
  document.querySelector('.game-layout').appendChild(kb);

  _typeCleanup = () => {
    document.removeEventListener('keydown', handleKey);
    kb.remove();
  };
}

function setupTypeWord() {
  document.getElementById('question-zone').innerHTML = '';
  _attachTypeInput();
}

// ── Listen & type (dictation) ─────────────────────────────────────────────────

function setupListenType() {
  const zone = document.getElementById('question-zone');
  zone.innerHTML =
    `<button class="audio-replay-btn" id="audio-replay-btn">${ICONS.speaker}</button>` +
    `<div class="question-hint">Tapez le mot que vous entendez</div>`;
  document.getElementById('audio-replay-btn').addEventListener('click', e => {
    e.stopPropagation();
    playWordAudio(activeIdx);
  });
  _attachTypeInput();
  playWordAudio(activeIdx);
}

function handleTypeWordAnswer(answer) {
  if (locked) return;
  const w       = allWords[activeIdx];
  const correct = (w.en || '').trim().toLowerCase();
  if (answer.toLowerCase() === correct) {
    if (MODE === 'listentype') { stopCurrentAudio(); renderMarkers(activeIdx); }
    else playWordAudio(activeIdx);
    onCorrect();
  } else {
    if (MODE === 'listentype') { stopCurrentAudio(); renderMarkers(activeIdx); }
    else playWordAudio(activeIdx);
    onWrong();
    document.getElementById('question-zone').innerHTML =
      `<div class="question-hint">La bonne réponse était :</div>` +
      `<div class="question-word" style="color:var(--danger)">${esc(w.en)}</div>`;
  }
}

// ── Parmi 3 ───────────────────────────────────────────────────────────────────

function setupParmi3() {
  const w = allWords[activeIdx];
  const distractors = allWords
    .filter((_, i) => i !== activeIdx && (allWords[i].en || allWords[i].fr))
    .sort(() => Math.random() - .5)
    .slice(0, 2)
    .map(o => o.en || o.fr);
  const choices = shuffle([w.en || w.fr, ...distractors]);

  const zone = document.getElementById('question-zone');
  zone.innerHTML = '';
  const hint = document.createElement('div');
  hint.className = 'question-hint';
  hint.textContent = 'Quel est le mot correspondant au point actif ?';
  const btns = document.createElement('div');
  btns.className = 'question-choices';
  choices.forEach(c => {
    const btn = document.createElement('button');
    btn.className = 'choice-btn'; btn.textContent = c;
    btn.addEventListener('click', () => handleParmi3Answer(btn, c, w.en || w.fr, btns));
    btns.appendChild(btn);
  });
  zone.appendChild(hint); zone.appendChild(btns);
}

function handleParmi3Answer(btn, chosen, correct, btns) {
  if (locked) return;
  stopChrono();
  locked = true;
  btns.querySelectorAll('.choice-btn').forEach(b => {
    b.disabled = true;
    if (b.textContent === correct) b.classList.add('correct');
  });
  if (chosen === correct) { btn.classList.add('correct'); playWordAudio(activeIdx); onCorrect(); }
  else                    { btn.classList.add('wrong');   playWordAudio(activeIdx); onWrong();   }
}

// ── Correct / Wrong ───────────────────────────────────────────────────────────

// For typeword/chooseword: wait for both the min delay AND the audio to finish
// before moving to next question (avoids hearing a word while next marker is shown).
function _afterAnswer(minDelay, fn) {
  const waitAudio = AUDIO && _currentAudio && (MODE === 'typeword' || MODE === 'chooseword');
  if (!waitAudio) { setTimeout(fn, minDelay); return; }
  let audioDone = false, delayDone = false;
  const tryNext = () => { if (audioDone && delayDone) fn(); };
  _currentAudio.addEventListener('ended', () => { audioDone = true; tryNext(); }, { once: true });
  _currentAudio.addEventListener('error', () => { audioDone = true; tryNext(); }, { once: true });
  setTimeout(() => { delayDone = true; tryNext(); }, minDelay);
}

function onCorrect() {
  locked = true;
  addScore(calcScore());
  answeredCorrectly.add(activeIdx);
  renderCounter();
  showFeedback('Correct !', true);
  document.getElementById('game-svg').querySelectorAll('.marker-active-pulse').forEach(el => {
    el.classList.replace('marker-active-pulse', 'marker-correct-pulse');
  });
  const victory = answeredCorrectly.size >= allWords.length;
  _afterAnswer(FEEDBACK_DELAY_OK, () => victory ? showEnd(true) : nextQuestion());
}

function onWrong() {
  locked = true;
  wrongCount++;
  const dead = loseLife();
  showFeedback('Incorrect !', false);
  // Re-inject 2 positions later in the queue
  const insertAt = Math.min(playPos + RETRY_OFFSET - 1, playQueue.length);
  playQueue.splice(insertAt, 0, activeIdx);
  _afterAnswer(FEEDBACK_DELAY_WRONG, () => { if (dead) showEnd(false); else nextQuestion(); });
}

// ── Chrono ────────────────────────────────────────────────────────────────────

function startChrono() {
  stopChrono();
  chronoStart = performance.now();
  function tick(now) {
    const elapsed = (now - chronoStart) / 1000;
    const pct = Math.max(0, 1 - elapsed / TIME_LIMIT);
    updateChronoBar(pct);
    if (pct <= 0) { stopChrono(); onChronoOut(); return; }
    chronoRaf = requestAnimationFrame(tick);
  }
  chronoRaf = requestAnimationFrame(tick);
}

function stopChrono() {
  if (chronoRaf) { cancelAnimationFrame(chronoRaf); chronoRaf = null; }
}

function updateChronoBar(pct) {
  const fill = document.getElementById('chrono-fill');
  if (!fill) return;
  fill.style.height = ((1 - pct) * 100) + '%';
}

function onChronoOut() {
  if (locked) return;
  if (MODE === 'typeword' || MODE === 'listentype') { handleTypeWordAnswer(''); return; }
  showFeedback('Temps écoulé !', false);
  onWrong();
}

// ── Feedback toast ────────────────────────────────────────────────────────────

let _feedbackTimer = null;
function showFeedback(msg, ok) {
  const toast = document.getElementById('feedback-toast');
  toast.textContent = msg;
  toast.className = `feedback-toast ${ok ? 'correct' : 'wrong'}`;
  if (_feedbackTimer) clearTimeout(_feedbackTimer);
  _feedbackTimer = setTimeout(() => toast.classList.add('fade'), ok ? FEEDBACK_DELAY_OK : FEEDBACK_DELAY_WRONG - 300);
}

// ── End screen ────────────────────────────────────────────────────────────────

function showEnd(victory) {
  stopChrono();
  document.getElementById('feedback-toast').className = 'feedback-toast hidden';

  const livesLost = MAX_LIVES - lives;
  const nbQ       = allWords.length;
  let stars = 0;
  if (victory) {
    if (livesLost === 0 && CHRONO && score > GAME_CONFIG.score3_per_question * nbQ) stars = 3;
    else if (livesLost === 0) stars = 2;
    else stars = 1;
  }
  const starsStr = MODE === 'learning' ? '' : '★'.repeat(stars) + '☆'.repeat(3 - stars);

  if (PROFILE_ID && MODE !== 'learning') {
    const gameTypeId = GAME_CONFIG.game_types[MODE] || 1;
    const duration_s = Math.round((Date.now() - gameStartTime) / 1000);
    gameService.saveScore(PROFILE_ID, {
      game_id:      GAME_CONFIG.game_id,
      game_type_id: gameTypeId,
      level_id:     LEVEL_ID,
      score,
      duration_s,
      correct:      answeredCorrectly.size,
      wrong:        wrongCount,
      stars,
    }).catch(console.error);
    if (victory) {
      gameService.updateProgress(PROFILE_ID, LEVEL_ID, gameTypeId, stars, score).catch(console.error);
    }
  }

  const overlay = document.createElement('div');
  overlay.className = 'end-screen';
  overlay.innerHTML = `
    ${victory ? '<div class="end-emoji">🎉</div>' : ''}
    <div class="end-title">${victory ? 'Niveau terminé !' : 'GAME OVER'}</div>
    <div class="end-score">${score} point${score !== 1 ? 's' : ''}</div>
    ${victory ? `<div class="end-stars">${starsStr}</div>` : ''}
    <div style="display:flex;gap:10px;margin-top:8px">
      <button class="btn btn-primary"   id="end-retry-btn">Rejouer</button>
      <button class="btn btn-secondary" id="end-back-btn">Retour</button>
    </div>
  `;
  document.body.appendChild(overlay);
  document.getElementById('end-back-btn').addEventListener('click',  () => location.href = 'index.html');
  document.getElementById('end-retry-btn').addEventListener('click', () => location.reload());
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function esc(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Fullscreen ────────────────────────────────────────────────────────────────

(function () {
  const btn      = document.getElementById('fullscreen-btn');
  const expand   = document.getElementById('fs-expand');
  const compress = document.getElementById('fs-compress');
  function update() {
    const fs = !!document.fullscreenElement;
    expand.style.display   = fs ? 'none' : '';
    compress.style.display = fs ? '' : 'none';
  }
  btn.addEventListener('click', () => {
    document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
  });
  document.addEventListener('fullscreenchange', update);
})();

// ── Start ─────────────────────────────────────────────────────────────────────

init();
