// game.js — CalcNPlay
const VERSION = 'v0.2.0';
console.log('%cCalcNPlay ' + VERSION + ' [game]', 'color:#6c5ce7;font-weight:bold;font-size:14px');

// ── URL params ────────────────────────────────────────────────────────────────

const params     = new URLSearchParams(location.search);
const LEVEL_ID   = params.get('level');
const MODE       = params.get('mode')     || 'calcul';
const SPEED      = parseInt(params.get('speed')    || '0');
const SECONDS    = parseFloat(params.get('seconds') || '0');
const AVATAR     = parseInt(params.get('avatar')   || '1');
const PLAYER     = params.get('player')   || '';
const PROFILE_ID = params.get('profile')  || '';

if (!LEVEL_ID) location.href = 'index.html';

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_LIVES         = 3;
const WRONG_MS          = 1500;
const RETRY_OFFSET      = 2;
const PUZZLE_COUNT      = 20;
const BG_COUNT          = 66;
const MAX_GEN_TRIES     = 500;
const SCORE_PER_CORRECT = 1;
const FALL_RATIO        = 2.5;  // durée chute = seconds × FALL_RATIO
const SPAWN_RATIO       = 1.4;
const SPEED_ACCEL       = 0.83;
const MIN_FALL_SECONDS  = 0.7;

// ── State ─────────────────────────────────────────────────────────────────────

let _rules         = null;
let _formats       = [];
let _fmt           = null;

let _lives         = MAX_LIVES;
let _score         = 0;
let _totalCorrect  = 0;
let _totalWrong    = 0;
let _cycleCorrect  = 0;
let _gameOver      = false;
let _inputLocked   = false;

let _puzzleVisible = [];
let _bgIndex       = 0;

let _pool          = [];
let _falling       = [];
let _qIdSeq        = 0;
let _activeId      = null;

let _slots         = [];
let _displayAnswer = null;  // réponse à afficher brièvement après validation

let _fallSeconds   = SECONDS || 8;
let _spawnInterval = 0;
let _lastSpawnTime = 0;
let _rafId         = null;
let _lastTs        = null;

let _qareaH        = 0;
let _cardH         = 60;

// ── Audio ─────────────────────────────────────────────────────────────────────

const _SND = {
  correct:  new Audio('game_assets/sounds/cling.wav'),
  wrong:    new Audio('game_assets/sounds/dead-bird.wav'),
  gameover: new Audio('game_assets/sounds/gameover.wav'),
};
function _play(key) {
  try { _SND[key].currentTime = 0; _SND[key].play().catch(() => {}); } catch(_) {}
}

// ── Question generation ───────────────────────────────────────────────────────

function _randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function _round(n)          { return Math.round(n * 10000) / 10000; }
function _num(n)            { return String(_round(n)).replace('.', ','); }

function _computeQ(op, a, b) {
  switch (op) {
    case '+': return { op1: a,             op2: b, opSymbol: '+', result: _round(a + b) };
    case '-': return { op1: _round(a + b), op2: b, opSymbol: '−', result: a };
    case '*': return { op1: a,             op2: b, opSymbol: '×', result: _round(a * b) };
    case '/': return { op1: _round(a * b), op2: b, opSymbol: '÷', result: a };
  }
}

function _generateComputed() {
  const c = _rules.computed;
  if (!c.operators.length) return null;
  for (let i = 0; i < MAX_GEN_TRIES; i++) {
    const op = c.operators[Math.floor(Math.random() * c.operators.length)];
    const a  = _randInt(c.a.min, c.a.max) * c.a.coef;
    const b  = _randInt(c.b.min, c.b.max) * c.b.coef;
    if (b === 0) continue;
    const q = _computeQ(op, a, b);
    if (c.result.min !== null && q.result < c.result.min) continue;
    if (c.result.max !== null && q.result > c.result.max) continue;
    return q;
  }
  return null;
}

