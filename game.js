// game.js — CliConVocabulary game logic

// ── URL params ────────────────────────────────────────────────────────────────

const params   = new URLSearchParams(location.search);
const LEVEL_ID = params.get('level');
const MODE     = params.get('mode')   || 'clicword';
const CHRONO   = params.get('chrono') === '1';

const MAX_LIVES   = 3;
const CHRONO_SECS = MODE === 'clicword' ? 20 : 30;

if (!LEVEL_ID) location.href = 'index.html';

// ── State ─────────────────────────────────────────────────────────────────────

let levelData    = null;
let allWords     = [];   // words that have a point
let score        = 0;
let lives        = MAX_LIVES;
let activeIdx    = -1;   // word currently shown / to find
let queue        = [];   // shuffled indices for play modes
let queuePos     = 0;
let retryQueue   = [];   // wrong answers to re-ask
let locked       = false; // block input during transitions
let chronoVal    = CHRONO_SECS;
let chronoTimer  = null;

// ── Init ──────────────────────────────────────────────────────────────────────

async function init() {
  try {
    levelData = await gameService.getLevelById(LEVEL_ID);
    if (!levelData) { alert('Niveau introuvable.'); location.href = 'index.html'; return; }

    document.title = `${levelData.title || levelData.name} — CliConVocabulary`;

    const raw = await gameService.getWords(LEVEL_ID);
    allWords = raw.filter(w => w.point);

    if (allWords.length === 0) {
      alert('Ce niveau n\'a pas encore de marqueurs placés.');
      location.href = 'index.html'; return;
    }

    renderLives();
    setupChronoBar();
    loadImage();

    if (MODE === 'learning') setupLearning();
    else                     setupPlay();

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
  fill.id = 'chrono-fill';
  fill.className = 'chrono-fill';
  bar.appendChild(fill);
  document.getElementById('game-body').prepend(bar);
}

function loadImage() {
  const img = document.getElementById('game-image');
  img.addEventListener('load', renderMarkers);
  img.src = levelData.image_path || '';
  window.addEventListener('resize', renderMarkers);
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { stopChrono(); location.href = 'index.html'; }
});

// ── Lives & Score ─────────────────────────────────────────────────────────────

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
  const ctr = document.getElementById('game-image-area');
  if (!img.naturalWidth) return null;
  const cR = ctr.clientWidth / ctr.clientHeight;
  const nR = img.naturalWidth / img.naturalHeight;
  let dW, dH, oX, oY;
  if (nR > cR) { dW = ctr.clientWidth;  dH = dW / nR;  oX = 0; oY = (ctr.clientHeight - dH) / 2; }
  else         { dH = ctr.clientHeight; dW = dH * nR;  oY = 0; oX = (ctr.clientWidth  - dW) / 2; }
  return { x: oX, y: oY, width: dW, height: dH };
}

function toSvg(pct, r) {
  return { px: r.x + (pct.x / 100) * r.width, py: r.y + (pct.y / 100) * r.height };
}

function mkSvg(tag) { return document.createElementNS('http://www.w3.org/2000/svg', tag); }

function lightenColor(hex, factor = 0.55) {
  if (!hex || !hex.startsWith('#') || hex.length < 7) return '#ffffff';
  const r = parseInt(hex.slice(1,3), 16), g = parseInt(hex.slice(3,5), 16), b = parseInt(hex.slice(5,7), 16);
  const lr = Math.round(r + (255-r)*factor), lg = Math.round(g + (255-g)*factor), lb = Math.round(b + (255-b)*factor);
  return `#${lr.toString(16).padStart(2,'0')}${lg.toString(16).padStart(2,'0')}${lb.toString(16).padStart(2,'0')}`;
}

