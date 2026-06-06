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

**Types de jeu** : `getGameTypes()` — fetches `game_types` where `game_id == GAME_ID`, triés par `order`

**Progress/Scores** (utilisent `GAME_CONFIG.game_id` comme slug) : `getProgress`,
`updateProgress`, `saveScore`, `getProgressForProfiles`

### shared/index.js
**Page d'accueil générique pour tous les jeux.** Construit tout le DOM dans `<div id="app">`,
gère : profils, familles/carousel, grille de niveaux, modes, difficulté, scores, aide, auth.

**Requiert** : `GAME_CONFIG` (game-config.js), `gameService` (firebase-service.js).

**Configure via `GAME_CONFIG` :**
```js
GAME_CONFIG.name          // ex: 'CliConVocabulary'
GAME_CONFIG.modes         // [{slug, id, icon, label, chrono_s, audio_required, score_tracking}]
GAME_CONFIG.difficulties  // [{id, label}] — utilisé si ui.difficulty
GAME_CONFIG.ui = {
  level_display:  'thumbnail' | 'list',
  audio:          bool,   // affiche le toggle son
  chrono:         bool,   // affiche le toggle chrono
  difficulty:     bool,   // affiche la barre de difficulté
  access_control: bool,   // affiche le lien "Niveaux autorisés" (access.html)
  item_label:     string, // label au singulier pour le compteur footer (ex: 'mot', 'question')
}
GAME_CONFIG.help_sections  // [{title, text}] — contenu du panneau Aide
```

**Requiert aussi `gameService.getItemCount(levelDocId)`** → nombre d'items du niveau (pour le footer).

**localStorage** : clés préfixées par `GAME_CONFIG.game_id` (ex: `cliconvocabulary-mode`).

**`VERSION`** : constante dans ce fichier, à incrémenter à chaque push.

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
game_types/{id}                    → types de jeu (game_id, id, slug, name, icon, order,
                                     chrono_s, audio_required) — à enrichir via seedGameTypes
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
```js
GAME_CONFIG.game_id = 'cliconvocabulary'
GAME_CONFIG.name    = 'CliConVocabulary'
GAME_CONFIG.modes   = [ learning(0), findword(1), chooseword(2), typeword(3), listenclick(4), listentype(5) ]
GAME_CONFIG.ui      = { level_display:'thumbnail', audio:true, chrono:true, difficulty:false,
                        access_control:true, item_label:'mot' }
// Backward compat game.js :
GAME_CONFIG.game_types = { learning:0, findword:1, chooseword:2, typeword:3, listenclick:4, listentype:5 }
GAME_CONFIG.chrono_s   = { findword:8, chooseword:5, typeword:20, listenclick:5, listentype:20 }
ICONS.speaker : SVG inline
```

### firebase-service.js
`window.gameService = { ..._platformMethods, GAME_ID:2, getWords(levelDocId), getWordCount(levelDocId), getItemCount(levelDocId) }`

### editor-firebase-service.js
`window.editorService = { ..._platformMethods, ..._editorPlatformMethods, GAME_ID:2, GAME_NAME:'CliConVocabulary', DIFFICULTIES, … }`
Méthodes spécifiques : `createFamily`, `deleteFamily` (+ sous-coll. words), `createLevel`
(champs image/marqueurs), `deleteLevel` (+ sous-coll. words), `getWords`, `saveWords`,
`uploadAudio`, `uploadImage`, `deleteImage`, `seedVocabularyGame`.
Storage initialisé en lazy via `_storage()` pour ne pas crasher dans editor_manager.html.
Auth aliases : `getProvider()`, `reauthPassword(pw)`, `reauthGoogle()`.

### index.html
Thin wrapper : charge `game.css` + Firebase SDKs + `game-config.js` + `shared/index.js`.
Contient uniquement `<div id="app"></div>` — tout le DOM est construit par `shared/index.js`.

### game.html + game.js
Modes : `learning`, `findword`, `chooseword`, `typeword`, `listenclick`, `listentype`.
Lit params URL : `level`, `mode`, `speed`, `seconds`, `audio`, `avatar`, `player`, `profile`.
Appelle `gameService.getWords`, `saveScore`, `updateProgress`.
**`VERSION`** à incrémenter à chaque push — affiché en bas à droite de game.html (`.version-display`, à gauche du bouton plein écran).

