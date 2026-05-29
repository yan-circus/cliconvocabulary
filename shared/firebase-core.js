// shared/firebase-core.js — Firebase init, auth, db, current user
// Loaded before any game or editor service file.

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

let _currentUser  = null;
let _authResolved = false;

auth.onAuthStateChanged(user => {
  _currentUser  = user;
  _authResolved = true;
  if (typeof window.onAuthChanged === 'function') window.onAuthChanged(user);
});