function renderMarkers(highlightIdx = activeIdx, wrongIdx = -1) {
  const svg = document.getElementById('game-svg');
  svg.innerHTML = '';
  const img = document.getElementById('game-image');
  if (!img || !img.naturalWidth) return;
  const r = getImageRect();
  if (!r) return;

  const W = svg.clientWidth || svg.getBoundingClientRect().width;
  const H = svg.clientHeight || svg.getBoundingClientRect().height;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);

  const size   = levelData.marker_size         || 16;
  const aSize  = levelData.arrow_size          || 10;
  const color  = levelData.marker_color        || '#000000';
  const sColor = levelData.marker_stroke_color || '#ffffff';
  const sWidth = levelData.marker_stroke_width || 2;
  const lStyle = levelData.line_style          || 'solid';
  const aHead  = levelData.arrow_head          || 'point';
  const opacity = (levelData.marker_opacity    || 80) / 100;

  allWords.forEach((w, i) => {
    if (!w.point) return;
    const isActive  = i === highlightIdx;
    const isWrong   = i === wrongIdx;

    const pFill   = isActive ? lightenColor(color)  : color;
    const pStroke = isActive ? lightenColor(sColor) : sColor;

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
        poly.setAttribute('fill', pFill); poly.setAttribute('stroke', pStroke); poly.setAttribute('stroke-width', '1');
        wG.appendChild(poly);
      }

      const tipC = mkSvg('circle');
      tipC.setAttribute('cx', ax); tipC.setAttribute('cy', ay);
      tipC.setAttribute('r', aSize * 0.35);
      if (aHead === 'point') {
        tipC.setAttribute('fill', pFill); tipC.setAttribute('stroke', pStroke); tipC.setAttribute('stroke-width', sWidth);
      } else {
        tipC.setAttribute('fill', 'transparent'); tipC.setAttribute('stroke', 'none');
      }
      wG.appendChild(tipC);
    });

    // Point circle
    const ptG = mkSvg('g');
    const ptC = mkSvg('circle');
    ptC.setAttribute('cx', px); ptC.setAttribute('cy', py);
    ptC.setAttribute('r', size / 2);
    ptC.setAttribute('fill', pFill); ptC.setAttribute('stroke', pStroke); ptC.setAttribute('stroke-width', sWidth);
    ptG.appendChild(ptC);

    if (isActive && !isWrong) ptG.classList.add('marker-active-pulse');
    if (isWrong)              ptG.classList.add('marker-wrong-pulse');

    if (MODE === 'clicword' || MODE === 'learning') {
      ptG.style.cursor = 'pointer';
      ptG.addEventListener('click', e => { e.stopPropagation(); onMarkerClick(i); });
    }

    wG.appendChild(ptG);
    svg.appendChild(wG);
  });
}

// ── Learning mode ─────────────────────────────────────────────────────────────

function setupLearning() {
  activeIdx = -1;

  // Sidebar
  const list = document.createElement('div');
  list.className = 'learning-list';
  list.id = 'learning-list';
  document.getElementById('game-body').insertBefore(list, document.getElementById('game-image-area'));
  renderLearningList(-1);

  // Question zone
  const zone = document.getElementById('question-zone');
  zone.innerHTML = '<div class="question-hint">Cliquez sur un mot ou sur un point de l\'image</div>';

  renderMarkers(-1);
}

function renderLearningList(selIdx) {
  const list = document.getElementById('learning-list');
  if (!list) return;
  list.innerHTML = '';
  allWords.forEach((w, i) => {
    const item = document.createElement('div');
    item.className = `learn-word-item${i === selIdx ? ' active' : ''}`;
    item.innerHTML = `<div class="learn-word-en">${esc(w.en || w.fr)}</div>` +
                     (w.fr ? `<div class="learn-word-fr">${esc(w.fr)}</div>` : '');
    item.addEventListener('click', () => {
      activeIdx = i;
      renderLearningList(i);
      renderMarkers(i);
    });
    list.appendChild(item);
  });
  if (selIdx >= 0) {
    list.querySelectorAll('.learn-word-item')[selIdx]?.scrollIntoView({ block: 'nearest' });
  }
}

function onMarkerClick(idx) {
  if (MODE === 'learning') {
    activeIdx = idx;
    renderLearningList(idx);
    renderMarkers(idx);
  } else if (MODE === 'clicword') {
    handleClicWordAnswer(idx);
  }
}

// ── Play mode ─────────────────────────────────────────────────────────────────

function setupPlay() {
  queue    = shuffle(allWords.map((_, i) => i));
  queuePos = 0;
  retryQueue = [];
  nextQuestion();
}

function nextQuestion() {
  if (lives <= 0) { showEnd(false); return; }
  if (queuePos >= queue.length && retryQueue.length === 0) { showEnd(true); return; }

  activeIdx = queuePos < queue.length ? queue[queuePos++] : retryQueue.shift();
  locked = false;
  renderMarkers();

  if (MODE === 'clicword') setupClicWord();
  else if (MODE === 'typeword') setupTypeWord();
  else if (MODE === 'parmi3')  setupParmi3();

  if (CHRONO) startChrono();
}

// ── Clic on word ──────────────────────────────────────────────────────────────

function setupClicWord() {
  const w = allWords[activeIdx];
  document.getElementById('question-zone').innerHTML =
    `<div class="question-word">${esc(w.en || w.fr)}</div>` +
    `<div class="question-hint">Cliquez sur le point correspondant dans l'image</div>`;
}

function handleClicWordAnswer(clickedIdx) {
  if (locked) return;
  stopChrono();
  if (clickedIdx === activeIdx) {
    onCorrect();
  } else {
    onWrong();
    renderMarkers(activeIdx, clickedIdx); // show correct (pulse) + wrong (red)
  }
}

// ── Type the word ─────────────────────────────────────────────────────────────

