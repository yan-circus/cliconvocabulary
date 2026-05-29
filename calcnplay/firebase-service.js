// firebase-service.js — CalcNPlay game service
// Requires: shared/firebase-core.js, shared/platform-methods.js

const GAME_ID = 3;

window.gameService = {
  ..._platformMethods,
  GAME_ID,

  getItemCount: async (levelDocId) => {
    const doc = await db.collection('levels').doc(String(levelDocId)).get();
    if (!doc.exists) return null;
    const rules = doc.data().rules;
    if (!rules) return null;
    if (rules.mode === 'list') return (rules.list?.questions || []).length;
    return null; // computed mode: count is dynamic
  },
};
