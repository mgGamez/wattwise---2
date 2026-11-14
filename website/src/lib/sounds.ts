// Door sounds for the landing page, synthesised with the Web Audio API (no audio files).
// Browsers only allow audio after a user gesture, so the context is created when the
// user turns sound on.

let ctx: AudioContext | null = null;

export function enableSound() {
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return false;
  ctx ??= new AC();
  void ctx.resume();
  return true;
}

function noise(c: AudioContext, seconds: number) {
  const buf = c.createBuffer(1, Math.ceil(c.sampleRate * seconds), c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  return src;
}

/** Short metallic latch click. */
export function playLatch() {
  if (!ctx) return;
  const c = ctx;
  const t = c.currentTime;
  const src = noise(c, 0.06);
  const band = c.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = 2400;
  band.Q.value = 6;
  const gain = c.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.6, t + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
  src.connect(band).connect(gain).connect(c.destination);
  src.start(t);
  src.stop(t + 0.06);
}

/** Soft air whoosh as the door swings. */
export function playWhoosh() {
  if (!ctx) return;
  const c = ctx;
  const t = c.currentTime;
  const dur = 0.7;
  const src = noise(c, dur);
  const low = c.createBiquadFilter();
  low.type = "lowpass";
  low.frequency.setValueAtTime(350, t);
  low.frequency.exponentialRampToValueAtTime(2200, t + dur * 0.45);
  low.frequency.exponentialRampToValueAtTime(500, t + dur);
  const gain = c.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.28, t + dur * 0.4);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(low).connect(gain).connect(c.destination);
  src.start(t);
  src.stop(t + dur);
}
