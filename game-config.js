// game-config.js — CliConVocabulary shared configuration

const GAME_CONFIG = {
  game_id: 'cliconvocabulary',

  // Numeric IDs stored in Firestore scores
  game_types: {
    learning: 0,
    findword: 1,
    chooseword:   2,
    typeword: 3,
  },

  // Seconds allowed per question in chrono mode, by game type
  chrono_s: {
    findword:   8,
    chooseword: 5,
    typeword:   20,
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