function _renderTemplate(template, q, placeholder) {
  return template
    .replace('{op1}',    _num(q.op1))
    .replace('{op2}',    _num(q.op2))
    .replace('{op}',     q.opSymbol)
    .replace('{result}', _num(q.result))
    .replace('{?}',      placeholder || '?');
}

function _makeQuestion() {
  if (_rules.mode === 'list') {
    const qs = _rules.list.questions;
    if (!qs.length) return null;
    const raw = qs[_randInt(0, qs.length - 1)];
    return { displayStr: raw.q + ' =', answerStr: String(raw.a) };
  }
  const q = _generateComputed();
  if (!q) return null;
  const answerKey  = _fmt?.answer_key || 'result';
  const answerVal  = answerKey === 'op1' ? q.op1 : answerKey === 'op2' ? q.op2 : q.result;
  const template   = _fmt?.template || '{op1} {op} {op2}';
  const placeholder = _fmt?.placeholder_display || '?';
  return {
    displayStr: _renderTemplate(template, q, placeholder),
    answerStr:  _num(answerVal),
  };
}

function _fillPool(n = 40) {
  let added = 0;
  for (let i = 0; i < n * 5 && added < n; i++) {
    const q = _makeQuestion();
    if (q) { _pool.push(q); added++; }
  }
}

function _popPool() {
  if (_pool.length < 10) _fillPool(30);
  return _pool.length ? _pool.shift() : null;
}

function _requeue(q) {
  const pos = Math.min(RETRY_OFFSET, _pool.length);
  _pool.splice(pos, 0, q);
}

// ── Slots ─────────────────────────────────────────────────────────────────────

function _buildSlots(answerStr) {
  return answerStr.split('').map(c => ({
    char: c, isDigit: /[0-9]/.test(c), typed: null,
  }));
}
function _slotsComplete() {
  return _slots.length > 0 && _slots.every(s => !s.isDigit || s.typed !== null);
}
function _typedAnswer()    { return _slots.map(s => s.isDigit ? s.typed : s.char).join(''); }
function _expectedAnswer() { return _slots.map(s => s.char).join(''); }

// ── DOM helpers ───────────────────────────────────────────────────────────────

function _renderLives() {
  const el = document.getElementById('lives-display');
  el.innerHTML = '';
  for (let i = 0; i < MAX_LIVES; i++) {
    const h = document.createElement('span');
    h.className   = 'cnp-heart' + (i >= _lives ? ' lost' : '');
    h.textContent = '❤';
    el.appendChild(h);
  }
}

function _renderScore() {
  document.getElementById('score-val').textContent = _score;
}

function _renderAnswerDisplay() {
  const el = document.getElementById('answer-display');
  if (_displayAnswer !== null) { el.textContent = _displayAnswer; return; }
  if (!_slots.length) { el.textContent = ''; return; }
  el.textContent = _slots.map(s => !s.isDigit ? s.char : (s.typed ?? '-')).join('');
}

// ── Question layer bounds ─────────────────────────────────────────────────────

function _updateQLayerBounds() {
  const header = document.getElementById('game-header');
  const numpad = document.getElementById('numpad');
  const hh     = header.offsetHeight;
  const nh     = numpad.offsetHeight;
  const layer  = document.getElementById('question-layer');
  layer.style.top    = hh + 'px';
  layer.style.bottom = nh + 'px';
  _qareaH = window.innerHeight - hh - nh;
}

function _cardEl(id) { return document.getElementById('qcard-' + id); }

// ── Puzzle ────────────────────────────────────────────────────────────────────

function _initPuzzleLayer() {
  const layer = document.getElementById('puzzle-layer');
  layer.innerHTML = '';
  for (let i = 1; i <= PUZZLE_COUNT; i++) {
    const img = document.createElement('img');
    img.id  = 'piece-' + i;
    img.src = `game_assets/puzzle/P${i}.png`;
    img.style.opacity = '1';
    layer.appendChild(img);
  }
  _puzzleVisible = Array.from({length: PUZZLE_COUNT}, (_, i) => i + 1);
}

