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

  signUp: async (email, pw, prenom, nom, avatarId) => {
    const cred = await auth.createUserWithEmailAndPassword(email, pw);
    const uid  = cred.user.uid;
    const now  = new Date().toISOString();
    const profileRef = db.collection('profiles').doc();
    const profileId  = profileRef.id;
    const batch = db.batch();
    batch.set(db.collection('users').doc(uid), {
      uid, email, prenom, nom, role: 'solo',
      profile_ids: [profileId], created_at: now,
    });
    batch.set(profileRef, {
      prenom, nom, avatar_id: avatarId, skin_id: 1,
      is_supervisor: true, linked_uid: uid, owner_uid: uid,
      supervisors: { [uid]: 'owner' }, grade: '', class_id: '', created_at: now,
    });
    await batch.commit();
  },

  resetPassword: (email) => auth.sendPasswordResetEmail(email),

  getProfiles: async () => {
    if (!_currentUser) return [];
    const userDoc = await db.collection('users').doc(_currentUser.uid).get();
    if (!userDoc.exists) return [];
    const profileIds = userDoc.data().profile_ids || [];
    if (!profileIds.length) return [];
    const docs = await Promise.all(profileIds.map(id => db.collection('profiles').doc(id).get()));
    return docs.filter(d => d.exists).map(d => ({ id: d.id, ...d.data() }));
  },

  getSupervisorProvider: () => _currentUser?.providerData[0]?.providerId || null,

  reauthWithPassword: (pw) =>
    _currentUser.reauthenticateWithCredential(
      firebase.auth.EmailAuthProvider.credential(_currentUser.email, pw)
    ),

  reauthWithGoogle: () =>
    _currentUser.reauthenticateWithPopup(new firebase.auth.GoogleAuthProvider()),

  createChildProfile: async (prenom, nom, avatarId) => {
    if (!_currentUser) throw new Error('Non connecté');
    const now     = new Date().toISOString();
    const profileRef = db.collection('profiles').doc();
    const profileId  = profileRef.id;
    const userRef    = db.collection('users').doc(_currentUser.uid);
    const userDoc    = await userRef.get();
    if (!userDoc.exists) throw new Error('Compte introuvable');
    const profileIds = userDoc.data().profile_ids || [];
    const batch = db.batch();
    batch.set(profileRef, {
      prenom, nom, avatar_id: avatarId, skin_id: 1,
      is_supervisor: false, linked_uid: null, owner_uid: _currentUser.uid,
      supervisors: { [_currentUser.uid]: 'parent' },
      grade: '', class_id: '', created_at: now,
    });
    batch.update(userRef, { profile_ids: [...profileIds, profileId], role: 'parent' });
    await batch.commit();
    return { id: profileId, prenom, nom, avatar_id: avatarId, is_supervisor: false };
  },

  updateProfileAvatar: (profileId, avatarId) =>
    db.collection('profiles').doc(profileId).update({ avatar_id: avatarId }),

  getUserAccount: async () => {
    if (!_currentUser) return null;
    const doc = await db.collection('users').doc(_currentUser.uid).get();
    return doc.exists ? doc.data() : null;
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
