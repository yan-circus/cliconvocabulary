// editor.js — CalcNPlay Level Editor

const LEVEL_ID       = new URLSearchParams(location.search).get('level');
const COEF_PRESETS   = [0.1, 1, 10, 100, 1000];
const MAX_GEN_TRIES  = 500;
const OP_SYMBOLS     = { '+': '+', '-': '−', '*': '×', '/': '÷' };
const FEEDBACK_DELAY = 1800; // ms

let _formats     = [];
let _rules       = null;
let _isDirty     = false;
let _testQ       = null;   // question courante dans le test
let _testSlots   = [];     // [{char, isDigit, typed}]
let _testLocked  = false;  // bloque l'input pendant le feedback
let _testActive  = false;  // section test active (clavier écouté)

// ── Auth ──────────────────────────────────────────────────────────────────────

window.onAuthChanged = user => {
  if (!user) { location.href = '../shared/editor_manager.html?game=calcnplay'; return; }
  if (!LEVEL_ID) { location.href = '../shared/editor_manager.html?game=calcnplay'; return; }
  init();
};

// ── Init ──────────────────────────────────────────────────────────────────────

async function init() {
  try {
    _formats = await fetch('formats.json').then(r => r.json()).catch(() => []);
    if (!_formats.length) { alert('Impossible de charger formats.json'); return; }

    const level = await editorService.getLevelById(LEVEL_ID);
    if (!level) { alert('Niveau introuvable.'); history.back(); return; }

    document.getElementById('editor-title').textContent = level.title || level.name;
    document.title = (level.title || level.name) + ' — CalcNPlay Éditeur';

    _rules = level.rules ? JSON.parse(JSON.stringify(level.rules)) : _defaultRules();

    _populateFormatSelect();
    _renderAll();
    generateExamples();
    _nextTestQuestion();
  } catch (err) {
    alert('Erreur de chargement : ' + err.message);
    history.back();
  }
}

function _defaultRules() {
  return {
    mode: 'computed',
    computed: {
      a:          { min: 1, max: 10, coef: 1 },
      b:          { min: 1, max: 10, coef: 1 },
      operators:  ['+'],
      result:     { min: null, max: null },
      format_id:  'default',
    },
    list: { questions: [] },
  };
}

function _populateFormatSelect() {
  const sel = document.getElementById('format-select');
  sel.innerHTML = '';
  _formats.forEach(f => {
    const opt = document.createElement('option');
    opt.value = f.id; opt.textContent = f.label;
    sel.appendChild(opt);
  });
}

// ── Render ────────────────────────────────────────────────────────────────────

function _renderAll() {
  const mode = _rules.mode;
  document.getElementById('mode-computed-btn').classList.toggle('active', mode === 'computed');
  document.getElementById('mode-list-btn').classList.toggle('active', mode === 'list');
  document.getElementById('computed-settings').style.display = mode === 'computed' ? '' : 'none';
  document.getElementById('list-settings').style.display     = mode === 'list'     ? '' : 'none';

  if (mode === 'computed') _renderComputed();
  else                     _renderList();
}

function _renderComputed() {
  const c = _rules.computed;
  document.getElementById('a-min').value = c.a.min;
  document.getElementById('a-max').value = c.a.max;
  document.getElementById('b-min').value = c.b.min;
  document.getElementById('b-max').value = c.b.max;
  _renderCoef('a', c.a.coef);
  _renderCoef('b', c.b.coef);

  ['+', '-', '*', '/'].forEach(op => {
    document.getElementById('op-' + op).checked = c.operators.includes(op);
  });

  document.getElementById('result-min').value = c.result.min ?? '';
  document.getElementById('result-max').value = c.result.max ?? '';
  document.getElementById('format-select').value = c.format_id;

  _renderFormulaPreview();
}

function _renderCoef(operand, coef) {
  const sel = document.getElementById(operand + '-coef-select');
  const inp = document.getElementById(operand + '-coef-custom');
  const isPreset = COEF_PRESETS.includes(coef);
  sel.value = isPreset ? String(coef) : 'custom';
  inp.style.display = isPreset ? 'none' : '';
  if (!isPreset) inp.value = coef;
}

