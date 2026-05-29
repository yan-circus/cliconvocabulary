# LudoEdu — plateforme de jeux pédagogiques

Repo GitHub : `yan-circus/ludoedu`.
Firebase project : `ludoedu-fea1d` (Firestore + Auth + Storage).
Stack : HTML/CSS/JS vanilla, pas de build system, scripts chargés via `<script>` dans l'ordre.

## Structure du repo

```
shared/                  ← code partagé entre tous les jeux
cliconvocabulary/        ← jeu 1 : vocabulaire anglais (images + marqueurs)
calcnplay/               ← jeu 2 : calcul mental (en cours)
```

---

## shared/ — fichiers partagés

### shared/firebase-core.js
Initialise Firebase, expose les globaux `auth`, `db`, `_currentUser`, `_authResolved`.
- Appelle `window.onAuthChanged(user)` à chaque changement d'état auth.
- `_authResolved` passe à `true` dès que Firebase a résolu l'état auth (utile pour le
  chargement dynamique de scripts : après avoir défini `window.onAuthChanged`, tester
  `if (_authResolved) window.onAuthChanged(_currentUser)` pour éviter la race condition).
- **Doit être chargé avant tout fichier service.**
- Ne charge pas Firebase Storage (chargé uniquement par les pages qui en ont besoin).

### shared/platform-methods.js
Définit `_platformMethods` (global). Requiert `firebase-core.js` avant, `GAME_ID` défini
dans le service du jeu, `GAME_CONFIG.game_id` pour les méthodes progress.

**Auth** : `getUser`, `signIn`, `signOut`, `signInWithGoogle`, `signUp`, `resetPassword`,
`reauthWithPassword`, `reauthWithGoogle`, `getSupervisorProvider`

**Profils** : `getProfiles`, `createChildProfile`, `updateProfileAvatar`,
`updateDeniedLevels`, `updateShowLockedSetting`, `updateSupervisorSettings`, `getUserAccount`

**Familles/Niveaux** (filtrent par `GAME_ID`) : `getFamilies`, `getLevels(familyId)`,
`getLevelById(levelDocId)`, `getAllLevels`

**Progress/Scores** (utilisent `GAME_CONFIG.game_id` comme slug) : `getProgress`,
`updateProgress`, `saveScore`, `getProgressForProfiles`

### shared/editor-platform-methods.js
Définit `_editorPlatformMethods` et deux helpers async. Requiert `firebase-core.js` avant.

- `_editorNextFamilyId()` → prochain id entier auto-incrémenté pour `level_families`
- `_editorNextLevelId()` → prochain id entier auto-incrémenté pour `levels`
- `_editorPlatformMethods.updateLevelMeta(levelDocId, fields)` → update Firestore générique

À charger dans **toutes** les pages éditeur (manager et éditeur de contenu).

### shared/editor_manager.html + editor_manager.js + editor_manager.css
**Page browser commune à tous les jeux.** Gère : familles, niveaux, meta panel, modal
nouveau niveau. Aucune logique spécifique au jeu.

**Fonctionnement :** charge les scripts dynamiquement selon `?game=` dans l'URL.
Séquence de chargement (async/await) :
```
firebase-core.js → platform-methods.js → editor-platform-methods.js
→ ../${game}/editor-firebase-service.js → editor_manager.js
```
Pas de `game-config.js` (non nécessaire pour le manager).

**Utilise `window.editorService`** qui doit exposer :
```js
{
  GAME_NAME,          // string — affiché dans le titre
  DIFFICULTIES,       // [{id, label}] — pour les selects
  GAME_ID,            // entier
  getFamilies(),      // depuis _platformMethods
  getLevels(famId),   // depuis _platformMethods
  signOut(),          // depuis _platformMethods
  createFamily(name),
  deleteFamily(familyDocId),
  createLevel(familyId, familyUuid, name, difficulty, notes),
  deleteLevel(levelDocId),
  updateLevelMeta(levelDocId, fields),  // depuis _editorPlatformMethods
}
```

**Navigation :** clic "Éditer le contenu" → `../${game}/editor.html?level=${docId}`

**Lien depuis un jeu :** `../shared/editor_manager.html?game=cliconvocabulary`

---

## Firestore — structure des collections

