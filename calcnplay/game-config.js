// game-config.js — CalcNPlay shared configuration

const GAME_CONFIG = {
  game_id: 'calcnplay',
  name:    'CalcNPlay',

  // Mode metadata — used by shared/index.js
  modes: [
    { slug: 'calcul', id: 0, icon: '🧮', label: 'Calcul mental', chrono_s: 10, audio_required: false, score_tracking: true },
  ],

  // Backward compat — used by game.js
  game_types: { calcul: 0 },
  chrono_s:   { calcul: 10 },

  score3_per_question: 500,

  difficulties: [
    { id: 1, label: 'CP'  },
    { id: 2, label: 'CE1' },
    { id: 3, label: 'CE2' },
    { id: 4, label: 'CM1' },
    { id: 5, label: 'CM2' },
  ],

  ui: {
    level_display:  'list',   // 'thumbnail' | 'list'
    audio:          false,
    chrono:         true,
    difficulty:     true,
    access_control: false,
    item_label:     'question',
  },

  help_sections: [
    { title: '🧮 Calcul mental', text: 'Répondez aux questions de calcul le plus vite possible. Saisissez votre réponse au clavier numérique.' },
    { title: '⏱ Chrono',        text: 'Activez le chrono pour gagner plus de points (jusqu\'à 1 000 par bonne réponse rapide). Sans chrono : 100 points fixes. 3 vies par partie.' },
    { title: '🎓 Difficulté',   text: 'Filtrez les niveaux par année scolaire : du CP au CM2.' },
    { title: '★ Étoiles',       text: '★☆☆ Terminé  ·  ★★☆ Sans perdre de vie  ·  ★★★ Sans vie perdue + chrono + score > 500 pts × nb questions.' },
  ],
};

const ICONS = {};
