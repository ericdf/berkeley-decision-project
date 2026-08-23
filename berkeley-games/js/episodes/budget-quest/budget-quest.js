// BUDGET QUEST episode (Structural Deficit revision v3.1).
//
// Missile Command with a municipal budget. Missiles are the deficit: the gap
// between recurring revenue and recurring expense, made visible and falling
// on six Berkeley services. Four controls, four fiscal years.
//
// The v1.0 driving game and the v2.0 garage are preserved in v1.html and
// v2.html; nothing in this path depends on them.

import { createDeficitBoard } from './board/board-episode.js';
import { makeRng, DEFAULT_SEED } from '../../rng.js';

const reducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function createBudgetQuest({ hud, audio, onExit }) {
  const board = createDeficitBoard({ audio, hud, reducedMotion, onExit });

  function showBoard() {
    for (const s of document.querySelectorAll('.screen')) {
      s.hidden = s.id !== 'board-screen';
    }
    document.body.dataset.screen = 'board-screen';
  }

  return {
    /** @param {'common'|'council'} mode */
    start(mode) {
      showBoard();
      board.start(mode, makeRng(DEFAULT_SEED + (mode === 'council' ? 1 : 0)).next);
    },
    stop() { board.stop(); },
    get state() { return board.state; },
    requestExit() { return board.requestExit(); },
    __arm() { board.__arm?.(); },
    __bomb(key, kind) { board.__bomb?.(key, kind); }
  };
}
