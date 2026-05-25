// game-config.js — CliConVocabulary shared configuration

const GAME_CONFIG = {
  game_id: 'cliconvocabulary',

  // Numeric IDs stored in Firestore scores
  game_types: {
    learning: 0,
    clicword: 1,
    parmi3:   2,
    typeword: 3,
  },

  // Seconds allowed per question in chrono mode, by game type
  chrono_s: {
    clicword: 8,
    parmi3:   10,
    typeword: 20,
  },

  // 3-star threshold: score must exceed (this value × nb_questions)
  // with chrono active and 0 lives lost
  score3_per_question: 500,
};
