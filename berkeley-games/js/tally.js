// Staged tally reveal for the Special Meeting summary (Tally Reveal addendum).
//
// The meeting statistics are the setup and the budget result is the punchline,
// so labels appear at once, values type on one field at a time, and the fiscal
// verdict lands separately afterwards.

export const TALLY = {
  characterDelayMs: 60,     // addendum §6 (range 50-70)
  fieldDelayMs: 125,        // addendum §6 (range 100-150)
  postTallyPauseMs: 400,    // addendum §14 (range 300-500)
  afterLineMs: 700,
  gapLineMs: 900,
  closedMs: 700,
  consolationMs: 900,
  addedMs: 650
};

const wait = ms => new Promise(r => setTimeout(r, ms));

/**
 * Types a value in one character at a time. Explicitly a text reveal, not an
 * odometer: `124` shows as 1 → 12 → 124, never counting up (addendum §7, §8).
 */
async function revealValue(el, value, opts) {
  const { charDelay, tick, signal } = opts;
  el.textContent = '';
  for (let i = 1; i <= value.length; i++) {
    if (signal.cancelled) { el.textContent = value; return; }
    el.textContent = value.slice(0, i);
    tick?.();
    await wait(charDelay);
  }
  el.textContent = value;
}

/**
 * Runs the whole completion sequence.
 *
 * @param {object} els        pre-resolved DOM handles
 * @param {object} data       {fields, durationText, gapBefore, gapAfter, addedPerYear, onConsent}
 * @param {object} hooks      {tick, fieldDone, impact, reducedMotion}
 * @returns {{promise: Promise<void>, skip: () => void}}
 */
export function playTallyReveal(els, data, hooks = {}) {
  const signal = { cancelled: false };
  const reduced = hooks.reducedMotion?.() === true;
  const charDelay = reduced ? 18 : TALLY.characterDelayMs;
  const fieldDelay = reduced ? 40 : TALLY.fieldDelayMs;

  const promise = (async () => {
    // Labels are already in the DOM; only values animate (addendum §4).
    for (const field of data.fields) {
      await revealValue(field.el, field.value, { charDelay, tick: hooks.tick, signal });
      hooks.fieldDone?.();
      await wait(signal.cancelled ? 0 : fieldDelay);
    }

    // The fiscal result is never just another grid cell (addendum §14).
    await wait(TALLY.postTallyPauseMs);
    els.tally.dataset.receded = 'true';
    els.verdict.hidden = false;

    els.after.textContent = `AFTER ${data.durationText}...`;
    await wait(TALLY.afterLineMs);

    // Show before and after so the eye expects movement, then finds none.
    els.before.textContent = data.gapBefore;
    els.gapAfter.textContent = data.gapAfter;
    await wait(TALLY.gapLineMs);

    els.closed.hidden = false;
    hooks.impact?.();
    await wait(TALLY.closedMs);

    // The consolation, landing a beat after the zero so it reads as a reply.
    if (els.consolation) {
      els.consolation.hidden = false;
      await wait(TALLY.consolationMs);
    }

    if (data.addedPerYear > 0) {
      els.added.textContent = `+$${data.addedPerYear.toFixed(1)}M/YR ADDED`;
      els.added.hidden = false;
      hooks.impact?.();
      if (data.onConsent) els.consent.hidden = false;
      await wait(TALLY.addedMs);
    }

    els.go.hidden = false;
    els.go.focus();
  })();

  return {
    promise,
    /**
     * Completes the running tally at once. Deliberately only fast-forwards the
     * statistics — the player must still see the fiscal punchline (§24).
     */
    skip() { signal.cancelled = true; }
  };
}