```
users/{uid}                        → compte (email, profile_ids[], role)
profiles/{id}                      → profil joueur (avatar, denied_levels, supervisors…)
  scores/{autoId}                  → session de jeu (game_id, level_id, score, stars…)
  progress/{game_slug}             → meilleurs scores (best_scores{}, best_points{})
level_families/{docId}             → famille (game_id, name, id, uuid)
levels/{docId}                     → niveau (game_id, family_id, name, title, difficulty,
                                     notes, valid, item_count…) + champs spécifiques au jeu
  words/{docId}                    → sous-collection CliConVocabulary uniquement
games/{id}                         → métadonnées jeu
game_types/{id}                    → types de jeu (game_id, name)
```

### Registre des GAME_ID

| GAME_ID | Slug              | Jeu              |
|---------|-------------------|------------------|
| 2       | cliconvocabulary  | CliConVocabulary |
| 3       | calcnplay         | CalcNPlay        |

---

## CliConVocabulary (dossier cliconvocabulary/)

**game_id : `2` — slug : `'cliconvocabulary'`** — jeu complet et fonctionnel.

### game-config.js
`GAME_CONFIG.game_id = 'cliconvocabulary'`
`GAME_CONFIG.game_types = { learning:0, findword:1, chooseword:2, typeword:3, listenclick:4 }`
`GAME_CONFIG.chrono_s`, `GAME_CONFIG.score3_per_question = 500`, `GAME_CONFIG.difficulties`
`ICONS.speaker` : SVG inline.

### firebase-service.js
`window.gameService = { ..._platformMethods, GAME_ID:2, getWords(levelDocId), getWordCount(levelDocId) }`

### editor-firebase-service.js
`window.editorService = { ..._platformMethods, ..._editorPlatformMethods, GAME_ID:2, GAME_NAME:'CliConVocabulary', DIFFICULTIES, … }`
Méthodes spécifiques : `createFamily`, `deleteFamily` (+ sous-coll. words), `createLevel`
(champs image/marqueurs), `deleteLevel` (+ sous-coll. words), `getWords`, `saveWords`,
`uploadAudio`, `uploadImage`, `deleteImage`, `seedVocabularyGame`.
Storage initialisé en lazy via `_storage()` pour ne pas crasher dans editor_manager.html.
Auth aliases : `getProvider()`, `reauthPassword(pw)`, `reauthGoogle()`.

### index.html + index.js
Sélection profil, familles, grille niveaux, lancement jeu.
Lien superviseur vers `../shared/editor_manager.html?game=cliconvocabulary`.

### game.html + game.js
Modes : `learning`, `findword`, `chooseword`, `typeword`, `listenclick`.
Lit params URL : `level`, `mode`, `chrono`, `audio`, `avatar`, `player`, `profile`.
Appelle `gameService.getWords`, `saveScore`, `updateProgress`.

### editor.html + editor.js
**Éditeur de contenu uniquement** (marqueurs, mots, image, audio).
Reçoit `?level=levelDocId` depuis l'URL (navigué depuis editor_manager).
Auth : si non connecté → redirige vers `../shared/editor_manager.html?game=cliconvocabulary`.
Bouton "← Retour" → `history.back()`.
Charge : `../shared/editor_manager.css` + `editor.css` (styles spécifiques).

### access.html + access.js
Gestion accès niveaux par le superviseur.

---

## CalcNPlay (dossier calcnplay/)

**game_id : `3` — slug : `'calcnplay'`** — jeu de calcul mental, en cours de création.

### Ce qui existe et fonctionne

- `game-config.js` : `GAME_CONFIG.game_id = 'calcnplay'`, `GAME_ID = 3`
- `firebase-service.js` : `window.gameService = { ..._platformMethods, GAME_ID:3 }` (stub)
- `editor-firebase-service.js` : `window.editorService` complet pour le manager
- `formats.json` : 5 formats de question prédéfinis (voir ci-dessous)
- `editor.html` + `editor.js` + `editor.css` : éditeur de niveaux complet

### editor.html — éditeur de niveaux CalcNPlay

Layout 2 colonnes. Reçoit `?level=` depuis le manager. Sauvegarde dans `level.rules`.

**Colonne gauche — réglages :**
- Mode toggle : `computed` (calculé par ordi) ou `list` (liste prédéfinie)
- Mode computed : opérandes `a` et `b` avec `{min, max, coef}`, opérateurs cochés +−×÷,
  contrainte résultat `{min, max}`, sélection de format
