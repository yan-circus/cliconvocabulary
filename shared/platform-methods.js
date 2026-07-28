// shared/platform-methods.js — auth, profiles, levels, progress
// Requires: firebase-core.js loaded first.
// Requires: GAME_ID (integer) defined in the game-specific file.
// Requires: GAME_CONFIG.game_id (string slug) for progress — available on game pages.

const _platformMethods = {

  // ── Auth ────────────────────────────────────────────────────────────────────

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

  // ── Profiles ─────────────────────────────────────────────────────────────────

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
    const now        = new Date().toISOString();
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

  deleteChildProfile: async (profileId) => {
    if (!_currentUser) throw new Error('Non connecté');
    const userRef = db.collection('users').doc(_currentUser.uid);
    const userDoc = await userRef.get();
    const profileIds = (userDoc.data()?.profile_ids || []).filter(id => id !== profileId);
    const batch = db.batch();
    batch.update(userRef, { profile_ids: profileIds });
    batch.delete(db.collection('profiles').doc(profileId));
    await batch.commit();
  },

  updateProfileFields:      (profileId, fields)       => db.collection('profiles').doc(profileId).update(fields),
  updateProfileAvatar:      (profileId, avatarId)     => db.collection('profiles').doc(profileId).update({ avatar_id: avatarId }),
  updateDeniedLevels:       (profileId, deniedLevels) => db.collection('profiles').doc(profileId).update({ denied_levels: deniedLevels }),
  updateShowLockedSetting:  (profileId, showLocked)   => db.collection('profiles').doc(profileId).update({ show_locked_levels: showLocked }),
  updateSupervisorSettings: (profileId, settings)     => db.collection('profiles').doc(profileId).update(settings),

  getUserAccount: async () => {
    if (!_currentUser) return null;
    const doc = await db.collection('users').doc(_currentUser.uid).get();
    return doc.exists ? doc.data() : null;
  },

  // Rôle "dev" (users/{uid}.is_dev) : seul compte autorisé à créer/modifier les niveaux
  // standard. Pas de Firestore security rule derrière pour l'instant (juste un contrôle
  // côté UI) — cohérent avec le fait qu'il n'y a pas encore de rules réelles pour
  // owner/abonné non plus, voir project_level_sources.
  isDevAccount: async () => {
    if (!_currentUser) return false;
    const doc = await db.collection('users').doc(_currentUser.uid).get();
    return !!doc.data()?.is_dev;
  },

  // ── Abonnement niveaux tiers ─────────────────────────────────────────────────
  // "Tiers" = niveau perso (source:'perso') appartenant à un autre compte et rendu
  // public (private:false) — pas une valeur de `source` séparée, voir getPersoLevelsInFamily.
  // "S'abonner" n'est ni une copie ni un pointeur séparé : juste un docId de plus dans
  // `users/{uid}.subscribed_tiers` — une allow-list au même esprit que `denied_levels`
  // (inversée : ici absence = pas d'accès, plutôt que présence = accès refusé).

  getSubscribedTiersIds: async () => {
    if (!_currentUser) return [];
    const doc = await db.collection('users').doc(_currentUser.uid).get();
    return doc.exists ? (doc.data().subscribed_tiers || []) : [];
  },

  subscribeTiersLevel: async (levelDocId) => {
    if (!_currentUser) throw new Error('Non connecté');
    const ref  = db.collection('users').doc(_currentUser.uid);
    const doc  = await ref.get();
    const list = doc.data()?.subscribed_tiers || [];
    if (list.includes(levelDocId)) return;
    await ref.update({ subscribed_tiers: [...list, levelDocId] });
  },

  unsubscribeTiersLevel: async (levelDocId) => {
    if (!_currentUser) throw new Error('Non connecté');
    const ref  = db.collection('users').doc(_currentUser.uid);
    const doc  = await ref.get();
    const list = doc.data()?.subscribed_tiers || [];
    await ref.update({ subscribed_tiers: list.filter(id => id !== levelDocId) });
  },

  // ── Levels & families ────────────────────────────────────────────────────────
  // These use GAME_ID which is defined in the game-specific service file.

  getFamilies: async () => {
    const snap = await db.collection('level_families')
      .where('game_id', '==', GAME_ID).get();
    return snap.docs.map(d => ({ docId: d.id, ...d.data() })).sort((a, b) => a.id - b.id);
  },

  // TOUS les niveaux perso d'une famille, tous propriétaires confondus (pas de filtre
  // owner_uid). "Tiers" n'est pas une valeur de `source` stockée : c'est un niveau perso
  // (source:'perso') appartenant à quelqu'un d'autre ET marqué public (private:false) —
  // vue relative au compte courant, calculée côté appelant (voir levels-manager.js).
  // `private` manquant sur un vieux doc est traité comme privé par défaut (fail-closed :
  // ne jamais exposer par erreur un niveau créé avant l'introduction du champ).
  getPersoLevelsInFamily: async (familyId) => {
    const snap = await db.collection('levels')
      .where('game_id', '==', GAME_ID)
      .where('family_id', '==', Number(familyId))
      .where('source', '==', 'perso')
      .get();
    return snap.docs.map(d => ({ docId: d.id, ...d.data() }));
  },

  // `opts.sources` : liste des level_source à inclure (défaut ['standard'] = comportement
  // d'origine). Une requête par source, fusionnées côté client — le SDK compat ne fait
  // pas de OR entre champs différents. `opts.ownerUid` : requis pour filtrer 'perso' à un
  // seul propriétaire — un niveau perso sans ownerUid fourni ne remontera jamais (par
  // sécurité, pas de fuite entre comptes). 'tiers' n'existe pas comme valeur ici — voir
  // getPersoLevelsInFamily + getSubscribedTiersIds (mécanique d'accès différente, pas
  // encore branchée dans getLevels tant que index.js/page joueur n'en a pas besoin).
  getLevels: async (familyId, opts = {}) => {
    const { sources = ['standard'], ownerUid = null } = opts;
    const results = await Promise.all(sources.map(source => {
      if (source !== 'standard' && !ownerUid) return { docs: [] };
      let q = db.collection('levels')
        .where('game_id', '==', GAME_ID)
        .where('family_id', '==', Number(familyId))
        .where('source', '==', source);
      if (source !== 'standard') q = q.where('owner_uid', '==', ownerUid);
      return q.get();
    }));
    return results.flatMap(snap => snap.docs.map(d => ({ docId: d.id, ...d.data() })))
      .sort((a, b) => (a.order !== undefined ? a.order : a.id) - (b.order !== undefined ? b.order : b.id));
  },

  getLevelById: async (levelDocId) => {
    const doc = await db.collection('levels').doc(String(levelDocId)).get();
    return doc.exists ? { docId: doc.id, ...doc.data() } : null;
  },

  getAllLevels: async (opts = {}) => {
    const { sources = ['standard'], ownerUid = null } = opts;
    const results = await Promise.all(sources.map(source => {
      if (source !== 'standard' && !ownerUid) return { docs: [] };
      let q = db.collection('levels')
        .where('game_id', '==', GAME_ID)
        .where('source', '==', source);
      if (source !== 'standard') q = q.where('owner_uid', '==', ownerUid);
      return q.get();
    }));
    return results.flatMap(snap => snap.docs.map(d => ({ docId: d.id, ...d.data() })))
      .sort((a, b) => (a.family_id - b.family_id) || (a.id - b.id));
  },

  getGameTypes: async () => {
    const snap = await db.collection('game_types').where('game_id', '==', GAME_ID).get();
    return snap.docs.map(d => ({ docId: d.id, ...d.data() }))
      .sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
  },

  getDifficulties: async () => {
    const snap = await db.collection('level_difficulties').orderBy('order').get();
    return snap.docs.map(d => ({ docId: d.id, ...d.data() }));
  },

  // ── Progress & scores ────────────────────────────────────────────────────────
  // These use GAME_CONFIG.game_id (string slug) — only called from game pages
  // where game-config.js is loaded.

  getProgressForProfiles: async (profileIds) => {
    if (!profileIds.length) return {};
    const gameSlug = GAME_CONFIG.game_id;
    const docs = await Promise.all(
      profileIds.map(id =>
        db.collection('profiles').doc(id).collection('progress').doc(gameSlug).get()
      )
    );
    const result = {};
    docs.forEach((doc, i) => {
      result[profileIds[i]] = doc.exists ? doc.data() : { best_scores: {} };
    });
    return result;
  },

  saveScore: async (profileId, data) => {
    if (!profileId) return;
    return db.collection('profiles').doc(profileId)
      .collection('scores').add({
        ...data,
        played_at: firebase.firestore.FieldValue.serverTimestamp(),
      });
  },

  getProgress: async (profileId) => {
    if (!profileId) return { best_scores: {} };
    const gameSlug = GAME_CONFIG.game_id;
    const doc = await db.collection('profiles').doc(profileId)
      .collection('progress').doc(gameSlug).get();
    return doc.exists ? doc.data() : { best_scores: {} };
  },

  updateProgress: async (profileId, levelDocId, gameTypeId, stars, points) => {
    if (!profileId) return;
    const gameSlug = GAME_CONFIG.game_id;
    const key = `${levelDocId}_${gameTypeId}`;
    const ref = db.collection('profiles').doc(profileId)
      .collection('progress').doc(gameSlug);
    return db.runTransaction(async tx => {
      const doc   = await tx.get(ref);
      const data  = doc.exists ? doc.data() : {};
      const newStars  = Math.max(data.best_scores?.[key] ?? 0, stars);
      const newPoints = Math.max(data.best_points?.[key] ?? 0, points);
      if (doc.exists) {
        tx.update(ref, {
          last_played_at:         firebase.firestore.FieldValue.serverTimestamp(),
          [`best_scores.${key}`]: newStars,
          [`best_points.${key}`]: newPoints,
        });
      } else {
        tx.set(ref, {
          last_played_at: firebase.firestore.FieldValue.serverTimestamp(),
          best_scores:    { [key]: newStars },
          best_points:    { [key]: newPoints },
        });
      }
    });
  },
};
