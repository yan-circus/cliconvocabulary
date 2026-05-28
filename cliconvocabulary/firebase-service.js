// firebase-service.js — CliConVocabulary game service (game-specific additions)
// Requires: shared/firebase-core.js, shared/platform-methods.js

const GAME_ID = 2;

window.gameService = {
  ..._platformMethods,
  GAME_ID,

  getWords: async (levelDocId) => {
    const snap = await db.collection('levels').doc(String(levelDocId))
      .collection('words').orderBy('order').get();
    return snap.docs.map(d => {
      const data = d.data();
      return {
        docId:      d.id,
        fr:         data.langs?.fr  || '',
        en:         data.langs?.en  || '',
        langs:      data.langs      || {},
        point:      data.point      || null,
        arrows:     data.arrows     || [],
        order:      data.order,
        audio_path: data.audio_path || '',
      };
    });
  },

  getWordCount: async (levelDocId) => {
    const snap = await db.collection('levels').doc(String(levelDocId)).collection('words').get();
    return snap.size;
  },
};
