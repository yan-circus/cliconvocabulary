// shared/editor-platform-methods.js — Firestore helpers shared by all game editors
// Requires: firebase-core.js (provides db, _currentUser)

async function _editorNextFamilyId() {
  const snap = await db.collection('level_families').orderBy('id', 'desc').limit(1).get();
  return snap.empty ? 10 : Math.max(9, snap.docs[0].data().id ?? 9) + 1;
}

async function _editorNextLevelId() {
  const snap = await db.collection('levels').orderBy('id', 'desc').limit(1).get();
  return snap.empty ? 101 : Math.max(100, snap.docs[0].data().id ?? 100) + 1;
}

const _editorPlatformMethods = {
  updateLevelMeta: (levelDocId, fields) =>
    db.collection('levels').doc(String(levelDocId)).set(fields, { merge: true }),
};
