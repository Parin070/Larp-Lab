// Zero-dependency procedural Web Audio synthesizer for arcade sound effects

export function createAudio() {
  let ctx = null;

  function getContext() {
    if (typeof window === 'undefined') return null;
    if (!ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        ctx = new AudioCtx();
      }
    }
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    return ctx;
  }

  return {
    init() {
      getContext();
    },

    // Dual-tone coin / cash chime
    playCoin() {
      const c = getContext();
      if (!c) return;

      const now = c.currentTime;
      const osc1 = c.createOscillator();
      const osc2 = c.createOscillator();
      const gain = c.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(987.77, now); // B5
      osc1.frequency.setValueAtTime(1318.51, now + 0.08); // E6

      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(1975.53, now); // B6
      osc2.frequency.setValueAtTime(2637.02, now + 0.08); // E7

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(c.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.36);
      osc2.stop(now + 0.36);
    },

    // Rising 4-tone arcade arpeggio for starting a mission
    playQuestStart() {
      const c = getContext();
      if (!c) return;

      const now = c.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      const noteDuration = 0.07;

      notes.forEach((freq, idx) => {
        const startTime = now + idx * noteDuration;
        const osc = c.createOscillator();
        const gain = c.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0.18, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + noteDuration * 1.5);

        osc.connect(gain);
        gain.connect(c.destination);

        osc.start(startTime);
        osc.stop(startTime + noteDuration * 1.6);
      });
    },

    // Celebratory victory fanfare chord progression
    playSuccess() {
      const c = getContext();
      if (!c) return;

      const now = c.currentTime;
      const chords = [
        { freqs: [523.25, 659.25, 783.99], start: 0, dur: 0.14 },    // C Major
        { freqs: [587.33, 739.99, 880.00], start: 0.15, dur: 0.14 }, // D Major
        { freqs: [659.25, 830.61, 987.77], start: 0.30, dur: 0.14 }, // E Major
        { freqs: [1046.50, 1318.51, 1567.98], start: 0.45, dur: 0.50 } // High C
      ];

      chords.forEach(chord => {
        const chordStart = now + chord.start;
        chord.freqs.forEach(freq => {
          const osc = c.createOscillator();
          const gain = c.createGain();

          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, chordStart);

          gain.gain.setValueAtTime(0.12, chordStart);
          gain.gain.exponentialRampToValueAtTime(0.001, chordStart + chord.dur);

          osc.connect(gain);
          gain.connect(c.destination);

          osc.start(chordStart);
          osc.stop(chordStart + chord.dur + 0.05);
        });
      });
    },

    // Descending failure buzz
    playQuestFail() {
      const c = getContext();
      if (!c) return;

      const now = c.currentTime;
      const osc = c.createOscillator();
      const gain = c.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.linearRampToValueAtTime(80, now + 0.4);

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      osc.connect(gain);
      gain.connect(c.destination);

      osc.start(now);
      osc.stop(now + 0.46);
    },

    // Comedic dialogue voice blip
    playVoiceBeep(pitchOffset = 0) {
      const c = getContext();
      if (!c) return;

      const now = c.currentTime;
      const osc = c.createOscillator();
      const gain = c.createGain();

      const baseFreq = 420 + (pitchOffset % 120);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(baseFreq, now);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.3, now + 0.04);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

      osc.connect(gain);
      gain.connect(c.destination);

      osc.start(now);
      osc.stop(now + 0.06);
    },

    // Item pickup pop
    playPickup() {
      const c = getContext();
      if (!c) return;

      const now = c.currentTime;
      const osc = c.createOscillator();
      const gain = c.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(350, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.08);

      gain.gain.setValueAtTime(0.16, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

      osc.connect(gain);
      gain.connect(c.destination);

      osc.start(now);
      osc.stop(now + 0.11);
    },

    // Warning timer tick
    playTick() {
      const c = getContext();
      if (!c) return;

      const now = c.currentTime;
      const osc = c.createOscillator();
      const gain = c.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(800, now);

      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

      osc.connect(gain);
      gain.connect(c.destination);

      osc.start(now);
      osc.stop(now + 0.05);
    }
  };
}
