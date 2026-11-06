#!/usr/bin/env node
/**
 * Generates the three 8-bit chiptune SFX as 16-bit mono WAV files
 * (square-wave notes with short fades — classic NES feel):
 *   sfx_nearby.wav  — two-tone rising alert   (proximity trigger)
 *   sfx_reward.wav  — C5-E5-G5-C6 arpeggio    (reward granted)
 *   sfx_levelup.wav — short fanfare           (level up)
 *
 * Output: android/app/src/main/res/raw/  (loaded automatically by
 * react-native-sound on Android) and ios/MontQuest/Sounds/ (drag this
 * folder into the Xcode MontQuest target once — see RELEASE_CHECKLIST.md).
 *
 * Usage: node scripts/gen-sfx.js
 */
const fs = require('fs');
const path = require('path');

const SAMPLE_RATE = 22050;
const AMP = 0.22; // headroom so overlapping notes never clip

const NOTES = {
  nearby: [
    { freq: 659.26, ms: 110 }, // E5
    { freq: 0, ms: 30 }, // gap
    { freq: 880.0, ms: 150 }, // A5
  ],
  reward: [
    { freq: 523.25, ms: 80 }, // C5
    { freq: 659.26, ms: 80 }, // E5
    { freq: 783.99, ms: 80 }, // G5
    { freq: 1046.5, ms: 150 }, // C6
  ],
  levelup: [
    { freq: 523.25, ms: 90 },
    { freq: 659.26, ms: 90 },
    { freq: 783.99, ms: 90 },
    { freq: 1046.5, ms: 90 },
    { freq: 783.99, ms: 70 },
    { freq: 1318.5, ms: 220 }, // E6 finish
  ],
};

/** Square wave (8-bit style), 6ms fade in/out per note to avoid clicks. */
function synthNote(freq, ms) {
  const n = Math.round((SAMPLE_RATE * ms) / 1000);
  const out = new Float64Array(n);
  const fade = Math.min(Math.round(SAMPLE_RATE * 0.006), Math.floor(n / 2));
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const square = freq === 0 ? 0 : Math.sign(Math.sin(2 * Math.PI * freq * t));
    let env = 1;
    if (fade > 0) {
      if (i < fade) {env = i / fade;}
      else if (i >= n - fade) {env = (n - i) / fade;}
    }
    out[i] = AMP * square * env;
  }
  return out;
}

function buildSamples(name) {
  const parts = NOTES[name].map((n) => synthNote(n.freq, n.ms));
  const total = parts.reduce((a, p) => a + p.length, 0);
  const buf = new Float64Array(total);
  let off = 0;
  for (const p of parts) {
    buf.set(p, off);
    off += p.length;
  }
  return buf;
}

function wavHeader(dataBytes) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0);
  h.writeUInt32LE(36 + dataBytes, 4);
  h.write('WAVE', 8);
  h.write('fmt ', 12);
  h.writeUInt32LE(16, 16); // PCM chunk size
  h.writeUInt16LE(1, 20); // PCM
  h.writeUInt16LE(1, 22); // mono
  h.writeUInt32LE(SAMPLE_RATE, 24);
  h.writeUInt32LE(SAMPLE_RATE * 2, 28); // byte rate
  h.writeUInt16LE(2, 32); // block align
  h.writeUInt16LE(16, 34); // bits per sample
  h.write('data', 36);
  h.writeUInt32LE(dataBytes, 40);
  return h;
}

function toWav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++) {
    data.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(samples[i] * 32767))), i * 2);
  }
  return Buffer.concat([wavHeader(data.length), data]);
}

const targets = [
  path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res', 'raw'),
  path.join(__dirname, '..', 'ios', 'MontQuest', 'Sounds'),
];

for (const dir of targets) {
  fs.mkdirSync(dir, { recursive: true });
  for (const name of Object.keys(NOTES)) {
    const wav = toWav(buildSamples(name));
    const file = path.join(dir, `sfx_${name}.wav`);
    fs.writeFileSync(file, wav);
    console.log(`${file}  (${wav.length} bytes, ${(wav.length / 44 / 1000).toFixed(0)}ms)`);
  }
}
