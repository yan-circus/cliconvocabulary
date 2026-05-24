// firebase-service.js — read-only game service

const firebaseConfig = {
  apiKey:            'AIzaSyDz1xCHbgqWsmhp1H5bia8smICmjBbi3uc',
  authDomain:        'ludoedu-fea1d.firebaseapp.com',
  projectId:         'ludoedu-fea1d',
  storageBucket:     'ludoedu-fea1d.firebasestorage.app',
  messagingSenderId: '595877165459',
  appId:             '1:595877165459:web:8e0fbd53344e3d7f899066',
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db   = firebase.firestore();

const GAME_ID = 2;

let _currentUser = null;

auth.onAuthStateChanged(user => {
  _currentUser = user;
  if (typeof window.onGameAuthChanged === 'function') window.onGameAuthChanged(user);
});

window.gameService = {

  GAME_ID,

  getUser:          () => _currentUser,
  signIn:           (email, pw) => auth.signInWithEmailAndPassword(email, pw),
  signOut:          () => auth.signOut(),
  signInWithGoogle: () => auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()),

  getUserAccount: async () => {
    if (!_currentUser) return null;
    const doc = await db.collection('users').doc(_currentUser.uid).get();
    return doc.exists ? doc.data() : null;
  },

  isSupervisor: async () => {
    const acc = await gameService.getUserAccount().catch(() => null);
    return !!(acc?.role === 'parent');
  },

  getFamilies: async () => {
    const snap = await db.collection('level_families')
      .where('game_id', '==', GAME_ID).get();
    return snap.docs.map(d => ({ docId: d.id, ...d.data() })).sort((a, b) => a.id - b.id);
  },

  getLevels: async (familyId) => {
    const snap = await db.collection('levels')
      .where('game_id', '==', GAME_ID)
      .where('family_id', '==', Number(familyId)).get();
    return snap.docs.map(d => ({ docId: d.id, ...d.data() })).sort((a, b) => a.id - b.id);
  },

  getWords: async (levelDocId) => {
    const snap = await db.collection('levels').doc(String(levelDocId))
      .collection('words').orderBy('order').get();
    return snap.docs.map(d => {
      const data = d.data();
      return {
        docId:  d.id,
        fr:     data.langs?.fr || '',
        en:     data.langs?.en || '',
        langs:  data.langs     || {},
        point:  data.point     || null,
        arrows: data.arrows    || [],
        order:  data.order,
      };
    });
  },

  getLevelById: async (levelDocId) => {
    const doc = await db.collection('levels').doc(String(levelDocId)).get();
    return doc.exists ? { docId: doc.id, ...doc.data() } : null;
  },
};