function _newPuzzleCycle(first = false) {
  _cycleCorrect = 0;
  _bgIndex = _randInt(1, BG_COUNT);
  const pad = String(_bgIndex).padStart(3, '0');
  document.getElementById('bg-layer').style.backgroundImage =
    `url('game_assets/backgrounds/bg_image${pad}.jpg')`;
  _initPuzzleLayer();
  // Accélération uniquement à partir du 2e cycle
  if (!first && SPEED > 0) {
    _spawnInterval = Math.max(MIN_FALL_SECONDS * 1000, _spawnInterval * SPEED_ACCEL);
    _fallSeconds   = _spawnInterval / 1000 * FALL_RATIO;
  }
}

function _removePuzzlePiece() {
  if (!_puzzleVisible.length) return;
  const idx   = _randInt(0, _puzzleVisible.length - 1);
  const piece = _puzzleVisible.splice(idx, 1)[0];
  const img   = document.getElementById('piece-' + piece);
  if (img) img.style.opacity = '0';
}

// ── Spawn / active tracking ───────────────────────────────────────────────────

function _spawnCard(q) {
  const id = ++_qIdSeq;
  const el = document.createElement('div');
  el.id        = 'qcard-' + id;
  el.className = 'cnp-q-card' + (SPEED === 0 ? ' static' : '');
  el.textContent = q.displayStr;
  document.getElementById('question-layer').appendChild(el);
  _cardH = el.offsetHeight || 60;

  if (SPEED === 0) {
    // Centré horizontalement
    el.style.left      = '50%';
    el.style.transform = 'translateX(-50%)';
  } else {
    // Position X aléatoire dans les bornes de l'écran
    const cardW = el.offsetWidth || 160;
    const maxX  = Math.max(0, window.innerWidth - cardW - 8);
    el.style.left = _randInt(8, maxX) + 'px';
  }

  const startY = SPEED === 0 ? null : -(_cardH + 10);
  if (startY !== null) el.style.top = startY + 'px';
  _falling.push({ id, displayStr: q.displayStr, answerStr: q.answerStr, y: startY, wrong: false });
  _refreshActive();
  return id;
}

function _refreshActive() {
  let best = null;
  for (const q of _falling) {
    if (q.wrong) continue;
    if (best === null || (q.y !== null && q.y > (best.y ?? -Infinity))) best = q;
  }
  const newId = best?.id ?? null;
  if (newId === _activeId) return;

  _falling.forEach(q => {
    const el = _cardEl(q.id);
    if (el) el.classList.toggle('active', q.id === newId);
  });
  _activeId = newId;

  const active = _falling.find(q => q.id === newId);
  if (active) {
    _slots = _buildSlots(active.answerStr);
  } else {
    _slots = [];
  }
  _renderAnswerDisplay();
}

function _removeCard(id) {
  const el = _cardEl(id);
  if (el) el.remove();
  _falling = _falling.filter(q => q.id !== id);
}

// ── Game loop ─────────────────────────────────────────────────────────────────

function _startLoop() {
  _lastTs = null;
  _rafId  = requestAnimationFrame(_loop);
}

function _loop(ts) {
  if (_gameOver) return;
  if (_lastTs === null) _lastTs = ts;
  const dt = ts - _lastTs;
  _lastTs  = ts;

  if (SPEED === 0) {
    if (_falling.length === 0 && !_inputLocked) _spawnNext();
    _rafId = requestAnimationFrame(_loop);
    return;
  }

  // Spawn
  if (ts - _lastSpawnTime > _spawnInterval) {
    _spawnNext();
    _lastSpawnTime = ts;
  }

  // Déplacement
  const pxPerMs = _qareaH / (_fallSeconds * 1000);
  for (const q of [..._falling]) {
    if (q.wrong) continue;
    q.y += pxPerMs * dt;
    const el = _cardEl(q.id);
    if (el) el.style.top = q.y + 'px';
    if (q.y > _qareaH) {
      _removeCard(q.id);
      _loseLife();
      _play('wrong');
    }
  }

  _refreshActive();
  _rafId = requestAnimationFrame(_loop);
}

