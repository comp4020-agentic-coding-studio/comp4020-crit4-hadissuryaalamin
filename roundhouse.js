/*
 * Roundhouse - the instrument.
 *
 * Classic script, no modules, no build step. `Tone` is a global put on the
 * page by ./vendor/tone.js, which is loaded immediately before this file.
 *
 * What lives here (epic sections 6 and 8):
 *   - the master chain and the eight voices, at the exact parameters pinned
 *     in the epic;
 *   - the one-bar, sixteen-step recording loop, with overwrite-not-stack
 *     slots so the pattern stays bounded at 8 pads x 16 steps;
 *   - pointer and keyboard input, which reach the same strike point and so
 *     the same tonal range;
 *   - the visual state the stylesheet reads: data-phase, --strike-x and
 *     --strike-y on #pads, --sweep on #strip, .is-hit, .tick.is-armed,
 *     .tick.is-flash, .ripple and .trail.
 *
 * Every id, class and data-* used here comes from the DOM contract in
 * .claude/epics/roundhouse/updates/002.md; nothing here invents its own.
 */
(function () {
  "use strict";

  /* ---------------------------------------------------------------- DOM -- */

  var instrumentEl = document.getElementById("instrument");
  var padsEl = document.getElementById("pads");
  var stripEl = document.getElementById("strip");
  var ticksEl = document.getElementById("ticks");
  var speedEl = document.getElementById("speed");
  var bpmEl = document.getElementById("bpm");
  var clearEl = document.getElementById("clear");
  var keyhintEl = document.getElementById("keyhint");

  if (!instrumentEl || !padsEl || !stripEl) return;

  var tickEls = ticksEl ? Array.prototype.slice.call(ticksEl.querySelectorAll(".tick")) : [];

  /* Per-pad record: the button, its two effect layers, and the voice it drives. */
  var pads = Array.prototype.slice.call(padsEl.querySelectorAll(".pad")).map(function (el) {
    return {
      el: el,
      id: el.getAttribute("data-pad"),
      voice: el.getAttribute("data-voice"),
      code: el.getAttribute("data-key"),
      fx: el.querySelector("[data-fx]"),
      trails: el.querySelector("[data-trails]")
    };
  });
  if (pads.length === 0) return;

  var padByEl = new Map();
  var padByCode = new Map();
  pads.forEach(function (pad) {
    padByEl.set(pad.el, pad);
    if (pad.code) padByCode.set(pad.code, pad);
  });

  /* --------------------------------------------------------- constants -- */

  var STEPS = 16;
  var DEFAULT_BPM = 96;
  var MIN_BPM = 60;
  var MAX_BPM = 160;
  var STRIKE_NUDGE = 0.125;
  var REVERB_WAIT_CAP_MS = 250;
  var MAX_RIPPLES_PER_PAD = 3;

  /*
   * How long each visual state is held. These are NOT constants here: the
   * stylesheet owns every motion duration as a :root token so that one media
   * query can give a reader who asked for reduced motion the gentler
   * variant. If this file hard-coded 180ms it would cut a 260ms reduced
   * flash off two thirds of the way through. So: read the tokens, and read
   * them again if the preference changes mid-session.
   */
  var motion = { flash: 180, tick: 120, trail: 200, ripple: 520 };

  function cssMs(name, fallback) {
    var raw = "";
    try {
      raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    } catch (err) {
      return fallback;
    }
    var n = parseFloat(raw);
    if (!isFinite(n)) return fallback;
    return /ms\s*$/.test(raw) ? n : n * 1000;
  }

  function readMotion() {
    motion.flash = cssMs("--dur-flash", 180);
    motion.tick = cssMs("--dur-tick", 120);
    motion.trail = cssMs("--dur-trail", 200);
    motion.ripple = cssMs("--dur-ripple", 520);
  }

  /*
   * Epic 6.2. Constructor options are copied verbatim; `dur` is the trigger
   * length and `note` the base pitch. The two noise voices have no note - the
   * horizontal strike axis moves their bandpass instead. `noteHz` is only a
   * fallback for the note lookup.
   */
  var VOICE_SPECS = {
    kick: {
      kind: "membrane",
      note: "C1",
      noteHz: 32.7032,
      dur: "8n",
      options: {
        pitchDecay: 0.05,
        octaves: 6,
        oscillator: { type: "sine" },
        envelope: { attack: 0.001, decay: 0.42, sustain: 0, release: 0.02 }
      }
    },
    tom: {
      kind: "membrane",
      note: "G1",
      noteHz: 48.9994,
      dur: "8n",
      options: {
        pitchDecay: 0.09,
        octaves: 3,
        oscillator: { type: "sine" },
        envelope: { attack: 0.001, decay: 0.5, sustain: 0, release: 0.05 }
      }
    },
    snare: {
      kind: "noise",
      dur: "16n",
      options: {
        noise: { type: "white" },
        envelope: { attack: 0.001, decay: 0.18, sustain: 0 }
      },
      filter: { type: "bandpass", frequency: 1800, Q: 1.2 }
    },
    rim: {
      kind: "metal",
      note: "C6",
      noteHz: 1046.502,
      dur: "32n",
      options: {
        harmonicity: 8.5,
        modulationIndex: 40,
        resonance: 3000,
        octaves: 1,
        envelope: { attack: 0.001, decay: 0.06, release: 0.01 }
      }
    },
    hat: {
      kind: "metal",
      note: "C7",
      noteHz: 2093.005,
      dur: "32n",
      options: {
        harmonicity: 5.1,
        modulationIndex: 32,
        resonance: 4000,
        octaves: 1.5,
        envelope: { attack: 0.001, decay: 0.045, release: 0.01 }
      }
    },
    open: {
      kind: "metal",
      note: "C7",
      noteHz: 2093.005,
      dur: "8n",
      options: {
        harmonicity: 5.1,
        modulationIndex: 32,
        resonance: 4000,
        octaves: 1.5,
        envelope: { attack: 0.001, decay: 0.38, release: 0.08 }
      }
    },
    clap: {
      kind: "noise",
      dur: "16n",
      options: {
        noise: { type: "pink" },
        envelope: { attack: 0.002, decay: 0.22, sustain: 0 }
      },
      filter: { type: "bandpass", frequency: 1100, Q: 2.0 }
    },
    bell: {
      kind: "metal",
      note: "A5",
      noteHz: 880,
      dur: "4n",
      options: {
        harmonicity: 12,
        modulationIndex: 20,
        resonance: 800,
        octaves: 1.5,
        envelope: { attack: 0.001, decay: 0.9, release: 0.2 }
      }
    }
  };

  /* ------------------------------------------------------------- state -- */

  var audioReady = false;
  var bootPromise = null;
  var bus = null;
  var reverb = null;
  var voices = null;
  var transport = null;
  var draw = null;

  var currentBpm = DEFAULT_BPM;
  var strikeX = 0.5;
  var strikeY = 0.5;

  /*
   * The pattern. Epic 6.5 asks for one slot per (pad, step) pair. This is that
   * set, indexed by step first so the sixteenth-note callback does one lookup
   * instead of a scan: grid[step] is a Map keyed by pad id, so a second hit on
   * the same pad and step overwrites rather than stacks, and the whole thing
   * is bounded at 8 x 16 = 128 slots however long anyone plays.
   */
  var grid = [];
  for (var i = 0; i < STEPS; i++) grid.push(new Map());

  var stepIndex = -1;
  var loopPass = 1;

  var heldKeys = new Set();
  var hitTimers = new Map();
  var tickTimers = new Map();
  var sweepFrame = 0;

  var pointerStrikes = 0;
  var keyStrikes = 0;
  var firstGestureAt = 0;
  var hintUsed = false;
  var hintPoll = 0;
  var hintHideTimer = 0;

  /*
   * The native constructor. Everything audio hangs off this: with no
   * AudioContext in the browser there is no instrument to boot, and the resume
   * path below uses it again to tell a real context from a shimmed one.
   */
  var NativeAudioContext =
    typeof window !== "undefined" ? window.AudioContext || window.webkitAudioContext : null;

  /* ------------------------------------------------------------- utils -- */

  function clamp(value, low, high) {
    if (typeof value !== "number" || !isFinite(value)) return low;
    return value < low ? low : value > high ? high : value;
  }

  function clamp01(value) {
    return clamp(value, 0, 1);
  }

  function wait(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  /* -------------------------------------------------- the audio context -- */

  function toneContext() {
    try {
      return typeof Tone.getContext === "function" ? Tone.getContext() : null;
    } catch (err) {
      return null;
    }
  }

  function rawAudioContext() {
    var ctx = toneContext();
    return ctx && ctx.rawContext ? ctx.rawContext : null;
  }

  /* Readable state of the live context; surfaced on window.roundhouse so the
   * thing can be diagnosed from a console at the crit. */
  function audioContextReport() {
    if (!NativeAudioContext) return "this browser has no AudioContext";
    var raw = rawAudioContext();
    if (!raw) return "AudioContext not created yet";
    var kind = raw instanceof NativeAudioContext ? "native AudioContext" : "wrapped AudioContext";
    var latency = typeof raw.baseLatency === "number" ? Math.round(raw.baseLatency * 1000) : null;
    return kind + ", state " + raw.state + (latency === null ? "" : ", " + latency + "ms out");
  }

  /*
   * The resume path. Tone.start() resumes whatever context Tone is holding;
   * the follow-up talks to the AudioContext itself, because a context that
   * comes back "suspended" or "interrupted" (iOS after a phone call) needs
   * resuming again and Tone will not retry on its own.
   */
  function resumeAudioContext() {
    return Promise.resolve(Tone.start()).then(function () {
      var raw = rawAudioContext();
      if (raw && raw.state !== "running" && typeof raw.resume === "function") {
        return Promise.resolve(raw.resume()).catch(function () {
          /* A refused resume is not fatal: the chain gets built either way. */
        });
      }
      return null;
    });
  }

  /* --------------------------------------------------------- the chain -- */

  function noteHz(spec) {
    try {
      return Tone.Frequency(spec.note).toFrequency();
    } catch (err) {
      return spec.noteHz;
    }
  }

  /*
   * Epic 6.1: bus -> reverb -> compressor -> limiter -> out. The compressor
   * and the limiter together are the volume cap, which is why there is no
   * fader on screen: eight hits at once duck and clamp instead of clipping.
   */
  function buildChain() {
    bus = new Tone.Gain(0.9);
    reverb = new Tone.Reverb({ decay: 1.1, preDelay: 0.01, wet: 0.12 });
    var compressor = new Tone.Compressor({
      threshold: -18,
      ratio: 3,
      attack: 0.003,
      release: 0.1
    });
    var limiter = new Tone.Limiter(-1);

    bus.connect(reverb);
    reverb.connect(compressor);
    compressor.connect(limiter);
    limiter.toDestination();
  }

  function buildVoices() {
    voices = {};
    Object.keys(VOICE_SPECS).forEach(function (name) {
      var spec = VOICE_SPECS[name];
      var voice = { spec: spec, baseDecay: spec.options.envelope.decay };

      if (spec.kind === "membrane") {
        voice.synth = new Tone.MembraneSynth(spec.options);
        voice.baseHz = noteHz(spec);
        voice.synth.connect(bus);
      } else if (spec.kind === "metal") {
        voice.synth = new Tone.MetalSynth(spec.options);
        voice.baseHz = noteHz(spec);
        voice.synth.connect(bus);
      } else {
        voice.synth = new Tone.NoiseSynth(spec.options);
        voice.filter = new Tone.Filter(spec.filter);
        voice.baseFilterHz = spec.filter.frequency;
        voice.synth.connect(voice.filter);
        voice.filter.connect(bus);
      }

      voices[name] = voice;
    });
  }

  /*
   * Epic 6.3, the expressive bit. x drives pitch - or the bandpass, for the
   * two noise voices, which have no pitch of their own. y drives decay and
   * velocity together, so the top of a pad is short and soft and the bottom is
   * long and heavy. Shift forces full velocity.
   *
   * The envelope is set immediately before the trigger, so a scheduled copy
   * and a live hit each read their own weight even when they land together.
   */
  function fireVoice(name, x, y, time, accent) {
    var voice = voices && voices[name];
    if (!voice) return;

    var pitchMul = 0.75 + clamp01(x) * 0.75;
    var decayMul = 0.5 + clamp01(y) * 1.1;
    var velocity = accent ? 1 : 0.55 + clamp01(y) * 0.45;

    try {
      voice.synth.envelope.decay = voice.baseDecay * decayMul;
      if (voice.filter) {
        voice.filter.frequency.setValueAtTime(voice.baseFilterHz * pitchMul, time);
        voice.synth.triggerAttackRelease(voice.spec.dur, time, velocity);
      } else {
        voice.synth.triggerAttackRelease(voice.baseHz * pitchMul, voice.spec.dur, time, velocity);
      }
    } catch (err) {
      /* One voice failing must never take the whole instrument down. */
      if (window.console && console.warn) console.warn("Roundhouse: voice " + name, err);
    }
  }

  /* ---------------------------------------------------------- the loop -- */

  function startTransport() {
    transport = typeof Tone.getTransport === "function" ? Tone.getTransport() : Tone.Transport;
    draw = typeof Tone.getDraw === "function" ? Tone.getDraw() : null;

    transport.loop = true;
    transport.loopStart = 0;
    transport.loopEnd = "1m";
    transport.bpm.value = currentBpm;
    transport.scheduleRepeat(onSixteenth, "16n", 0);
    transport.start();
  }

  /*
   * The sixteenth-note callback. Everything audible fires at the `time` Tone
   * hands in - never at Tone.now() in here, which would jitter - and
   * everything visible goes through Tone.Draw so the flash lands with the
   * sound rather than a frame or two away from it.
   */
  function onSixteenth(time) {
    stepIndex += 1;
    if (stepIndex >= STEPS) {
      stepIndex = 0;
      loopPass += 1;
    }

    var step = stepIndex;
    var slots = grid[step];
    var painting = [];

    slots.forEach(function (slot) {
      /* The pass a slot was laid down on is skipped: the live hit has already
       * sounded, and playing the copy too would be an audible flam. From the
       * next time round it plays like anything else. */
      if (slot.recordedOnPass === loopPass) return;
      fireVoice(slot.voice, slot.x, slot.y, time, slot.accent);
      painting.push(slot);
    });

    var armed = slots.size > 0;
    if (!armed && painting.length === 0) return;

    /*
     * A replayed hit gets the same flash, the same ripple and the same
     * anchor point as the live one that recorded it. That is the whole
     * argument of the piece: the loop is not a separate machine playing back
     * at you, it is your own hits going round. If only live hits lit up, a
     * stranger would never see that they had caused the groove.
     */
    var paint = function () {
      if (armed) flashTick(step);
      painting.forEach(function (slot) {
        pulseTrail(slot);
        flashPad(slot.pad, slot.x, slot.y);
        addRipple(slot.pad, slot.x, slot.y);
      });
    };

    if (draw && typeof draw.schedule === "function") draw.schedule(paint, time);
    else paint();
  }

  /*
   * Quantise to the nearest sixteenth. Math.round can land on 16, which is
   * step 0 of the next time round - the slot belongs to that pass, and saying
   * so is what keeps the flam guard honest across the bar line.
   */
  function quantise() {
    if (!transport) return { step: 0, pass: loopPass };
    var raw = Math.round(transport.progress * STEPS);
    if (typeof raw !== "number" || !isFinite(raw) || raw < 0) raw = 0;
    return { step: raw % STEPS, pass: loopPass + (raw >= STEPS ? 1 : 0) };
  }

  function recordHit(pad, x, y, accent) {
    var at = quantise();
    var slots = grid[at.step];
    var previous = slots.get(pad.id);
    if (previous) removeTrail(previous);

    var slot = {
      padId: pad.id,
      pad: pad,
      voice: pad.voice,
      step: at.step,
      x: x,
      y: y,
      accent: accent === true,
      recordedOnPass: at.pass
    };
    slot.trail = addTrail(pad, x, y);
    slots.set(pad.id, slot);
    /* Pulse it now, not just on the next pass round: the dot has to be seen
     * arriving or the constellation looks like it grew on its own. */
    pulseTrail(slot);
    armTick(at.step, true);
    /* And flash the step it landed on. The strip is the only thing on screen
     * that shows WHEN, so this is the moment the player can see their hit
     * being written down - the tick under the playhead lights because of
     * them. Without it, the first evidence that anything was recorded is the
     * sound coming back a whole bar later, with nothing having connected the
     * two. */
    flashTick(at.step);
  }

  function clearPattern() {
    grid.forEach(function (slots) {
      slots.forEach(removeTrail);
      slots.clear();
    });
    pads.forEach(function (pad) {
      if (pad.trails) pad.trails.textContent = "";
    });
    tickEls.forEach(function (tick) {
      tick.classList.remove("is-armed");
      tick.classList.remove("is-flash");
    });
    tickTimers.forEach(function (id) {
      clearTimeout(id);
    });
    tickTimers.clear();
    /* The transport keeps running. An empty bar still pulses, so the silence
     * reads as an invitation to play again rather than as a stop. */
  }

  /* ------------------------------------------------------ visual state -- */

  /* One shared pair of numbers on #pads. All eight crosshairs read it, which
   * is what makes the keyboard's aim visible (epic 7.3 and 8.2). */
  function setStrikePoint(x, y) {
    strikeX = clamp01(x);
    strikeY = clamp01(y);
    padsEl.style.setProperty("--strike-x", strikeX.toFixed(4));
    padsEl.style.setProperty("--strike-y", strikeY.toFixed(4));
  }

  function nudgeStrikePoint(dx, dy) {
    setStrikePoint(strikeX + dx, strikeY + dy);
  }

  /*
   * The flash. --hit-x / --hit-y anchor the bloom on the point that was
   * struck, so the top-right of a pad and the bottom-left of the same pad do
   * not look identical - which matters, because they do not sound identical
   * either (epic 6.3). A replayed hit passes the point it was recorded at, so
   * the loop shows you where you played, not just that you played.
   */
  function flashPad(pad, x, y) {
    var el = pad.el;
    if (typeof x === "number") el.style.setProperty("--hit-x", clamp01(x).toFixed(4));
    if (typeof y === "number") el.style.setProperty("--hit-y", clamp01(y).toFixed(4));
    if (el.classList.contains("is-hit")) {
      /* Only a re-hit inside the flash window needs the reflow that restarts
       * the animation; the common case adds the class and costs nothing. */
      el.classList.remove("is-hit");
      void el.offsetWidth;
    }
    el.classList.add("is-hit");
    clearTimeout(hitTimers.get(pad.id));
    hitTimers.set(
      pad.id,
      setTimeout(function () {
        el.classList.remove("is-hit");
      }, motion.flash)
    );
  }

  function armTick(step, on) {
    var tick = tickEls[step];
    if (!tick) return;
    if (on) tick.classList.add("is-armed");
    else tick.classList.remove("is-armed");
  }

  function flashTick(step) {
    var tick = tickEls[step];
    if (!tick) return;
    if (tick.classList.contains("is-flash")) {
      tick.classList.remove("is-flash");
      void tick.offsetWidth;
    }
    tick.classList.add("is-flash");
    clearTimeout(tickTimers.get(step));
    tickTimers.set(
      step,
      setTimeout(function () {
        tick.classList.remove("is-flash");
      }, motion.tick)
    );
  }

  function addRipple(pad, x, y) {
    if (!pad.fx) return;
    /* A full bar of a full pattern is 128 hits in 2.5s. Three rings at once
     * on one pad already reads as a flurry; past that it is just paint. */
    while (pad.fx.childElementCount >= MAX_RIPPLES_PER_PAD) {
      pad.fx.removeChild(pad.fx.firstElementChild);
    }
    var ripple = document.createElement("span");
    ripple.className = "ripple";
    ripple.style.setProperty("--rx", clamp01(x).toFixed(4));
    ripple.style.setProperty("--ry", clamp01(y).toFixed(4));
    var drop = function () {
      if (ripple.parentNode) ripple.parentNode.removeChild(ripple);
    };
    ripple.addEventListener("animationend", drop);
    /* Belt and braces: with no animation styled, animationend never comes and
     * the layer would fill up. */
    setTimeout(drop, motion.ripple + 700);
    pad.fx.appendChild(ripple);
  }

  function addTrail(pad, x, y) {
    if (!pad.trails) return null;
    var trail = document.createElement("span");
    trail.className = "trail";
    trail.style.setProperty("--tx", clamp01(x).toFixed(4));
    trail.style.setProperty("--ty", clamp01(y).toFixed(4));
    pad.trails.appendChild(trail);
    return trail;
  }

  function removeTrail(slot) {
    if (slot && slot.trail && slot.trail.parentNode) {
      slot.trail.parentNode.removeChild(slot.trail);
    }
  }

  function pulseTrail(slot) {
    var trail = slot.trail;
    if (!trail) return;
    if (trail.classList.contains("is-pulse")) {
      trail.classList.remove("is-pulse");
      void trail.offsetWidth;
    }
    trail.classList.add("is-pulse");
    clearTimeout(trail.__pulse);
    trail.__pulse = setTimeout(function () {
      trail.classList.remove("is-pulse");
    }, motion.trail);
  }

  /*
   * Where the bar has got to, as the player HEARS it.
   *
   * Tone.Transport.progress is measured at context.now(), which is
   * currentTime + lookAhead - it is the scheduler's position, 50ms into the
   * future. Driving the sweep off it puts the line over a tick about 17px
   * before the sound arrives, and the eye catches that: the playhead leads
   * the kick. getSecondsAtTime(rawContext.currentTime) asks the same
   * question about the audible instant instead, which is what the strip is
   * supposed to be showing. Measured: 49.1ms of lead removed at 96 BPM.
   */
  function audibleProgress() {
    if (!transport) return null;
    var raw = rawAudioContext();
    if (raw && typeof transport.getSecondsAtTime === "function") {
      try {
        var loopSeconds = transport.toSeconds(transport.loopEnd);
        if (loopSeconds > 0) {
          var seconds = transport.getSecondsAtTime(raw.currentTime);
          if (typeof seconds === "number" && isFinite(seconds)) {
            var fraction = (seconds / loopSeconds) % 1;
            return fraction < 0 ? fraction + 1 : fraction;
          }
        }
      } catch (err) {
        /* Fall through to the scheduler's own reading. */
      }
    }
    var progress = transport.progress;
    return typeof progress === "number" && isFinite(progress) ? progress : null;
  }

  function runSweep() {
    var at = audibleProgress();
    if (at !== null) stripEl.style.setProperty("--sweep", at.toFixed(4));
    sweepFrame = requestAnimationFrame(runSweep);
  }

  /* The one opening-screen switch, flipped exactly once (epic 9.2). */
  function goLive() {
    if (instrumentEl.getAttribute("data-phase") === "live") return;
    instrumentEl.setAttribute("data-phase", "live");
    firstGestureAt = Date.now();
    if (!sweepFrame) sweepFrame = requestAnimationFrame(runSweep);
    watchForHint();
  }

  /* -------------------------------------------------- the keyboard hint -- */

  function showHint() {
    if (!keyhintEl || hintUsed) return;
    hintUsed = true;
    keyhintEl.setAttribute("data-visible", "true");
    hintHideTimer = setTimeout(hideHint, 8000);
  }

  function hideHint() {
    if (!keyhintEl) return;
    clearTimeout(hintHideTimer);
    keyhintEl.setAttribute("data-visible", "false");
  }

  /* Epic 9.3: only after twelve seconds, three pointer strikes and no keyboard
   * strike at all - and only once per page load. */
  function watchForHint() {
    if (!keyhintEl || hintPoll) return;
    hintPoll = setInterval(function () {
      if (hintUsed || keyStrikes > 0 || Date.now() - firstGestureAt > 120000) {
        clearInterval(hintPoll);
        hintPoll = 0;
        return;
      }
      if (Date.now() - firstGestureAt >= 12000 && pointerStrikes >= 3) showHint();
    }, 1000);
  }

  /* ---------------------------------------------------------- the boot -- */

  function bootAudio() {
    if (!NativeAudioContext) {
      if (window.console && console.warn) console.warn("Roundhouse: " + audioContextReport());
      /* Nothing to boot, but the pads must still answer rather than breathe
       * on forever, so the opening screen gets out of the way regardless. */
      goLive();
      return Promise.resolve(false);
    }

    try {
      /* Epic 6.1: an interactive context, so the hardware buffer is small.
       * lookAhead stays roomy enough for the transport to schedule cleanly;
       * live hits sidestep it entirely by firing at Tone.immediate(). */
      Tone.setContext(
        new Tone.Context({ latencyHint: "interactive", lookAhead: 0.05, updateInterval: 0.025 })
      );
    } catch (err) {
      /* Tone falls back to a context of its own making; carry on. */
    }

    return resumeAudioContext()
      .then(function () {
        buildChain();
        buildVoices();
        /* The reverb renders its impulse response off-thread and the chain
         * passes dry signal meanwhile, so a slow render must not hold up the
         * very first hit: wait for it, but not for long. */
        return Promise.race([
          Promise.resolve(reverb && reverb.ready).catch(function () {
            return null;
          }),
          wait(REVERB_WAIT_CAP_MS)
        ]);
      })
      .then(function () {
        startTransport();
        audioReady = true;
        goLive();
        return true;
      })
      .catch(function (err) {
        if (window.console && console.error) console.error("Roundhouse: audio boot failed", err);
        /* Flip the screen anyway - the pads must not sit there breathing
         * forever just because the audio did not come up. */
        goLive();
        return false;
      });
  }

  function ensureAudio() {
    /* One boot, shared: two fingers landing together must not race. */
    if (!bootPromise) bootPromise = bootAudio();
    return bootPromise;
  }

  /* -------------------------------------------------------- the strike -- */

  /*
   * Every hit, from every input, comes through here. The body up to the first
   * await runs synchronously inside the event handler, and once audioReady is
   * true there is no await left on the path at all - which is what keeps a hit
   * immediate however much else is already sounding.
   */
  async function strike(pad, x, y, accent, viaPointer) {
    if (viaPointer) {
      setStrikePoint(x, y);
      pointerStrikes += 1;
    } else {
      keyStrikes += 1;
      if (hintUsed) hideHint();
    }

    flashPad(pad, x, y);
    addRipple(pad, x, y);

    if (!audioReady) {
      await ensureAudio();
      if (!audioReady) return;
    }

    fireVoice(pad.voice, x, y, Tone.immediate(), accent);
    recordHit(pad, x, y, accent);
  }

  /* Fire and forget, but never silently: strike() is async, so a throw on the
   * far side of the boot await would otherwise surface as an unhandled
   * rejection with no clue where it came from. */
  function play(pad, x, y, accent, viaPointer) {
    strike(pad, x, y, accent, viaPointer).catch(function (err) {
      if (window.console && console.error) console.error("Roundhouse: strike failed", err);
    });
  }

  /* ------------------------------------------------------------ pointer -- */

  function strikePointFromEvent(padEl, event) {
    var rect = padEl.getBoundingClientRect();
    if (!rect.width || !rect.height) return { x: strikeX, y: strikeY };
    return {
      x: clamp01((event.clientX - rect.left) / rect.width),
      y: clamp01((event.clientY - rect.top) / rect.height)
    };
  }

  /*
   * pointerdown, not click: click fires on release, which is far too late for
   * a drum. Delegating from #pads keeps multi-touch working - every finger
   * arrives as its own pointerdown with its own pointerId, so two pads sound
   * at once. Dragging across pads deliberately does not retrigger.
   */
  padsEl.addEventListener("pointerdown", function (event) {
    var padEl = event.target && event.target.closest ? event.target.closest(".pad") : null;
    if (!padEl) return;
    var pad = padByEl.get(padEl);
    if (!pad) return;
    var point = strikePointFromEvent(padEl, event);
    play(pad, point.x, point.y, event.shiftKey === true, true);
  });

  /* ----------------------------------------------------------- keyboard -- */

  /* Arrows belong to whatever control has focus; they only move the strike
   * point when focus is loose or sitting on a pad. */
  function focusIsOnAControl() {
    var el = document.activeElement;
    if (!el || el === document.body || el === document.documentElement) return false;
    return !(el.classList && el.classList.contains("pad"));
  }

  window.addEventListener("keydown", function (event) {
    if (event.repeat) return; /* holding a key must not roll */
    var code = event.code;

    if (code === "ArrowLeft" || code === "ArrowRight" || code === "ArrowUp" || code === "ArrowDown") {
      if (focusIsOnAControl()) return; /* the speed slider keeps its arrows */
      event.preventDefault();
      if (code === "ArrowLeft") nudgeStrikePoint(-STRIKE_NUDGE, 0);
      else if (code === "ArrowRight") nudgeStrikePoint(STRIKE_NUDGE, 0);
      else if (code === "ArrowUp") nudgeStrikePoint(0, -STRIKE_NUDGE);
      else nudgeStrikePoint(0, STRIKE_NUDGE);
      return;
    }

    if (code === "Space" || code === "Enter" || code === "NumpadEnter") {
      var focused = document.activeElement;
      var focusedPad = focused ? padByEl.get(focused) : null;
      if (!focusedPad) return; /* Clear and the nav link keep native behaviour */
      /* preventDefault so the browser does not also synthesise a click. No
       * click listener is registered on the pads, for the same reason. */
      event.preventDefault();
      play(focusedPad, strikeX, strikeY, event.shiftKey === true, false);
      return;
    }

    var pad = padByCode.get(code);
    if (!pad) return;
    if (heldKeys.has(code)) return;
    heldKeys.add(code); /* several pad keys can be down at once; each fires */
    event.preventDefault();
    play(pad, strikeX, strikeY, event.shiftKey === true, false);
  });

  window.addEventListener("keyup", function (event) {
    heldKeys.delete(event.code);
  });

  window.addEventListener("blur", function () {
    heldKeys.clear();
  });

  /* ----------------------------------------------------------- controls -- */

  function applyBpm(value) {
    currentBpm = clamp(Math.round(value), MIN_BPM, MAX_BPM);
    if (bpmEl) bpmEl.textContent = String(currentBpm);
    if (speedEl) speedEl.setAttribute("aria-valuetext", currentBpm + " BPM");
    /* Live: the groove keeps running and stretches under the player's hand. */
    if (transport) transport.bpm.value = currentBpm;
  }

  /* The stylesheet is the single source of truth for how long anything is
   * held on screen; this keeps the timers in step with it, including when a
   * reader turns reduced motion on or off while the page is open. */
  readMotion();
  if (typeof window.matchMedia === "function") {
    var reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (typeof reduced.addEventListener === "function") {
      reduced.addEventListener("change", readMotion);
    } else if (typeof reduced.addListener === "function") {
      reduced.addListener(readMotion);
    }
  }

  if (speedEl) {
    speedEl.addEventListener("input", function () {
      applyBpm(parseInt(speedEl.value, 10));
    });
    applyBpm(parseInt(speedEl.value, 10) || DEFAULT_BPM);
  }

  if (clearEl) {
    /* A real button, so Enter and Space reach this for free. */
    clearEl.addEventListener("click", function () {
      clearPattern();
    });
  }

  /* -------------------------------------------------------- diagnostics -- */

  window.roundhouse = {
    audioContext: audioContextReport,
    isReady: function () {
      return audioReady;
    },
    bpm: function () {
      return currentBpm;
    },
    strikePoint: function () {
      return { x: strikeX, y: strikeY };
    },
    slots: function () {
      return grid.reduce(function (total, slots) {
        return total + slots.size;
      }, 0);
    },
    clear: clearPattern
  };
})();
