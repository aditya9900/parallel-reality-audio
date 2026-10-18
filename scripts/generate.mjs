// Generates every voice line and sound for the grid rooms with ElevenLabs.
//
//   npm run voices     list the voices your key can use (free plan = premade voices only)
//   npm run estimate   show how much text/sound would be generated, without spending credits
//   npm run generate   generate whatever is missing (existing files are skipped)
//
// Flags: --force (regenerate everything), --only=<id prefix>, --voices-only, --sfx-only
//
// The API key is read from .env and only ever used here, never shipped to the browser.
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { CHARACTERS, LINES, SOUNDS } from '../src/story.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const audioDir = join(root, 'public', 'audio');
const API = 'https://api.elevenlabs.io';

const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const only = args.find((a) => a.startsWith('--only='))?.split('=')[1];

function loadEnv() {
  const p = join(root, '.env');
  if (!existsSync(p)) return;
  for (const raw of readFileSync(p, 'utf8').split('\n')) {
    const m = raw.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}
loadEnv();

const KEY = process.env.ELEVENLABS_API_KEY;
const MODEL = process.env.MODEL_ID || 'eleven_multilingual_v2';

async function api(path, init = {}) {
  const res = await fetch(API + path, { ...init, headers: { 'xi-api-key': KEY, ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers } });
  if (!res.ok) {
    const body = await res.text();
    const err = new Error(`${res.status} ${path}: ${body.slice(0, 400)}`);
    err.status = res.status;
    throw err;
  }
  return res;
}

async function usage() {
  try {
    const s = await (await api('/v1/user/subscription')).json();
    return { used: s.character_count, limit: s.character_limit, tier: s.tier };
  } catch (e) {
    return null;
  }
}

async function listVoices() {
  const data = await (await api('/v1/voices')).json();
  return data.voices;
}

// Free plans can only use ElevenLabs' premade voices through the API.
// Voice Library voices need a paid plan, so they're excluded unless ALLOW_LIBRARY_VOICES=1.
function pickVoices(voices) {
  const usable = process.env.ALLOW_LIBRARY_VOICES === '1' ? voices : voices.filter((v) => v.category === 'premade');
  if (!usable.length) throw new Error('No premade voices returned for this key. Check that the key has Voices: Read permission.');
  const chosen = {};
  const taken = new Set();
  for (const [id, ch] of Object.entries(CHARACTERS)) {
    const override = process.env[`VOICE_${id.toUpperCase()}`];
    const prefs = override ? [override] : ch.voicePrefs;
    let v = null;
    for (const p of prefs) {
      v = usable.find((x) => !taken.has(x.voice_id) && (x.voice_id === p || x.name.toLowerCase().startsWith(p.toLowerCase())));
      if (v) break;
    }
    v ||= usable.find((x) => !taken.has(x.voice_id));
    taken.add(v.voice_id);
    chosen[id] = { voice_id: v.voice_id, name: v.name };
  }
  return chosen;
}

const sfxSeconds = () => Object.values(SOUNDS).reduce((s, x) => s + x.seconds, 0);
const want = (id) => !only || id.startsWith(only);

function writeManifest() {
  const files = [];
  for (const sub of ['voice', 'sfx']) {
    const d = join(audioDir, sub);
    if (existsSync(d)) readdirSync(d).filter((f) => f.endsWith('.mp3')).forEach((f) => files.push(`audio/${sub}/${f}`));
  }
  writeFileSync(join(audioDir, 'manifest.json'), JSON.stringify({ generatedAt: new Date().toISOString(), files }, null, 2));
  return files.length;
}

async function main() {
  mkdirSync(join(audioDir, 'voice'), { recursive: true });
  mkdirSync(join(audioDir, 'sfx'), { recursive: true });

  const lineIds = Object.keys(LINES).filter(want);
  const soundIds = Object.keys(SOUNDS).filter(want);
  const chars = lineIds.reduce((s, id) => s + LINES[id].text.length, 0);

  if (flag('dry-run')) {
    console.log(`Voice lines: ${lineIds.length} clips, ${chars} characters (model ${MODEL})`);
    console.log(`Sound effects: ${soundIds.length} loops, ${sfxSeconds()} seconds total`);
    console.log('Credits used = roughly 1 per character for speech on most models, plus the sound-effect cost.');
    console.log('Run "npm run generate" and it will print your real balance before and after.');
    return;
  }

  if (!KEY) {
    console.error('Missing ELEVENLABS_API_KEY. Copy .env.example to .env and paste your key.');
    process.exit(1);
  }

  const voices = await listVoices();
  if (flag('list-voices')) {
    const premade = voices.filter((v) => v.category === 'premade');
    console.log(`Premade voices you can use on the free plan (${premade.length}):`);
    premade.forEach((v) => console.log(`  ${v.name.padEnd(28)} ${v.voice_id}  ${Object.values(v.labels || {}).join(', ')}`));
    const other = voices.filter((v) => v.category !== 'premade');
    if (other.length) console.log(`\nOther voices on this account (need a paid plan for API use): ${other.map((v) => v.name).join(', ')}`);
    console.log('\nWould pick:', pickVoices(voices));
    return;
  }

  const cast = pickVoices(voices);
  writeFileSync(join(audioDir, 'voices.json'), JSON.stringify(cast, null, 2));
  console.log('Cast:', Object.entries(cast).map(([k, v]) => `${k}=${v.name}`).join(', '));

  const before = await usage();
  if (before) console.log(`Plan: ${before.tier}. Credits used ${before.used} of ${before.limit} (${before.limit - before.used} left).`);
  if (before && !flag('sfx-only') && before.limit - before.used < chars) {
    console.error(`Not enough credits for ${chars} characters of speech. Use --only=<prefix> to generate a subset.`);
    process.exit(1);
  }

  let made = 0, skipped = 0, failed = 0;

  if (!flag('sfx-only')) {
    for (const id of lineIds) {
      const out = join(audioDir, 'voice', `${id}.mp3`);
      if (existsSync(out) && !flag('force')) { skipped++; continue; }
      const { speaker, text } = LINES[id];
      try {
        const t0 = Date.now();
        const res = await api(`/v1/text-to-speech/${cast[speaker].voice_id}?output_format=mp3_44100_128`, {
          method: 'POST',
          body: JSON.stringify({ text, model_id: MODEL, voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.25 } }),
        });
        writeFileSync(out, Buffer.from(await res.arrayBuffer()));
        console.log(`  voice ${id.padEnd(12)} ${speaker.padEnd(9)} ${((Date.now() - t0) / 1000).toFixed(1)}s`);
        made++;
      } catch (e) {
        console.error(`  voice ${id} FAILED: ${e.message}`);
        failed++;
        if (e.status === 401 || e.status === 402) break;
      }
    }
  }

  if (!flag('voices-only')) {
    for (const id of soundIds) {
      const out = join(audioDir, 'sfx', `${id}.mp3`);
      if (existsSync(out) && !flag('force')) { skipped++; continue; }
      const s = SOUNDS[id];
      const body = { text: s.prompt, duration_seconds: s.seconds, prompt_influence: 0.4, loop: true, model_id: 'eleven_text_to_sound_v2' };
      try {
        const t0 = Date.now();
        let res;
        try {
          res = await api('/v1/sound-generation?output_format=mp3_44100_128', { method: 'POST', body: JSON.stringify(body) });
        } catch (e) {
          if (e.status !== 400 && e.status !== 422) throw e;
          // older accounts/models may not accept looping; try once without it
          const { loop, model_id, ...plain } = body;
          res = await api('/v1/sound-generation?output_format=mp3_44100_128', { method: 'POST', body: JSON.stringify(plain) });
        }
        writeFileSync(out, Buffer.from(await res.arrayBuffer()));
        console.log(`  sound ${id.padEnd(12)} ${s.seconds}s audio in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
        made++;
      } catch (e) {
        console.error(`  sound ${id} FAILED: ${e.message}`);
        failed++;
        if (e.status === 401 || e.status === 402) break;
      }
    }
  }

  const after = await usage();
  const n = writeManifest();
  console.log(`\nDone: ${made} generated, ${skipped} already existed, ${failed} failed. Manifest lists ${n} files.`);
  if (before && after) console.log(`Credits spent this run: ${after.used - before.used}. Remaining: ${after.limit - after.used}.`);
  if (failed) process.exit(1);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