**Comportements audio notables :**
- `stopCurrentAudio()` — helper qui fait `pause()` + `src=''` pour libérer la ressource
- `typeword`/`chooseword` : attend la fin de l'audio avant d'afficher la question suivante (`_afterAnswer` avec `waitAudio=true`)
- `listentype` : audio joué + marqueur actif pendant la question (renforcement image/audio) ; audio stoppé dès validation, **pas** rejoué
- `listenclick` : même comportement que `listentype` pour le chrono (attend la fin audio avant de démarrer)
- `learning` : séparateur `→` entre mot anglais et traduction française

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

### game-config.js
```js
GAME_CONFIG.game_id = 'calcnplay'
GAME_CONFIG.name    = 'CalcNPlay'
GAME_CONFIG.modes   = [ { slug:'calcul', id:0, icon:'🧮', label:'Calcul mental', chrono_s:10,
                          audio_required:false, score_tracking:true } ]
GAME_CONFIG.ui      = { level_display:'list', audio:false, chrono:true, difficulty:true,
                        access_control:false, item_label:'question' }
GAME_CONFIG.difficulties = [ CP(1), CE1(2), CE2(3), CM1(4), CM2(5) ]
// Backward compat game.js :
GAME_CONFIG.game_types = { calcul:0 }
GAME_CONFIG.chrono_s   = { calcul:10 }
```

### firebase-service.js
`window.gameService = { ..._platformMethods, GAME_ID:3, getItemCount(levelDocId) }`
`getItemCount` retourne le nombre de questions (mode list) ou `null` (mode computed).

### editor-firebase-service.js + formats.json + editor.html + editor.js + editor.css
Éditeur de niveaux complet — voir section précédente pour les détails.

### index.html
Thin wrapper identique à CliConVocabulary — tout géré par `shared/index.js`.
Affiche : label mode unique "🧮 Calcul mental" (sans dropdown), barre de difficulté CP→CM2,
grille en liste (pas de thumbnail).

### Ce qui reste à créer
- `game.js` : logique jeu calcul mental (réécrire depuis zéro)
- `game.html` : à adapter pour CalcNPlay (supprimer image/SVG/marqueurs)

---

## Ordre de chargement — pages index (thin wrapper)

```html
<script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js"></script>
<script src="game-config.js"></script>
<script src="../shared/firebase-core.js"></script>
<script src="../shared/platform-methods.js"></script>
<script src="firebase-service.js"></script>
<script src="../shared/index.js"></script>
```

## Ordre de chargement — game.html

```html
<script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js"></script>
<!-- Storage uniquement si nécessaire -->
<script src="game-config.js"></script>
<script src="../shared/firebase-core.js"></script>
<script src="../shared/platform-methods.js"></script>
<script src="firebase-service.js"></script>
<script src="game.js"></script>
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

1. `monjeu/game-config.js` : `GAME_CONFIG.game_id`, `GAME_CONFIG.name`, `GAME_CONFIG.modes`,
   `GAME_CONFIG.ui`, `GAME_CONFIG.help_sections`, `GAME_CONFIG.difficulties` (si ui.difficulty)
2. `monjeu/firebase-service.js` : `window.gameService = { ..._platformMethods, GAME_ID, getItemCount, … }`
3. `monjeu/editor-firebase-service.js` : `window.editorService` avec `GAME_NAME`, `DIFFICULTIES`,
   `createFamily`, `deleteFamily`, `createLevel`, `deleteLevel` (+ `..._editorPlatformMethods`)
4. `monjeu/editor.html` + `editor.js` : éditeur de contenu, reçoit `?level=`, redirige
   vers `../shared/editor_manager.html?game=monjeu` si non auth
5. `monjeu/index.html` : thin wrapper (`<div id="app">` + scripts + `../shared/index.js`)
6. `monjeu/game.html` + `game.js` : logique jeu
7. Firestore : créer `games/{id}` et `game_types/{id}` (avec slug, icon, order, chrono_s)

## Conventions

- Pas de build system, pas de modules ES6
- Globaux entre fichiers : `const`/`let` top-level visibles dans les scripts suivants
- `window.gameService` sur les pages jeu/index, `window.editorService` sur les pages éditeur
- Auth callback unique : `window.onAuthChanged(user)`
- Chargement dynamique (editor_manager) : tester `if (_authResolved) window.onAuthChanged(_currentUser)` après avoir défini le callback
- **Version bump** : `VERSION` dans `shared/index.js` et `game.js` à chaque push
