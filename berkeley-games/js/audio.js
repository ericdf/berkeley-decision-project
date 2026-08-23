// Synthesized sound effects (spec §31). No bundled audio files, no autoplay,
// no music. The AudioContext is created lazily on the first user gesture.

const STORAGE_KEY = 'bbd.muted';

export function createAudio() {
  let ctx = null;
  let muted = false;
  try { muted = localStorage.getItem(STORAGE_KEY) === '1'; } catch { /* storage blocked */ }

  let rainNode = null;
  let rainGain = null;

  function ensureCtx() {
    if (muted) return null;
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone({ freq = 440, type = 'square', dur = 0.12, gain = 0.06, slideTo = null }) {
    const c = ensureCtx();
    if (!c) return;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, c.currentTime);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), c.currentTime + dur);
    g.gain.setValueAtTime(gain, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    osc.connect(g).connect(c.destination);
    osc.start();
    osc.stop(c.currentTime + dur + 0.02);
  }

  function noiseBurst({ dur = 0.25, gain = 0.14, filterFreq = 900 }) {
    const c = ensureCtx();
    if (!c) return;
    const frames = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, frames, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    const src = c.createBufferSource();
    src.buffer = buf;
    const filt = c.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = filterFreq;
    const g = c.createGain();
    g.gain.value = gain;
    src.connect(filt).connect(g).connect(c.destination);
    src.start();
  }

  function stopRain() {
    if (rainNode) { try { rainNode.stop(); } catch { /* already stopped */ } }
    rainNode = null;
    rainGain = null;
  }

  return {
    get muted() { return muted; },

    toggleMute() {
      muted = !muted;
      try { localStorage.setItem(STORAGE_KEY, muted ? '1' : '0'); } catch { /* storage blocked */ }
      if (muted) { stopRain(); if (ctx) ctx.suspend(); }
      else if (ctx) ctx.resume();
      return muted;
    },

    /** Rubbery thud of bouncing off a lane-closure barricade. */
    barrier()     {
      noiseBurst({ dur: 0.22, gain: 0.13, filterFreq: 700 });
      tone({ freq: 190, type: 'square', dur: 0.14, gain: 0.07, slideTo: 95 });
      setTimeout(() => tone({ freq: 120, type: 'sine', dur: 0.16, gain: 0.05, slideTo: 70 }), 90);
    },

    /* ---- Budget Garage (Reboot spec §98) ---- */

    /** Mechanical click as a fiscal lever moves a notch. */
    leverClick()  { tone({ freq: 620, type: 'square', dur: 0.03, gain: 0.03, slideTo: 900 }); },

    /** Heavier, unpleasant clunk for cutting services. */
    slash()       {
      noiseBurst({ dur: 0.16, gain: 0.11, filterFreq: 620 });
      tone({ freq: 140, type: 'sawtooth', dur: 0.14, gain: 0.07, slideTo: 70 });
    },

    /** Gavel-ish confirmation, then the garage door motor. */
    adopt()       {
      tone({ freq: 180, type: 'square', dur: 0.09, gain: 0.09, slideTo: 90 });
      setTimeout(() => noiseBurst({ dur: 1.5, gain: 0.05, filterFreq: 340 }), 220);
    },

    laneChange()  { tone({ freq: 320, type: 'square', dur: 0.07, gain: 0.035, slideTo: 480 }); },
    gate()        { tone({ freq: 660, type: 'triangle', dur: 0.16, gain: 0.05, slideTo: 990 }); },
    pothole()     { noiseBurst({ dur: 0.35, gain: 0.18, filterFreq: 500 }); tone({ freq: 90, type: 'sawtooth', dur: 0.3, gain: 0.08, slideTo: 40 }); },
    bridgeCross() { tone({ freq: 523, type: 'triangle', dur: 0.14, gain: 0.05 }); setTimeout(() => tone({ freq: 784, type: 'triangle', dur: 0.22, gain: 0.05 }), 130); },
    fall()        { tone({ freq: 400, type: 'sawtooth', dur: 1.4, gain: 0.09, slideTo: 30 }); },
    pickup()      { tone({ freq: 880, type: 'square', dur: 0.09, gain: 0.05 }); setTimeout(() => tone({ freq: 1320, type: 'square', dur: 0.12, gain: 0.045 }), 80); },

    /** Thunderclap for the rainy-day beat (Rainy-Day addendum §4, §21). */
    thunder() {
      noiseBurst({ dur: 1.4, gain: 0.16, filterFreq: 380 });
      tone({ freq: 62, type: 'sine', dur: 1.2, gain: 0.10, slideTo: 28 });
      setTimeout(() => noiseBurst({ dur: 0.9, gain: 0.09, filterFreq: 260 }), 180);
    },

    /** Chair scrape, door slam, mixed reaction (Bottle Episode §18). */
    rageQuit() {
      noiseBurst({ dur: 0.28, gain: 0.09, filterFreq: 1800 });          // chair scrape
      setTimeout(() => {                                                 // door slam
        noiseBurst({ dur: 0.3, gain: 0.16, filterFreq: 300 });
        tone({ freq: 90, type: 'sine', dur: 0.26, gain: 0.09, slideTo: 45 });
      }, 420);
      setTimeout(() => noiseBurst({ dur: 0.8, gain: 0.06, filterFreq: 1400 }), 700);
    },

    /** Crowd cheer for a MEGA PANDER approval (Tightening addendum §32). */
    cheer() {
      for (let i = 0; i < 22; i++) {
        setTimeout(() => noiseBurst({ dur: 0.06, gain: 0.02, filterFreq: 2800 }), i * 26);
      }
      [523, 659, 784, 1047].forEach((f, i) =>
        setTimeout(() => tone({ freq: f, type: 'triangle', dur: 0.2, gain: 0.05 }), i * 95));
    },

    /**
     * Restrained mechanical tick per revealed character (Tally addendum §12).
     * Deliberately quiet: not a typewriter, not machine-gun arcade audio.
     */
    tallyTick() { tone({ freq: 1500, type: 'square', dur: 0.012, gain: 0.012 }); },

    /** Heavier hit for the fiscal punchline (Tally addendum §17, §30). */
    tallyImpact() {
      noiseBurst({ dur: 0.16, gain: 0.13, filterFreq: 800 });
      tone({ freq: 210, type: 'square', dur: 0.16, gain: 0.09, slideTo: 96 });
    },

    /** Consent stamp (Tightening addendum §29). */
    stamp() {
      noiseBurst({ dur: 0.09, gain: 0.14, filterFreq: 900 });
      tone({ freq: 160, type: 'square', dur: 0.07, gain: 0.07, slideTo: 80 });
    },

    /** Morning ambience after the meeting (Rainy-Day addendum §21). */
    morning() {
      [1568, 2093, 1760].forEach((f, i) =>
        setTimeout(() => tone({ freq: f, type: 'sine', dur: 0.09, gain: 0.022 }), i * 130));
    },

    /** Flame whoosh for the meeting dissolve. */
    whoosh() {
      noiseBurst({ dur: 0.8, gain: 0.10, filterFreq: 1100 });
      tone({ freq: 140, type: 'sine', dur: 0.7, gain: 0.05, slideTo: 520 });
    },
    pass()        { noiseBurst({ dur: 0.4, gain: 0.05, filterFreq: 1600 }); },

    // Pit stop (addendum §21). Stylised and synthesized — never recordings of
    // real protestors or commenters.
    meetingEnter() { tone({ freq: 220, type: 'triangle', dur: 0.3, gain: 0.05, slideTo: 160 });
                     setTimeout(() => noiseBurst({ dur: 0.7, gain: 0.06, filterFreq: 700 }), 120); },
    gavel()        { tone({ freq: 150, type: 'square', dur: 0.08, gain: 0.09, slideTo: 70 });
                     setTimeout(() => tone({ freq: 130, type: 'square', dur: 0.1, gain: 0.07, slideTo: 60 }), 110); },
    pound()        { tone({ freq: 70, type: 'sine', dur: 0.16, gain: 0.10, slideTo: 40 }); },
    hornChirp()    { tone({ freq: 420, type: 'sawtooth', dur: 0.1, gain: 0.05 }); },

    /**
     * Crowd response to PANDER, thinning with each use (Pandering §18):
     * strong applause -> polite -> scattered -> silence.
     */
    applause(use) {
      const level = Math.max(0, 4 - use);
      if (level <= 0) return;                 // awkward silence at exhaustion
      const claps = level * 4;
      for (let i = 0; i < claps; i++) {
        setTimeout(
          () => noiseBurst({ dur: 0.05, gain: 0.012 * level, filterFreq: 2600 }),
          i * (40 + (4 - level) * 30)
        );
      }
    },

    // Higher Office Escape (addendum §23). Synthesized only — never real
    // campaign audio, speeches, or copyrighted recordings.
    fanfare() {
      [523, 659, 784].forEach((f, i) =>
        setTimeout(() => tone({ freq: f, type: 'triangle', dur: 0.16, gain: 0.05 }), i * 90));
    },
    escape() {
      [659, 880, 1175].forEach((f, i) =>
        setTimeout(() => tone({ freq: f, type: 'triangle', dur: 0.3, gain: 0.055 }), i * 120));
      tone({ freq: 200, type: 'sine', dur: 1.8, gain: 0.05, slideTo: 1400 });
    },

    /** Continuous rain loop, intensity 0-3. */
    setRain(level) {
      const c = level > 0 ? ensureCtx() : null;
      if (!c) { stopRain(); return; }
      if (!rainNode) {
        const frames = c.sampleRate * 2;
        const buf = c.createBuffer(1, frames, c.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
        const src = c.createBufferSource();
        src.buffer = buf;
        src.loop = true;
        const filt = c.createBiquadFilter();
        filt.type = 'bandpass';
        filt.frequency.value = 2400;
        rainGain = c.createGain();
        rainGain.gain.value = 0;
        src.connect(filt).connect(rainGain).connect(c.destination);
        src.start();
        rainNode = src;
      }
      rainGain.gain.setTargetAtTime(0.012 * level, c.currentTime, 0.6);
    },

    stopAll() { stopRain(); }
  };
}