function _renderFormulaPreview() {
  const c   = _rules.computed;
  const el  = document.getElementById('formula-preview');
  if (!c.operators.length) {
    el.innerHTML = '<em class="preview-empty">Aucun opérateur sélectionné.</em>';
    return;
  }

  const fmt = _formats.find(f => f.id === c.format_id);
  let html = '<table class="preview-table"><thead><tr>'
    + '<th>Op</th><th>Formule générateur</th><th>Exemple complet</th><th>Vue joueur</th>'
    + '</tr></thead><tbody>';

  c.operators.forEach(op => {
    // Valeur exemple : milieu de la plage
    const aMid = Math.round((c.a.min + c.a.max) / 2) * c.a.coef;
    const bMid = Math.round((c.b.min + c.b.max) / 2) * c.b.coef;
    const q    = _computeQ(op, aMid, bMid);

    const formulaStr = _opFormula(op);
    const fullStr    = _num(q.op1) + ' ' + q.opSymbol + ' ' + _num(q.op2) + ' = ' + _num(q.result);
    const playerStr  = _renderTemplate(fmt?.template || '{op1} {op} {op2} = {?}',
      q, fmt?.placeholder_display || '?');

    html += `<tr>
      <td class="preview-op">${OP_SYMBOLS[op]}</td>
      <td class="preview-formula">${formulaStr}</td>
      <td class="preview-full">${fullStr}</td>
      <td class="preview-player">${playerStr}</td>
    </tr>`;
  });

  el.innerHTML = html + '</tbody></table>';
}

function _opFormula(op) {
  switch (op) {
    case '+': return 'a + b';
    case '-': return '(a+b) − b';
    case '*': return 'a × b';
    case '/': return '(a×b) ÷ b';
  }
}

