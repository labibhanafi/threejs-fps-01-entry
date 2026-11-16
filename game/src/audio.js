// NIGHTHAUL — synthesized WebAudio sound. No audio files: every effect is an
// oscillator or a filtered noise burst built at call time. Silent until the
// player clicks (the browser's autoplay rule), and a no-op before that.

let ctx = null;
let noiseBuf = null;

export function ensureAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    const len = ctx.sampleRate * 0.5;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  } catch { ctx = null; }
}

function noise(dur, filterFreq, gain, when = 0) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.value = filterFreq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, ctx.currentTime + when);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + when + dur);
  src.connect(f); f.connect(g); g.connect(ctx.destination);
  src.start(ctx.currentTime + when);
  src.stop(ctx.currentTime + when + dur);
}

function tone(freq, dur, type, gain, slideTo = 0, when = 0) {
  const o = ctx.createOscillator();
  o.type = type; o.frequency.setValueAtTime(freq, ctx.currentTime + when);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + when + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, ctx.currentTime + when);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + when + dur);
  o.connect(g); g.connect(ctx.destination);
  o.start(ctx.currentTime + when);
  o.stop(ctx.currentTime + when + dur);
}

export function playSound(name, pitch = 1) {
  if (!ctx) return;
  try {
    switch (name) {
      case 'shot':
        noise(0.09, 3200 * pitch, 0.5);
        tone(160 * pitch, 0.07, 'square', 0.16, 60 * pitch);
        break;
      case 'hit': tone(1250, 0.06, 'sine', 0.22); break;
      case 'kill': tone(880, 0.08, 'sine', 0.25); tone(1320, 0.12, 'sine', 0.25, 0, 0.08); break;
      case 'reload': tone(500, 0.05, 'square', 0.1); tone(700, 0.05, 'square', 0.1, 0, 0.12); break;
      case 'buy': tone(880, 0.09, 'sine', 0.2); tone(1174, 0.12, 'sine', 0.2, 0, 0.09); break;
      case 'blast': noise(0.5, 500, 0.9); tone(70, 0.4, 'sine', 0.5, 35); break;
      case 'pulse': tone(880, 0.5, 'sine', 0.22, 440); tone(1760, 0.3, 'sine', 0.08, 880, 0.1); break;
      case 'round': tone(220, 0.4, 'sawtooth', 0.14, 330); break;
      case 'pickup': tone(660, 0.1, 'sine', 0.2); tone(990, 0.14, 'sine', 0.2, 0, 0.1); break;
      case 'upload': tone(440, 0.3, 'sine', 0.15, 880); break;
      case 'step': noise(0.04, 900, 0.05); break;
      default: break;
    }
  } catch { /* audio is cosmetic; never break the game */ }
}
