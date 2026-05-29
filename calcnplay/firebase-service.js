// firebase-service.js — CalcNPlay game service
// Requires: shared/firebase-core.js, shared/platform-methods.js

const GAME_ID = 3;

window.gameService = {
  ..._platformMethods,
  GAME_ID,
};