function _renderList() {
  const tbody = document.getElementById('questions-tbody');
  tbody.innerHTML = '';
  _rules.list.questions.forEach((q, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input class="list-q-input" type="text" value="${esc(q.q)}" placeholder="ex: 12 + 5"></td>
      <td><input class="list-a-input" type="text" value="${esc(q.a)}" placeholder="ex: 17"></td>
      <td><button class="icon-btn danger">✕</button></td>
    `;
    tr.querySelector('.list-q-input').addEventListener('input', e => {
      _rules.list.questions[i].q = e.target.value; _markDirty();
    });
    tr.querySelector('.list-a-input').addEventListener('input', e => {
      _rules.list.questions[i].a = e.target.value; _markDirty();
    });
    tr.querySelector('.icon-btn').addEventListener('click', () => {
      _rules.list.questions.splice(i, 1);
      _markDirty(); _renderList(); generateExamples(); _nextTestQuestion();
    });
    tbody.appendChild(tr);
  });
}

// ── Question generation ───────────────────────────────────────────────────────

function _computeQ(op, a, b) {
  switch (op) {
    case '+': return { op1: a,          op2: b, opSymbol: '+', result: _round(a + b) };
    case '-': return { op1: _round(a+b), op2: b, opSymbol: '−', result: a };
    case '*': return { op1: a,          op2: b, opSymbol: '×', result: _round(a * b) };
    case '/': return { op1: _round(a*b), op2: b, opSymbol: '÷', result: a };
  }
}

function generateQuestion() {
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
  return null; // règles trop contraignantes
}

// ── Template rendering ────────────────────────────────────────────────────────

function _renderTemplate(template, q, placeholderDisplay) {
  // Pour la prévisualisation : {?} → placeholder_display (ex: "?" ou "...")
  return template
    .replace('{op1}',   _num(q.op1))
    .replace('{op2}',   _num(q.op2))
    .replace('{op}',    q.opSymbol)
    .replace('{result}',_num(q.result))
    .replace('{?}',     placeholderDisplay || '?');
}

function _renderFull(template, q, answerKey) {
  // Pour la liste d'exemples : {?} → valeur réelle
  const answerVal = answerKey === 'op1' ? q.op1 : answerKey === 'op2' ? q.op2 : q.result;
  return template
    .replace('{op1}',   _num(q.op1))
    .replace('{op2}',   _num(q.op2))
    .replace('{op}',    q.opSymbol)
    .replace('{result}',_num(q.result))
    .replace('{?}',     _num(answerVal));
}

// ── Example list ──────────────────────────────────────────────────────────────

function generateExamples() {
  const list = document.getElementById('example-list');
  list.innerHTML = '';
  const count = parseInt(document.getElementById('example-count-select').value) || 20;

  if (_rules.mode === 'list') {
    if (!_rules.list.questions.length) {
      list.innerHTML = '<div class="ex-empty">Aucune question définie.</div>';
      return;
    }
    _rules.list.questions.forEach(q => {
      const div = document.createElement('div');
      div.className = 'example-item';
      div.innerHTML = `<span class="ex-q">${esc(q.q)}</span><span class="ex-a">${esc(q.a)}</span>`;
      list.appendChild(div);
    });
    return;
  }

  const fmt = _formats.find(f => f.id === _rules.computed.format_id);
  for (let i = 0; i < count; i++) {
    const q = generateQuestion();
    if (!q) {
      list.innerHTML = '<div class="ex-empty">Règles trop contraignantes — aucune question possible.</div>';
      return;
    }
    const questionStr = _renderTemplate(
      fmt?.template || '{op1} {op} {op2} = {?}', q, fmt?.placeholder_display || '?');
    const answerKey = fmt?.answer_key || 'result';
    const answerVal = answerKey === 'op1' ? q.op1 : answerKey === 'op2' ? q.op2 : q.result;
    const div = document.createElement('div');
    div.className = 'example-item';
    div.innerHTML = `<span class="ex-q">${questionStr}</span><span class="ex-a">${_num(answerVal)}</span>`;
    list.appendChild(div);
  }
}

// ── Test zone ─────────────────────────────────────────────────────────────────

function _nextTestQuestion() {
  _testLocked = false;
  const qEl   = document.getElementById('test-question');
  const fbEl  = document.getElementById('test-feedback');
  fbEl.textContent = '';
  fbEl.className   = 'test-feedback';

  if (_rules.mode === 'computed') {
    _testQ = generateQuestion();
  } else {
    const qs = _rules.list.questions;
    _testQ = qs.length ? qs[Math.floor(Math.random() * qs.length)] : null;
  }

  if (!_testQ) {
    qEl.innerHTML = '<em>Aucune question disponible.</em>';
    _testSlots = [];
    return;
  }

  _buildTestSlots();
  _renderTestQuestionV2();
}

function _buildTestSlots() {
  let answerStr;
  if (_testQ.q !== undefined) {
    // mode list
    answerStr = String(_testQ.a);
  } else {
    const fmt = _formats.find(f => f.id === _rules.computed.format_id);
    const key = fmt?.answer_key || 'result';
    const val = key === 'op1' ? _testQ.op1 : key === 'op2' ? _testQ.op2 : _testQ.result;
    answerStr = _num(val);
  }

  _testSlots = answerStr.split('').map(c => ({
    char: c,
    isDigit: /[0-9]/.test(c),
    typed: null,
  }));
}

function _renderTestQuestionV2() {
  const qEl = document.getElementById('test-question');

  if (_testQ.q !== undefined) {
    // mode list: show question, then slots
    const slotsHtml = _buildSlotsHtml();
    qEl.innerHTML = esc(_testQ.q) + ' = ' + slotsHtml;
    return;
  }

  const fmt      = _formats.find(f => f.id === _rules.computed.format_id);
  const template = fmt?.template || '{op1} {op} {op2} = {?}';

  // Split template at {?}
  const parts = template.split('{?}');
  const before = parts[0]
    .replace('{op1}',    _num(_testQ.op1))
    .replace('{op2}',    _num(_testQ.op2))
    .replace('{op}',     _testQ.opSymbol)
    .replace('{result}', _num(_testQ.result));
  const after = (parts[1] || '')
    .replace('{op1}',    _num(_testQ.op1))
    .replace('{op2}',    _num(_testQ.op2))
    .replace('{op}',     _testQ.opSymbol)
    .replace('{result}', _num(_testQ.result));

  qEl.innerHTML = before + _buildSlotsHtml() + after;
}

function _buildSlotsHtml() {
  return '<span class="test-slots">' +
    _testSlots.map(s => {
      if (!s.isDigit) return `<span class="slot-sep">${s.char}</span>`;
      const cls = s.typed !== null ? 'slot filled' : 'slot empty';
      return `<span class="${cls}">${s.typed ?? '·'}</span>`;
    }).join('') +
  '</span>';
}

function _handleTestKey(key) {
  if (_testLocked || !_testSlots.length) return;

  if (key === 'Backspace') {
    for (let i = _testSlots.length - 1; i >= 0; i--) {
      if (_testSlots[i].isDigit && _testSlots[i].typed !== null) {
        _testSlots[i].typed = null;
        _renderTestQuestionV2();
        return;
      }
    }
    return;
  }

  if (!/^[0-9]$/.test(key)) return;

  const nextEmpty = _testSlots.find(s => s.isDigit && s.typed === null);
  if (!nextEmpty) return;

  nextEmpty.typed = key;
  _renderTestQuestionV2();

  // Valider si tous les slots digit sont remplis
  if (_testSlots.every(s => !s.isDigit || s.typed !== null)) {
    _validateTestAnswer();
  }
}

function _validateTestAnswer() {
  _testLocked = true;
  const typed    = _testSlots.map(s => s.isDigit ? s.typed : s.char).join('');
  const expected = _testSlots.map(s => s.char).join('');
  const correct  = typed === expected;

  const fbEl = document.getElementById('test-feedback');
  fbEl.textContent = correct ? '✓ Correct !' : '✗ Incorrect — réponse : ' + expected;
  fbEl.className   = 'test-feedback ' + (correct ? 'correct' : 'wrong');

  setTimeout(_nextTestQuestion, FEEDBACK_DELAY);
}

// ── Save ──────────────────────────────────────────────────────────────────────

async function saveLevel() {
  const btn = document.getElementById('save-btn');
  btn.disabled = true; btn.textContent = '…';
  try {
    await editorService.updateLevelMeta(LEVEL_ID, {
      rules: _rules,
      valid: _isValid(),
    });
    _isDirty = false;
    btn.textContent = '✓ Sauvegardé';
    setTimeout(() => { btn.textContent = 'Sauvegarder'; }, 2000);
  } catch (err) {
    alert('Erreur lors de la sauvegarde : ' + err.message);
  } finally {
    btn.disabled = false;
  }
}

function _isValid() {
  if (_rules.mode === 'computed') return _rules.computed.operators.length > 0;
  return _rules.list.questions.length > 0;
}

function _markDirty() { _isDirty = true; }

function backToManager() {
  if (!_isDirty) { history.back(); return; }
  const choice = confirm('Des modifications n\'ont pas été sauvegardées.\nSauvegarder avant de quitter ?');
  if (choice === true)  saveLevel().then(() => { _isDirty = false; history.back(); });
  if (choice === false) { _isDirty = false; history.back(); }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function _randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function _round(n)          { return Math.round(n * 10000) / 10000; }

function _num(n) {
  const s = String(_round(n));
  return s.replace('.', ',');
}

function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Event listeners ───────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {

  // Header
  document.getElementById('back-btn').addEventListener('click', backToManager);
  document.getElementById('save-btn').addEventListener('click', saveLevel);

  // Mode toggle
  document.getElementById('mode-computed-btn').addEventListener('click', () => {
    _rules.mode = 'computed'; _markDirty(); _renderAll(); generateExamples(); _nextTestQuestion();
  });
  document.getElementById('mode-list-btn').addEventListener('click', () => {
    _rules.mode = 'list'; _markDirty(); _renderAll(); generateExamples(); _nextTestQuestion();
  });

  // Operand a
  document.getElementById('a-min').addEventListener('input', e => {
    _rules.computed.a.min = parseInt(e.target.value) || 0; _markDirty(); _renderFormulaPreview(); generateExamples();
  });
  document.getElementById('a-max').addEventListener('input', e => {
    _rules.computed.a.max = parseInt(e.target.value) || 0; _markDirty(); _renderFormulaPreview(); generateExamples();
  });
  _setupCoef('a');

  // Operand b
  document.getElementById('b-min').addEventListener('input', e => {
    _rules.computed.b.min = parseInt(e.target.value) || 0; _markDirty(); _renderFormulaPreview(); generateExamples();
  });
  document.getElementById('b-max').addEventListener('input', e => {
    _rules.computed.b.max = parseInt(e.target.value) || 0; _markDirty(); _renderFormulaPreview(); generateExamples();
  });
  _setupCoef('b');

  // Operators
  ['+', '-', '*', '/'].forEach(op => {
    document.getElementById('op-' + op).addEventListener('change', e => {
      if (e.target.checked) {
        if (!_rules.computed.operators.includes(op)) _rules.computed.operators.push(op);
      } else {
        _rules.computed.operators = _rules.computed.operators.filter(o => o !== op);
      }
      _markDirty(); _renderFormulaPreview(); generateExamples(); _nextTestQuestion();
    });
  });

  // Result constraints
  document.getElementById('result-min').addEventListener('input', e => {
    _rules.computed.result.min = e.target.value !== '' ? parseFloat(e.target.value) : null;
    _markDirty(); generateExamples(); _nextTestQuestion();
  });
  document.getElementById('result-max').addEventListener('input', e => {
    _rules.computed.result.max = e.target.value !== '' ? parseFloat(e.target.value) : null;
    _markDirty(); generateExamples(); _nextTestQuestion();
  });

  // Format
  document.getElementById('format-select').addEventListener('change', e => {
    _rules.computed.format_id = e.target.value;
    _markDirty(); _renderFormulaPreview(); generateExamples(); _nextTestQuestion();
  });

  // Example count + regenerate
  document.getElementById('example-count-select').addEventListener('change', generateExamples);
  document.getElementById('regenerate-btn').addEventListener('click', generateExamples);

  // Add question (list mode)
  document.getElementById('add-question-btn').addEventListener('click', () => {
    _rules.list.questions.push({ q: '', a: '' });
    _markDirty(); _renderList(); generateExamples();
  });

  // Test reset
  document.getElementById('test-reset-btn').addEventListener('click', _nextTestQuestion);

  // Activation de la zone de test au clic
  const testSection = document.querySelector('.test-section');
  testSection.addEventListener('click', e => {
    if (e.target.closest('#test-reset-btn')) return; // le bouton reset gère son propre clic
    _testActive = true;
    testSection.classList.add('active');
  });
  document.addEventListener('click', e => {
    if (!testSection.contains(e.target)) {
      _testActive = false;
      testSection.classList.remove('active');
    }
  });

  // Keyboard input pour la zone de test (seulement si active)
  document.addEventListener('keydown', e => {
    if (!_testActive) return;
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    _handleTestKey(e.key);
  });

  // Escape → back
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') backToManager();
  });
});

function _setupCoef(operand) {
  const sel = document.getElementById(operand + '-coef-select');
  const inp = document.getElementById(operand + '-coef-custom');

  sel.addEventListener('change', e => {
    if (e.target.value === 'custom') {
      inp.style.display = '';
      inp.focus();
    } else {
      inp.style.display = 'none';
      _rules.computed[operand].coef = parseFloat(e.target.value);
      _markDirty(); _renderFormulaPreview(); generateExamples();
    }
  });

  inp.addEventListener('input', e => {
    const v = parseFloat(e.target.value);
    if (v > 0) {
      _rules.computed[operand].coef = v;
      _markDirty(); _renderFormulaPreview(); generateExamples();
    }
  });
}