function _spawnNext() {
  const q = _popPool();
  if (q) _spawnCard(q);
}

// ── Input & validation ────────────────────────────────────────────────────────

function _handleInput(key) {
  if (_inputLocked || _gameOver || !_slots.length || _activeId === null) return;
  if (!/^[0-9]$/.test(key)) return;
  const nextSlot = _slots.find(s => s.isDigit && s.typed === null);
  if (!nextSlot) return;
  nextSlot.typed = key;
  _renderAnswerDisplay();
  if (_slotsComplete()) _validate();
}

function _validate() {
  const typed    = _typedAnswer();
  const expected = _expectedAnswer();
  if (typed === expected) _onCorrect();
  else                    _onWrong(expected);
}

function _onCorrect() {
  const answeredText = _expectedAnswer();

  _play('correct');
  _score        += SCORE_PER_CORRECT;
  _totalCorrect += 1;
  _cycleCorrect += 1;
  _renderScore();

  const id = _activeId;
  _removeCard(id);
  _slots    = [];
  _activeId = null;
  _removePuzzlePiece();

  // Afficher la réponse 0.5s sans bloquer
  _displayAnswer = answeredText;
  _renderAnswerDisplay();
  setTimeout(() => { _displayAnswer = null; _renderAnswerDisplay(); }, 500);

  if (_cycleCorrect >= PUZZLE_COUNT) _newPuzzleCycle();

  if (SPEED === 0) {
    _spawnNext();
    _refreshActive();
  }
}

function _onWrong(expected) {
  _play('wrong');
  _totalWrong  += 1;
  _inputLocked  = true;

  const activeQ = _falling.find(q => q.id === _activeId);
  if (!activeQ) { _inputLocked = false; return; }

  activeQ.wrong = true;
  _slots = [];
  _renderAnswerDisplay();

  const el = _cardEl(activeQ.id);
  if (el) {
    el.classList.remove('active');
    el.classList.add('wrong');
    el.textContent = expected;
  }

  _loseLife();
  _requeue({ displayStr: activeQ.displayStr, answerStr: activeQ.answerStr });

  setTimeout(() => {
    _removeCard(activeQ.id);
    _inputLocked = false;
    if (SPEED === 0 && _falling.length === 0) {
      _spawnNext();
    }
    _refreshActive();
  }, WRONG_MS);
}

function _loseLife() {
  if (_gameOver) return;
  _lives = Math.max(0, _lives - 1);
  _renderLives();
  if (_lives <= 0) _endGame();
}

// ── End game ──────────────────────────────────────────────────────────────────

function _endGame() {
  if (_gameOver) return;
  _gameOver = true;
  if (_rafId) { cancelAnimationFrame(_rafId); _rafId = null; }
  _play('gameover');
  const stars = _computeStars();
  _saveScore(stars);
  setTimeout(() => _showResult(stars), 300);
}

function _computeStars() {
  if (_totalCorrect === 0) return 0;
  if (_totalWrong === 0 && SPEED > 0 && _totalCorrect >= PUZZLE_COUNT) return 3;
  if (_totalCorrect >= PUZZLE_COUNT) return 2;
  return 1;
}

function _showResult(stars) {
  const emojis = ['', '👍', '🎉', '🏆'];
  const titles = ['GAME OVER', 'Pas mal !', 'Bien joué !', 'Parfait !'];
  document.getElementById('result-emoji').textContent = emojis[stars];
  document.getElementById('result-title').textContent = titles[stars];
  document.getElementById('result-stars').textContent =
    '★'.repeat(stars) + '☆'.repeat(3 - stars);
  document.getElementById('result-score').textContent =
    _score + ' pts · ' + _totalCorrect + ' bonne' + (_totalCorrect > 1 ? 's' : '') +
    ' · ' + _totalWrong + ' erreur' + (_totalWrong !== 1 ? 's' : '');
  document.getElementById('result-overlay').style.display = 'flex';
}

