// Input handling (spec §9). Keyboard + touch; lane-by-lane, never analog.

/**
 * @param {object} handlers
 * @param {number} repeatMs  cadence for held left/right, so crossing several
 *   lanes is one hold rather than several precisely-timed taps.
 */
export function createInput(canvas, handlers, repeatMs = 150) {
  const { onLeft, onRight, onPause, onMute } = handlers;

  // Held-key repeat is driven by a timer rather than the OS key-repeat rate,
  // which varies per machine and starts after a long initial delay.
  let heldDir = 0;
  let repeatTimer = null;

  function startRepeat(dir, fire) {
    // A key already held in this direction is already repeating; re-entering
    // would double-fire it. Any other case starts fresh and fires immediately,
    // so a single tap always produces exactly one lane change.
    if (heldDir === dir && repeatTimer) return;
    stopRepeat();
    heldDir = dir;
    fire();
    repeatTimer = setInterval(fire, repeatMs);
  }

  function stopRepeat() {
    heldDir = 0;
    if (repeatTimer) { clearInterval(repeatTimer); repeatTimer = null; }
  }

  function onKeyDown(e) {
    switch (e.key) {
      case 'ArrowLeft': case 'a': case 'A':
        startRepeat(-1, onLeft); e.preventDefault(); break;
      case 'ArrowRight': case 'd': case 'D':
        startRepeat(1, onRight); e.preventDefault(); break;
      case 'p': case 'P': case 'Escape': case ' ': case 'Spacebar':
        if (e.repeat) return;
        stopRepeat(); onPause(); e.preventDefault(); break;
      case 'm': case 'M':
        if (e.repeat) return;
        onMute(); e.preventDefault(); break;
    }
  }

  function onKeyUp(e) {
    switch (e.key) {
      case 'ArrowLeft': case 'a': case 'A':
        if (heldDir === -1) stopRepeat(); break;
      case 'ArrowRight': case 'd': case 'D':
        if (heldDir === 1) stopRepeat(); break;
    }
  }

  // Losing focus mid-hold would otherwise leave the repeat running.
  function onBlur() { stopRepeat(); }

  function onPointerDown(e) {
    // Tap left half / right half of the play area.
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX ?? 0) - rect.left;
    if (x < rect.width / 2) startRepeat(-1, onLeft); else startRepeat(1, onRight);
    e.preventDefault();
  }

  function onPointerUp() { stopRepeat(); }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);

  return {
    destroy() {
      stopRepeat();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      canvas.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    }
  };
}
