// editor-firebase-service.js — CliConVocabulary editor service (game-specific)
// Requires: shared/firebase-core.js, shared/platform-methods.js
// Requires: Firebase Storage compat SDK (loaded in editor.html before this file)

const GAME_ID = 2;
const storage = firebase.storage();

const DIFFICULTIES = [
  { id: 1, label: 'Débutant'      },
  { id: 2, label: 'Élémentaire'   },
  { id: 3, label: 'Intermédiaire' },
  { id: 4, label: 'Difficile'     },
];

window.editorService = {
  ..._platformMethods,
  DIFFICULTIES,
  GAME_ID,

  // Aliases used by editor.js (different naming than gameService)
  getProvider:    () => _currentUser?.providerData[0]?.providerId || null,
  reauthPassword: (pw) => _currentUser.reauthenticateWithCredential(
    firebase.auth.EmailAuthProvider.credential(_currentUser.email, pw)
  ),
  reauthGoogle: () => _currentUser.reauthenticateWithPopup(new firebase.auth.GoogleAuthProvider()),

  // ── Families ──────────────────────────────────────────────────────────────

  createFamily: async (name) => {
    const snap   = await db.collection('level_families').orderBy('id', 'desc').limit(1).get();
    const lastId = snap.empty ? 9 : Math.max(9, snap.docs[0].data().id ?? 9);
    const newId  = lastId + 1;
    const now    = new Date().toISOString();
    const data   = {
      id:      newId,
      uuid:    `cv-fam-${newId}-${Date.now()}`,
      game_id: GAME_ID,
      name,
      notes:   '',
      date:    now,
      author:  _currentUser?.email || 'system',
    };
    await db.collection('level_families').doc(String(newId)).set(data);
    return { docId: String(newId), ...data };
  },

  deleteFamily: async (familyDocId) => {
    const levels = await db.collection('levels')
      .where('family_id', '==', Number(familyDocId)).get();
    const batch = db.batch();
    for (const lvl of levels.docs) {
      const words = await lvl.ref.collection('words').get();
      words.docs.forEach(w => batch.delete(w.ref));
      batch.delete(lvl.ref);
    }
    batch.delete(db.collection('level_families').doc(String(familyDocId)));
    await batch.commit();
  },

  // ── Levels ────────────────────────────────────────────────────────────────

  createLevel: async (familyId, familyUuid, name, difficulty, notes = '') => {
    const snap   = await db.collection('levels').orderBy('id', 'desc').limit(1).get();
    const lastId = snap.empty ? 100 : Math.max(100, snap.docs[0].data().id ?? 100);
    const newId  = lastId + 1;
    const now    = new Date().toISOString();
    const data   = {
      id:                  newId,
      uuid:                `cv-lvl-${newId}-${Date.now()}`,
      game_id:             GAME_ID,
      family_id:           Number(familyId),
      family_uuid:         familyUuid,
      name,
      title:               name,
      difficulty,
      notes:               notes || '',
      image_path:          '',
      marker_size:         16,
      arrow_size:          10,
      marker_opacity:      80,
      selected_fill:       '#ffffff',
      selected_stroke:     '#6c5ce7',
      sel_color_override:  false,
      marker_color:        '#000000',
      marker_stroke_color: '#ffffff',
      marker_stroke_width: 2,
      line_style:          'solid',
      arrow_head:          'point',
      date:                now,
      author:              _currentUser?.email || 'system',
    };
    await db.collection('levels').doc(String(newId)).set(data);
    return { docId: String(newId), ...data };
  },

  updateLevelMeta: (levelDocId, fields) =>
    db.collection('levels').doc(String(levelDocId)).update(fields),

  deleteLevel: async (levelDocId) => {
    const ref   = db.collection('levels').doc(String(levelDocId));
    const words = await ref.collection('words').get();
    const batch = db.batch();
    words.docs.forEach(w => batch.delete(w.ref));
    batch.delete(ref);
    await batch.commit();
  },

  // ── Words ─────────────────────────────────────────────────────────────────

  getWords: async (levelDocId) => {
    const snap = await db.collection('levels').doc(String(levelDocId))
      .collection('words').orderBy('order').get();
    return snap.docs.map(d => {
      const data = d.data();
      return {
        docId:      d.id,
        fr:         data.langs?.fr   || '',
        en:         data.langs?.en   || '',
        langs:      data.langs       || {},
        point:      data.point       || null,
        arrows:     data.arrows      || [],
        order:      data.order,
        audio_path: data.audio_path  || '',
        audio_name: data.audio_name  || '',
      };
    });
  },

  saveWords: async (levelDocId, words) => {
    const colRef   = db.collection('levels').doc(String(levelDocId)).collection('words');
    const existing = await colRef.get();
    const batch    = db.batch();
    existing.docs.forEach(d => batch.delete(d.ref));
    words.forEach((w, i) => {
      batch.set(colRef.doc(), {
        langs:      { fr: w.fr || '', en: w.en || '', ...(w.langs || {}) },
        point:      w.point      || null,
        arrows:     w.arrows     || [],
        order:      i,
        audio_path: w.audio_path || '',
        audio_name: w.audio_name || '',
      });
    });
    await batch.commit();
  },

  // ── Audio (Firebase Storage) ──────────────────────────────────────────────

  uploadAudio: async (levelDocId, file) => {
    const ext  = file.name.split('.').pop().toLowerCase();
    const path = `assets/audio/${levelDocId}/${Date.now()}.${ext}`;
    const ref  = storage.ref(path);
    await ref.put(file);
    return await ref.getDownloadURL();
  },

  // ── Image (Firebase Storage) ──────────────────────────────────────────────

  uploadImage: async (levelDocId, file) => {
    const ext  = file.name.split('.').pop().toLowerCase();
    const path = `assets/lists/${levelDocId}.${ext}`;
    const ref  = storage.ref(path);
    await ref.put(file);
    const url = await ref.getDownloadURL();
    await db.collection('levels').doc(String(levelDocId)).update({ image_path: url });
    return url;
  },

  deleteImage: async (levelDocId, imageUrl) => {
    if (!imageUrl) return;
    try { await storage.refFromURL(imageUrl).delete(); } catch (_) {}
    await db.collection('levels').doc(String(levelDocId)).update({ image_path: '' });
  },

  // ── Seed ──────────────────────────────────────────────────────────────────

  seedVocabularyGame: async () => {
    const existing = await db.collection('games').doc('2').get();
    if (existing.exists) return;
    const batch = db.batch();
    batch.set(db.collection('games').doc('2'), {
      id: 2, name: 'CliConVocabulary',
      description: 'Jeu de vocabulaire anglais — trouvez les mots sur l\'image',
      version: '1.0',
    });
    batch.set(db.collection('game_types').doc('10'), {
      id: 10, game_id: 2, name: 'Clic on word',
      notes: 'La question affiche le mot — cliquez sur la zone correspondante',
    });
    batch.set(db.collection('game_types').doc('11'), {
      id: 11, game_id: 2, name: 'Parmi 3',
      notes: 'Une zone est affichée — choisissez le bon mot parmi 3',
    });
    batch.set(db.collection('game_types').doc('12'), {
      id: 12, game_id: 2, name: 'Type the word',
      notes: 'Une zone est affichée — tapez le mot correspondant',
    });
    batch.set(db.collection('game_types').doc('13'), {
      id: 13, game_id: 2, name: 'Listen & click',
      notes: 'L\'audio est joué — cliquez sur la zone correspondante',
    });
    await batch.commit();
  },
};
