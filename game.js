// game.js — CliConVocabulary game logic
const VERSION = 'v0.3.3';
console.log('%cCliConVocabulary ' + VERSION + ' [game]', 'color:#6c5ce7;font-weight:bold;font-size:14px');

// ── URL params ────────────────────────────────────────────────────────────────

const params      = new URLSearchParams(location.search);
const LEVEL_ID    = params.get('level');
const MODE        = params.get('mode')    || 'clicword';
const CHRONO      = params.get('chrono')  === '1';
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
const TIME_LIMIT           = GAME_CONFIG.chrono_s[MODE] ?? 8; // seconds per question (chrono mode)
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
    loadImage();

    if (MODE === 'learning') {
      document.querySelector('.game-score').style.visibility = 'hidden';
      setupLearning();
    } else {
      setupPlay();
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
  const img = document.getElementById('game-image');
  img.addEventListener('load', () => renderCurrent());
  img.src = levelData.image_path || '';
  window.addEventListener('resize', () => renderCurrent());
}

// In clicword mode the active point must not be revealed before the player answers
function renderCurrent() {
  renderMarkers(MODE === 'clicword' ? -1 : activeIdx);
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
  const ctr = document.getElementById('game-image-area');
  if (!img.naturalWidth) return null;
  const nR = img.naturalWidth / img.naturalHeight;
  const cR = ctr.clientWidth  / ctr.clientHeight;
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

    if (MODE === 'clicword' || MODE === 'learning') {
      ptG.classList.add('marker-clickable');
      ptG.addEventListener('click', e => { e.stopPropagation(); onMarkerClick(i); });
    }

    wG.appendChild(ptG);
    svg.appendChild(wG);
  });
}

// ── Learning mode ─────────────────────────────────────────────────────────────

function setupLearning() {
  activeIdx = -1;
  const list = document.createElement('div');
  list.className = 'learning-list'; list.id = 'learning-list';
  document.getElementById('game-body').insertBefore(list, document.getElementById('game-image-area'));
  renderLearningList(-1);

  document.getElementById('question-zone').innerHTML =
    '<div class="question-hint">Cliquez sur un mot ou sur un point de l\'image</div>';
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
    item.addEventListener('click', () => { activeIdx = i; renderLearningList(i); renderMarkers(i); });
    list.appendChild(item);
  });
  if (selIdx >= 0) list.querySelectorAll('.learn-word-item')[selIdx]?.scrollIntoView({ block: 'nearest' });
}

function onMarkerClick(idx) {
  if (MODE === 'learning') {
    activeIdx = idx; renderLearningList(idx); renderMarkers(idx);
  } else if (MODE === 'clicword') {
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
  nextQuestion();
}

function nextQuestion() {
  if (lives <= 0)               { showEnd(false); return; }
  if (playPos >= playQueue.length) { showEnd(true);  return; }

  activeIdx         = playQueue[playPos++];
  questionStartTime = Date.now();
  locked            = false;
  renderCurrent();

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
    renderMarkers(activeIdx); // briefly reveal the correct point
    onCorrect();
  } else {
    onWrong();
    renderMarkers(activeIdx, clickedIdx);
  }
}

// ── Type the word ─────────────────────────────────────────────────────────────

function setupTypeWord() {
  const zone = document.getElementById('question-zone');
  zone.innerHTML = '';
  const hint = document.createElement('div');
  hint.className = 'question-hint';
  hint.textContent = 'Tapez le mot correspondant au point actif';

  const form   = document.createElement('div');
  form.className = 'type-form';
  const input  = document.createElement('input');
  input.type = 'text'; input.className = 'type-input';
  input.placeholder = 'Type here…';
  input.autocomplete = 'off'; input.autocorrect = 'off'; input.spellcheck = false;
  const okBtn  = document.createElement('button');
  okBtn.className = 'btn btn-primary'; okBtn.textContent = 'OK';

  const submit = () => { stopChrono(); handleTypeWordAnswer(input.value.trim()); };
  input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); submit(); } });
  okBtn.addEventListener('click', submit);

  form.appendChild(input); form.appendChild(okBtn);
  zone.appendChild(hint); zone.appendChild(form);
  setTimeout(() => input.focus(), 80);
}

function handleTypeWordAnswer(answer) {
  if (locked) return;
  const w       = allWords[activeIdx];
  const correct = (w.en || '').trim().toLowerCase();
  if (answer.toLowerCase() === correct) {
    onCorrect();
  } else {
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
  if (chosen === correct) { btn.classList.add('correct'); onCorrect(); }
  else                    { btn.classList.add('wrong');   onWrong();   }
}

// ── Correct / Wrong ───────────────────────────────────────────────────────────

function onCorrect() {
  locked = true;
  addScore(calcScore());
  answeredCorrectly.add(activeIdx);
  showFeedback('Correct !', true);
  document.getElementById('game-svg').querySelectorAll('.marker-active-pulse').forEach(el => {
    el.classList.replace('marker-active-pulse', 'marker-correct-pulse');
  });
  const victory = answeredCorrectly.size >= allWords.length;
  setTimeout(() => victory ? showEnd(true) : nextQuestion(), FEEDBACK_DELAY_OK);
}

function onWrong() {
  locked = true;
  wrongCount++;
  const dead = loseLife();
  showFeedback('Incorrect !', false);
  // Re-inject 2 positions later in the queue
  const insertAt = Math.min(playPos + RETRY_OFFSET - 1, playQueue.length);
  playQueue.splice(insertAt, 0, activeIdx);
  setTimeout(() => { if (dead) showEnd(false); else nextQuestion(); }, FEEDBACK_DELAY_WRONG);
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
  if (MODE === 'typeword') { handleTypeWordAnswer(''); return; }
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
      gameService.updateProgress(PROFILE_ID, LEVEL_ID, gameTypeId, stars).catch(console.error);
    }
  }

  const overlay = document.createElement('div');
  overlay.className = 'end-screen';
  overlay.innerHTML = `
    <div class="end-emoji">${victory ? '🎉' : '💔'}</div>
    <div class="end-title">${victory ? 'Niveau terminé !' : 'Perdu…'}</div>
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

// ── Start ─────────────────────────────────────────────────────────────────────

init();
