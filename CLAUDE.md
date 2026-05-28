# LudoEdu — plateforme de jeux pédagogiques

Repo GitHub : `yan-circus/cliconvocabulary` (sera renommé `ludoedu` à terme).
Firebase project : `ludoedu-fea1d` (Firestore + Auth + Storage).
Stack : HTML/CSS/JS vanilla, pas de build system, scripts chargés via `<script>` dans l'ordre.

## Structure du repo

```
shared/                  ← code partagé entre tous les jeux
cliconvocabulary/        ← premier jeu (actuellement à la racine)
maths/                   ← deuxième jeu (à créer)
```

Les fichiers de CliConVocabulary sont pour l'instant **à la racine** (pas dans un sous-dossier).
Les nouveaux jeux iront dans leur propre sous-dossier.

---

## shared/

### shared/firebase-core.js
Initialise Firebase, expose les globaux `auth`, `db`, `_currentUser`.
Appelle `window.onAuthChanged(user)` à chaque changement d'état auth.
**Doit être chargé avant tout fichier service.**
Ne charge pas Firebase Storage (fait par les jeux qui en ont besoin).

### shared/platform-methods.js
Définit l'objet `_platformMethods` (global, pas sur `window`).
Requiert : `firebase-core.js` chargé avant, `GAME_ID` (entier) défini dans le fichier service du jeu, `GAME_CONFIG.game_id` (slug string) pour les méthodes progress (disponible sur les pages jeu).

Méthodes disponibles :

**Auth**
- `getUser()` → utilisateur Firebase courant
- `signIn(email, pw)`, `signOut()`, `signInWithGoogle()`, `signUp(email, pw, prenom, nom, avatarId)`, `resetPassword(email)`
- `reauthWithPassword(pw)`, `reauthWithGoogle()`
- `getSupervisorProvider()` → `'password'` | `'google.com'` | null

**Profils**
- `getProfiles()` → liste des profils liés au compte connecté
- `createChildProfile(prenom, nom, avatarId)` → nouveau profil enfant
- `updateProfileAvatar(profileId, avatarId)`
- `updateDeniedLevels(profileId, deniedLevels)`
- `updateShowLockedSetting(profileId, showLocked)`
- `updateSupervisorSettings(profileId, settings)`
- `getUserAccount()` → doc Firestore `users/{uid}`

**Niveaux et familles** (filtrent par `GAME_ID`)
- `getFamilies()` → familles triées par `id`
- `getLevels(familyId)` → niveaux d'une famille
- `getLevelById(levelDocId)` → un niveau par docId
- `getAllLevels()` → tous les niveaux du jeu

**Progress et scores** (utilisent `GAME_CONFIG.game_id` comme slug)
- `getProgress(profileId)` → `{ best_scores: { "levelId_typeId": stars }, best_points: {...} }`
- `updateProgress(profileId, levelDocId, gameTypeId, stars, points)` → garde le meilleur
- `saveScore(profileId, data)` → ajoute dans `profiles/{id}/scores`
- `getProgressForProfiles(profileIds[])` → map profileId → progress

**Usage dans un fichier service de jeu :**
```js
const GAME_ID = 3; // entier unique par jeu dans Firestore
window.gameService = {
  ..._platformMethods,
  GAME_ID,
  // méthodes spécifiques au jeu...
};
```

---

## Firestore — structure des collections

```
users/{uid}                        → compte (email, profile_ids[], role)
profiles/{id}                      → profil joueur (avatar, denied_levels, supervisors…)
  scores/{autoId}                  → session de jeu (game_id, level_id, score, stars, played_at…)
  progress/{game_slug}             → meilleurs scores par jeu (best_scores{}, best_points{})
level_families/{docId}             → famille de niveaux (game_id, name, id)
levels/{docId}                     → niveau (game_id, family_id, name, difficulty, item_count…)
  words/{docId}                    → sous-collection spécifique CliConVocabulary
games/{id}                         → métadonnées jeu (name, description)
game_types/{id}                    → types de jeu (game_id, name)
```

Chaque jeu a son propre `game_id` **entier** dans `level_families` et `levels`.
Le progress est stocké sous `progress/{game_slug}` où le slug est `GAME_CONFIG.game_id` (string).

---

## CliConVocabulary (fichiers à la racine)

