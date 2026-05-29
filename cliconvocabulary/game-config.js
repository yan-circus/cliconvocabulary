// game-config.js — CliConVocabulary shared configuration

const GAME_CONFIG = {
  game_id: 'cliconvocabulary',
  name:    'CliConVocabulary',

  // Mode metadata — used by shared/index.js
  modes: [
    { slug: 'learning',    id: 0, icon: '📖', label: 'Apprentissage',   chrono_s: null, audio_required: false, score_tracking: false },
    { slug: 'findword',    id: 1, icon: '👆', label: 'Find the word',   chrono_s: 8,    audio_required: false, score_tracking: true  },
    { slug: 'chooseword',  id: 2, icon: '🔤', label: 'Choose the word', chrono_s: 5,    audio_required: false, score_tracking: true  },
    { slug: 'typeword',    id: 3, icon: '⌨',  label: 'Type the word',   chrono_s: 20,   audio_required: false, score_tracking: true  },
    { slug: 'listenclick', id: 4, icon: '🔊', label: 'Listen & click',  chrono_s: 5,    audio_required: true,  score_tracking: true  },
  ],

  // Backward compat — used by game.js
  game_types: { learning: 0, findword: 1, chooseword: 2, typeword: 3, listenclick: 4 },
  chrono_s:   { findword: 8, chooseword: 5, typeword: 20, listenclick: 5 },

  score3_per_question: 500,

  difficulties: [
    { id: 1, label: 'Débutant'      },
    { id: 2, label: 'Élémentaire'   },
    { id: 3, label: 'Intermédiaire' },
    { id: 4, label: 'Difficile'     },
  ],

  ui: {
    level_display:  'thumbnail',  // 'thumbnail' | 'list'
    audio:          true,
    chrono:         true,
    difficulty:     false,
    access_control: true,
    item_label:     'mot',
  },

  help_sections: [
    { title: '📖 Apprentissage',    text: 'Explorez le vocabulaire librement. Cliquez sur un mot dans la liste pour voir son point sur l\'image, ou cliquez sur un point pour retrouver le mot.' },
    { title: '👆 Find the word',    text: 'Un mot s\'affiche. Cliquez sur le bon point dans l\'image. En cas d\'erreur, la bonne réponse se met en évidence et la question est reposée.' },
    { title: '⌨ Type the word',     text: 'Un point est mis en évidence dans l\'image. Tapez le mot anglais correspondant.' },
    { title: '🔤 Choose the word',  text: 'Un point est mis en évidence. Choisissez le bon mot parmi 3 propositions.' },
    { title: '🔊 Listen & click',   text: 'Écoutez le mot et cliquez sur le bon point. Le son doit être activé.' },
    { title: '⏱ Chrono',           text: 'Activez le chrono pour gagner plus de points (jusqu\'à 1 000 par bonne réponse rapide). Sans chrono : 100 points fixes. 3 vies par partie.' },
    { title: '★ Étoiles',          text: '★☆☆ Terminé  ·  ★★☆ Sans perdre de vie  ·  ★★★ Sans vie perdue + chrono + score > 500 pts × nb mots. Le mode Apprentissage ne donne pas d\'étoiles.' },
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
