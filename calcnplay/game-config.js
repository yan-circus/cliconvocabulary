// game-config.js — CalcNPlay shared configuration

const GAME_CONFIG = {
  game_id: 'calcnplay',
  name:    'CalcNPlay',

  // Mode metadata — used by shared/index.js
  modes: [
    { slug: 'calcul', id: 0, icon: '🧮', label: 'Calcul mental',
      speed_levels: [
        { level: 0, label: 'Sans chrono', seconds: 0   },
        { level: 1, label: 'Très lent',   seconds: 13  },
        { level: 2, label: 'Lent',        seconds: 5   },
        { level: 3, label: 'Normal',      seconds: 2.5 },
        { level: 4, label: 'Rapide',      seconds: 2.0 },
        { level: 5, label: 'Très rapide', seconds: 1.5 },
      ],
      audio_required: false, score_tracking: true },
  ],

  // Backward compat — used by game.js
  game_types: { calcul: 0 },

  score3_per_question: 500,

  ui: {
    level_display:  'thumbnail',
    audio:          false,
    difficulty:     false,
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