**game_id Firestore : `2` — slug progress : `'cliconvocabulary'`**

### game-config.js
Expose `GAME_CONFIG` et `ICONS`.
- `GAME_CONFIG.game_id` : `'cliconvocabulary'`
- `GAME_CONFIG.game_types` : `{ learning:0, findword:1, chooseword:2, typeword:3, listenclick:4 }`
- `GAME_CONFIG.chrono_s` : secondes par question par mode
- `GAME_CONFIG.score3_per_question` : `500`
- `GAME_CONFIG.difficulties` : tableau `[{id, label}]`
- `ICONS.speaker` : SVG inline speaker (stroke currentColor)

### firebase-service.js
Expose `window.gameService = { ..._platformMethods, GAME_ID:2, getWords, getWordCount }`.
- `getWords(levelDocId)` → mots avec `{ fr, en, langs, point, arrows, order, audio_path }`
- `getWordCount(levelDocId)` → nombre de mots

### editor-firebase-service.js
Expose `window.editorService = { ..._platformMethods, DIFFICULTIES, GAME_ID:2, … }`.
Méthodes supplémentaires : `createFamily`, `deleteFamily`, `createLevel`, `updateLevelMeta`, `deleteLevel`, `getWords`, `saveWords`, `uploadAudio`, `uploadImage`, `deleteImage`, `seedVocabularyGame`.
Aliases editor : `getProvider()`, `reauthPassword(pw)`, `reauthGoogle()`.

### index.html + index.js
Page d'accueil : sélection profil, familles, grille de niveaux, lancement du jeu.
Auth callback : `window.onAuthChanged`.
Paramètres URL passés à `game.html` : `level`, `mode`, `profile`, `chrono`, `audio`.

### game.html + game.js
Page de jeu. Modes : `learning`, `findword`, `chooseword`, `typeword`, `listenclick`.
Lit les params URL. Appelle `gameService.getWords`, `saveScore`, `updateProgress`.
Auth callback : non utilisé (params passés par URL).

### editor.html + editor.js
Éditeur de niveaux. Auth callback : `window.onAuthChanged`.
Deux écrans : `browser` (liste familles/niveaux) et `editor` (mots + marqueurs + image).

### access.html + access.js
Gestion des accès niveaux par le superviseur.
Auth callback : `window.onAuthChanged`.

---

## Ordre de chargement des scripts (toutes pages)

```html
<!-- 1. Firebase SDK CDN -->
<script src="firebase-app-compat.js"></script>
<script src="firebase-auth-compat.js"></script>
<script src="firebase-firestore-compat.js"></script>
<!-- Storage uniquement si nécessaire -->

<!-- 2. Config jeu (définit GAME_CONFIG) -->
<script src="game-config.js"></script>   <!-- ou ../maths/game-config.js -->

<!-- 3. Shared (dans cet ordre) -->
<script src="shared/firebase-core.js"></script>      <!-- définit auth, db, _currentUser -->
<script src="shared/platform-methods.js"></script>   <!-- définit _platformMethods -->

<!-- 4. Service spécifique au jeu (définit GAME_ID, window.gameService) -->
<script src="firebase-service.js"></script>

<!-- 5. Logique de la page -->
<script src="index.js"></script>
```

---

## Créer un nouveau jeu — checklist

1. Créer `monjeu/game-config.js` avec `GAME_CONFIG.game_id` unique (string) et `GAME_ID` entier unique
2. Créer `monjeu/firebase-service.js` : `window.gameService = { ..._platformMethods, GAME_ID, /* spécifique */ }`
3. Charger les scripts dans l'ordre ci-dessus (chemins `../shared/` depuis un sous-dossier)
4. Ajouter le jeu dans Firestore : `games/{id}` + `game_types/{id}`
5. Créer les familles/niveaux via l'éditeur (ou adapter `editor-firebase-service.js`)

## Conventions

- Pas de build system, pas de modules ES6 (`import`/`export`)
- Globaux entre fichiers : `const`/`let` top-level sont visibles dans les scripts suivants
- Nommage services : `window.gameService` (jeu), `window.editorService` (éditeur)
- Auth callback unique : `window.onAuthChanged(user)`
- Version bump dans `index.js` et `game.js` à chaque push (`const VERSION`)