async function _saveScore(stars) {
  if (!PROFILE_ID) return;
  try {
    const gameTypeId = GAME_CONFIG.game_types[MODE] ?? 0;
    await gameService.saveScore(PROFILE_ID, {
      game_id: 3, level_id: LEVEL_ID, game_type_id: gameTypeId,
      score: _score, stars, speed: SPEED,
    });
    await gameService.updateProgress(PROFILE_ID, LEVEL_ID, gameTypeId, stars, _score);
  } catch(e) { console.warn('[saveScore]', e); }
}

// ── Numpad ────────────────────────────────────────────────────────────────────

function _detectNeedsDecimal() {
  if (_rules.mode === 'list') {
    return _rules.list.questions.some(q => String(q.a).includes(','));
  }
  // Mode computed : échantillonner 60 questions
  for (let i = 0; i < 60; i++) {
    const q = _generateComputed();
    if (!q) break;
    const key = _fmt?.answer_key || 'result';
    const val = key === 'op1' ? q.op1 : key === 'op2' ? q.op2 : q.result;
    if (_num(val).includes(',')) return true;
  }
  return false;
}

function _buildNumpad(showComma) {
  const footer = document.getElementById('numpad');
  footer.innerHTML = '';
  const keys = showComma
    ? ['1','2','3','4','5','6','7','8','9','0',',']
    : ['1','2','3','4','5','6','7','8','9','0'];
  keys.forEach(k => {
    const btn = document.createElement('button');
    btn.className   = 'cnp-numpad-btn';
    btn.textContent = k;
    btn.addEventListener('pointerdown', e => {
      e.preventDefault();
      if (/^[0-9]$/.test(k)) _handleInput(k);
    });
    footer.appendChild(btn);
  });
}

// ── Init ──────────────────────────────────────────────────────────────────────

async function init() {
  try {
    _formats = await fetch('formats.json?v=2').then(r => r.json()).catch(() => []);
    const level = await gameService.getLevelById(LEVEL_ID);
    if (!level?.rules) {
      alert('Niveau non configuré. Ajoutez des règles dans l\'éditeur.');
      location.href = 'index.html';
      return;
    }
    _rules = level.rules;
    _fmt   = _formats.find(f => f.id === _rules.computed?.format_id) || _formats[0] || null;

    _updateQLayerBounds();
    _buildNumpad(_detectNeedsDecimal());
    _renderLives();
    _renderScore();

    if (SPEED > 0) {
      const baseSeconds = SECONDS > 0 ? SECONDS : 8;
      _fallSeconds   = baseSeconds * FALL_RATIO;
      _spawnInterval = baseSeconds * 1000;
    }

    _fillPool(50);
    _newPuzzleCycle(true);

    _showStartOverlay(() => {
      _spawnNext();
      _refreshActive();
      _lastSpawnTime = performance.now();
      _startLoop();
    });

  } catch(e) {
    console.error('[init]', e);
    alert('Erreur : ' + e.message);
    location.href = 'index.html';
  }
}

function _showStartOverlay(onStart) {
  const overlay = document.createElement('div');
  overlay.id = 'start-overlay';
  overlay.innerHTML = `<button id="start-btn">▶ Commencer</button>`;
  document.getElementById('game-layout').appendChild(overlay);
  document.getElementById('start-btn').addEventListener('click', () => {
    overlay.remove();
    onStart();
  });
}

window.onAuthChanged = user => {
  if (!user) { location.href = 'index.html'; return; }
  init();
};

// ── Events ────────────────────────────────────────────────────────────────────

document.addEventListener('keydown', e => {
  if (/^[0-9]$/.test(e.key)) _handleInput(e.key);
});

window.addEventListener('resize', _updateQLayerBounds);

document.getElementById('result-replay').addEventListener('click', () => location.reload());
document.getElementById('exit-btn').addEventListener('click', () => { location.href = 'index.html'; });

(function() {
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