function setupTypeWord() {
  const zone = document.getElementById('question-zone');
  zone.innerHTML = '';
  const hint = document.createElement('div');
  hint.className = 'question-hint';
  hint.textContent = 'Tapez le mot correspondant au point actif';
  const form = document.createElement('div');
  form.className = 'type-form';
  const input = document.createElement('input');
  input.type = 'text'; input.className = 'type-input';
  input.placeholder = 'Type here…';
  input.autocomplete = 'off'; input.autocorrect = 'off'; input.spellcheck = false;
  const okBtn = document.createElement('button');
  okBtn.className = 'btn btn-primary'; okBtn.textContent = 'OK';

  const submit = () => {
    if (locked) return;
    stopChrono();
    handleTypeWordAnswer(input.value.trim());
  };
  input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); submit(); } });
  okBtn.addEventListener('click', submit);

  form.appendChild(input); form.appendChild(okBtn);
  zone.appendChild(hint); zone.appendChild(form);
  setTimeout(() => input.focus(), 80);
}

function handleTypeWordAnswer(answer) {
  const w       = allWords[activeIdx];
  const correct = (w.en || '').trim().toLowerCase();
  if (answer.toLowerCase() === correct) {
    onCorrect();
  } else {
    onWrong();
    const zone = document.getElementById('question-zone');
    zone.innerHTML =
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
  if (chosen === correct) {
    btn.classList.add('correct');
    onCorrect();
  } else {
    btn.classList.add('wrong');
    onWrong();
  }
}

// ── Correct / Wrong ───────────────────────────────────────────────────────────

function onCorrect() {
  locked = true;
  addScore(10);
  showFeedback('Correct !', true);
  // brief correct animation on the active marker
  const svg = document.getElementById('game-svg');
  svg.querySelectorAll('.marker-active-pulse').forEach(el => {
    el.classList.remove('marker-active-pulse');
    el.classList.add('marker-correct-pulse');
  });
  setTimeout(nextQuestion, 700);
}

function onWrong() {
  locked = true;
  const dead = loseLife();
  showFeedback('Incorrect !', false);
  retryQueue.push(activeIdx);
  setTimeout(() => { if (dead) showEnd(false); else nextQuestion(); }, 2000);
}

// ── Chrono ────────────────────────────────────────────────────────────────────

function startChrono() {
  stopChrono();
  chronoVal = CHRONO_SECS;
  updateChronoBar();
  chronoTimer = setInterval(() => {
    chronoVal--;
    updateChronoBar();
    if (chronoVal <= 0) { stopChrono(); onChronoOut(); }
  }, 1000);
}

function stopChrono() {
  if (chronoTimer) { clearInterval(chronoTimer); chronoTimer = null; }
}

function updateChronoBar() {
  const fill = document.getElementById('chrono-fill');
  if (!fill) return;
  const pct = (chronoVal / CHRONO_SECS) * 100;
  fill.style.height = pct + '%';
  fill.className = 'chrono-fill' + (pct < 30 ? ' danger' : pct < 55 ? ' warning' : '');
}

function onChronoOut() {
  if (locked) return;
  if (MODE === 'typeword') {
    const input = document.querySelector('.type-input');
    if (input) { handleTypeWordAnswer(input.value.trim()); return; }
  }
  locked = true;
  const dead = loseLife();
  showFeedback('Temps écoulé !', false);
  retryQueue.push(activeIdx);
  renderMarkers(activeIdx);
  setTimeout(() => { if (dead) showEnd(false); else nextQuestion(); }, 2000);
}

// ── Feedback toast ────────────────────────────────────────────────────────────

let _feedbackTimer = null;
function showFeedback(msg, ok) {
  const toast = document.getElementById('feedback-toast');
  toast.textContent = msg;
  toast.className = `feedback-toast ${ok ? 'correct' : 'wrong'}`;
  if (_feedbackTimer) clearTimeout(_feedbackTimer);
  _feedbackTimer = setTimeout(() => toast.classList.add('fade'), 1200);
}

// ── End screen ────────────────────────────────────────────────────────────────

function showEnd(victory) {
  stopChrono();
  document.getElementById('feedback-toast').className = 'feedback-toast hidden';
  const overlay = document.createElement('div');
  overlay.className = 'end-screen';
  overlay.innerHTML = `
    <div class="end-emoji">${victory ? '🎉' : '💔'}</div>
    <div class="end-title">${victory ? 'Niveau terminé !' : 'Perdu…'}</div>
    <div class="end-score">${score} point${score > 1 ? 's' : ''}</div>
    <button class="btn btn-primary" id="end-retry-btn">Rejouer</button>
    <button class="btn btn-secondary" id="end-back-btn">Retour</button>
  `;
  document.body.appendChild(overlay);
  document.getElementById('end-back-btn').addEventListener('click', () => location.href = 'index.html');
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

// ── Start ─────────────────────────────────────────────────────────────────────

init();