- Mode list : tableau question/réponse éditable

**Logique de génération (mode computed) :**
| Op | Affichée | Réponse |
|----|----------|---------|
| +  | a + b    | a+b     |
| −  | (a+b) − b | a     |
| ×  | a × b    | a×b     |
| ÷  | (a×b) ÷ b | a     |

**Colonne droite :**
- Liste d'exemples générés (10/20/50/100) — respecte le format choisi
- Zone de test interactive : activation au clic, saisie chiffre par chiffre, validation auto

### formats.json

Templates avec variables `{op1}`, `{op2}`, `{op}`, `{result}`, `{?}` (élément caché).
Chaque format a : `id`, `label`, `template`, `placeholder_display` (?/...), `answer_key` (result/op1/op2).

5 formats : résultat inconnu, 1er/2e terme inconnu (style `?`), 1er/2e terme inconnu (style `...`).

### Structure rules dans Firestore (champ `rules` sur le doc level)

```js
// mode computed
{
  mode: 'computed',
  computed: {
    a: { min:1, max:10, coef:1 },
    b: { min:1, max:10, coef:1 },
    operators: ['+', '-'],       // opérateurs actifs
    result: { min:null, max:null },
    format_id: 'default',
  },
  list: { questions: [] },
}
// mode list
{ mode: 'list', computed: {...}, list: { questions: [{q:'12+5', a:'17'}] } }
```

### Ce qui reste à créer
- `game.js` : logique jeu calcul mental (réécrire depuis zéro)
- `index.js` : adapter (supprimer refs vocab, définir modes calcul)
- `index.html` : à adapter (modes de jeu calcul)

---

## Ordre de chargement — pages jeu (index, game)

```html
<script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js"></script>
<!-- Storage uniquement si nécessaire -->
<script src="game-config.js"></script>
<script src="../shared/firebase-core.js"></script>
<script src="../shared/platform-methods.js"></script>
<script src="firebase-service.js"></script>
<script src="index.js"></script>  <!-- ou game.js -->
```

## Ordre de chargement — éditeur de contenu (editor.html)

```html
<script src="...firebase-app-compat.js"></script>
<script src="...firebase-auth-compat.js"></script>
<script src="...firebase-firestore-compat.js"></script>
<script src="...firebase-storage-compat.js"></script>  <!-- si upload nécessaire -->
<script src="../shared/firebase-core.js"></script>
<script src="../shared/platform-methods.js"></script>
<script src="../shared/editor-platform-methods.js"></script>
<script src="editor-firebase-service.js"></script>
<script src="editor.js"></script>
```

## Ordre de chargement — editor_manager.html (dynamique)

Géré automatiquement par l'IIFE dans `editor_manager.html` selon `?game=`.
Ne pas charger `game-config.js` (inutile pour le manager).

---

## Créer un nouveau jeu — checklist

1. `monjeu/game-config.js` : `GAME_CONFIG.game_id` (slug unique), `GAME_ID` (entier unique)
2. `monjeu/firebase-service.js` : `window.gameService = { ..._platformMethods, GAME_ID, … }`
3. `monjeu/editor-firebase-service.js` : `window.editorService` avec `GAME_NAME`, `DIFFICULTIES`,
   `createFamily`, `deleteFamily`, `createLevel`, `deleteLevel` (+ `..._editorPlatformMethods`)
4. `monjeu/editor.html` + `editor.js` : éditeur de contenu, reçoit `?level=`, redirige
   vers `../shared/editor_manager.html?game=monjeu` si non auth
5. `monjeu/index.html` : lien superviseur → `../shared/editor_manager.html?game=monjeu`
6. Firestore : créer `games/{id}` et `game_types/{id}`

## Conventions

- Pas de build system, pas de modules ES6
- Globaux entre fichiers : `const`/`let` top-level visibles dans les scripts suivants
- `window.gameService` sur les pages jeu, `window.editorService` sur les pages éditeur
- Auth callback unique : `window.onAuthChanged(user)`
- Chargement dynamique (editor_manager) : tester `if (_authResolved) window.onAuthChanged(_currentUser)` après avoir défini le callback
- Version bump dans `index.js` et `game.js` à chaque push (`const VERSION`)
