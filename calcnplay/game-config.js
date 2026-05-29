// game-config.js — CalcNPlay shared configuration

const GAME_CONFIG = {
  game_id: 'calcnplay',

  game_types: {
    learning:    0,
    chooseword:  2,
    typeword:    3,
  },

  chrono_s: {
    chooseword: 10,
    typeword:   20,
  },

  score3_per_question: 500,

  difficulties: [
    { id: 1, label: 'Débutant'      },
    { id: 2, label: 'Élémentaire'   },
    { id: 3, label: 'Intermédiaire' },
    { id: 4, label: 'Difficile'     },
  ],
};

const ICONS = {
  speaker: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
  </svg>`,
};
