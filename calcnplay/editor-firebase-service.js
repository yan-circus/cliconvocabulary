// editor-firebase-service.js — CalcNPlay editor service
// Requires: shared/firebase-core.js, shared/platform-methods.js, shared/editor-platform-methods.js

const GAME_ID = 3;

const DIFFICULTIES = [
  { id: 1, label: 'Débutant'      },
  { id: 2, label: 'Élémentaire'   },
  { id: 3, label: 'Intermédiaire' },
  { id: 4, label: 'Difficile'     },
];

window.editorService = {
  ..._platformMethods,
  ..._editorPlatformMethods,
  DIFFICULTIES,
  GAME_ID,
  GAME_NAME: 'CalcNPlay',

  // Aliases auth
  getProvider:    () => _currentUser?.providerData[0]?.providerId || null,
  reauthPassword: (pw) => _currentUser.reauthenticateWithCredential(
    firebase.auth.EmailAuthProvider.credential(_currentUser.email, pw)
  ),
  reauthGoogle: () => _currentUser.reauthenticateWithPopup(new firebase.auth.GoogleAuthProvider()),

  // ── Families ──────────────────────────────────────────────────────────────

  createFamily: async (name) => {
    const newId = await _editorNextFamilyId();
    const now   = new Date().toISOString();
    const data  = {
      id:      newId,
      uuid:    `cnp-fam-${newId}-${Date.now()}`,
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
    levels.docs.forEach(lvl => batch.delete(lvl.ref));
    batch.delete(db.collection('level_families').doc(String(familyDocId)));
    await batch.commit();
  },

  // ── Levels ────────────────────────────────────────────────────────────────

  createLevel: async (familyId, familyUuid, name, difficulty, notes = '') => {
    const newId = await _editorNextLevelId();
    const now   = new Date().toISOString();
    const data  = {
      id:          newId,
      uuid:        `cnp-lvl-${newId}-${Date.now()}`,
      game_id:     GAME_ID,
      family_id:   Number(familyId),
      family_uuid: familyUuid,
      name,
      title:       name,
      difficulty,
      notes:       notes || '',
      valid:       false,
      rules:       null,
      date:        now,
      author:      _currentUser?.email || 'system',
    };
    await db.collection('levels').doc(String(newId)).set(data);
    return { docId: String(newId), ...data };
  },

  deleteLevel: async (levelDocId) => {
    await db.collection('levels').doc(String(levelDocId)).delete();
  },
};
