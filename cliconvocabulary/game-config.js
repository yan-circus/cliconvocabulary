// game-config.js — CliConVocabulary shared configuration

const GAME_CONFIG = {
  game_id: 'cliconvocabulary',

  // Numeric IDs stored in Firestore scores
  game_types: {
    learning:    0,
    findword:    1,
    chooseword:  2,
    typeword:    3,
    listenclick: 4,
  },

  // Seconds allowed per question in chrono mode, by game type
  chrono_s: {
    findword:    8,
    chooseword:  5,
    typeword:    20,
    listenclick: 5,
  },

  // 3-star threshold: score must exceed (this value × nb_questions)
  // with chrono active and 0 lives lost
  score3_per_question: 500,

  // Difficulty levels (id stored as integer in levels.difficulty)
  difficulties: [
    { id: 1, label: 'Débutant'      },
    { id: 2, label: 'Élémentaire'   },
    { id: 3, label: 'Intermédiaire' },
    { id: 4, label: 'Difficile'     },
  ],
};

// Shared SVG icons (stroke="currentColor" — inherit text color)
const ICONS = {
  speaker: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
  </svg>`,
};
