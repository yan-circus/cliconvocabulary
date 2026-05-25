# CliConVocabulary

Jeu pédagogique de vocabulaire anglais développé pour la plateforme **LudoEdu**. Les élèves associent des mots à des points placés sur une image thématique, selon plusieurs modes de jeu progressifs.

---

## Fonctionnalités

- 4 modes de jeu + mode apprentissage
- Chrono par type de jeu avec score dynamique (100–1 000 pts)
- Système d'étoiles par niveau et par type de jeu (★★★)
- Profils joueurs multiples avec avatars
- Éditeur de niveaux intégré (réservé aux superviseurs)
- Sauvegarde des scores et de la progression dans Firestore

---

## Modes de jeu

| Mode | Description | Chrono |
|------|-------------|--------|
| 📖 Apprentissage | Exploration libre — clic sur mot ou sur point | — |
| 👆 Find the word | Un mot s'affiche, cliquer sur le bon point | 8 s |
| 🔤 Choose the word | Un point mis en évidence, choisir parmi 3 mots | 5 s |
| ⌨ Type the word | Un point mis en évidence, taper le mot | 20 s |

---

## Système d'étoiles

Les étoiles sont calculées par niveau **et** par type de jeu :

| Étoiles | Condition |
|---------|-----------|
| ★☆☆ | Niveau terminé (même avec 1–2 vies perdues) |
| ★★☆ | Niveau terminé sans perdre de vie |
| ★★★ | Sans vie perdue + chrono actif + score > 500 pts × nb de mots |

---

## Stack technique

- **Frontend** : HTML / CSS / JavaScript vanilla
- **Backend** : Firebase (Auth, Firestore, Storage) — SDK compat 9.23
- **Hébergement** : Firebase Hosting

---

## Structure Firestore

```
level_families/{id}       — familles de niveaux (par game_id)
levels/{id}               — niveaux (image, marqueurs, métadonnées)
  words/{id}              — mots du niveau (langs, point, arrows)
profiles/{id}             — profils joueurs
  scores/{id}             — résultats de parties
  progress/cliconvocabulary — meilleurs scores par niveau et mode
users/{uid}               — comptes Firebase Auth
```

---

## Fichiers principaux

| Fichier | Rôle |
|---------|------|
| `index.html / index.js` | Navigateur de niveaux, sélection profil, lancement |
| `game.html / game.js` | Moteur de jeu |
| `editor.html / editor.js` | Éditeur de niveaux |
| `game-config.js` | Configuration partagée (temps chrono, seuils étoiles) |
| `firebase-service.js` | Accès Firestore pour le jeu |
| `editor-firebase-service.js` | Accès Firestore pour l'éditeur |

---

## Configuration

Les paramètres ajustables sont centralisés dans **`game-config.js`** :

```js
const GAME_CONFIG = {
  chrono_s: {
    findword:   8,   // secondes par question
    chooseword: 5,
    typeword:   20,
  },
  score3_per_question: 500, // seuil score pour 3 étoiles
};
```

---

## Éditeur de niveaux

Accessible via **Menu → Options superviseur → Éditeur**. Permet de :

- Créer / modifier / supprimer des niveaux et familles
- Charger une image et placer des marqueurs sur les mots
- Importer un vocabulaire depuis un CSV (`Anglais;Français`)
- Valider qu'aucun mot n'est sans marqueur avant publication

Un niveau marqué **invalide** (mots sans marqueur) n'apparaît pas dans le jeu.
