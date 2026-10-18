// Scene compiler: turns (room + visitor state) into a structured scene.
// Same room, different state => different voices, positions, lines and hidden sounds.
import { WORLD_VERSION, ROOMS, LINES, CHARACTERS } from './story.js';

export const voiceFile = (id) => `audio/voice/${id}.mp3`;
export const soundFile = (id) => `audio/sfx/${id}.mp3`;

const line = (id, pos) => ({ id, ...LINES[id], pos, file: voiceFile(id) });

export function prerequisites(roomId, state) {
  if (roomId >= 2 && !state.trustedCharacter) {
    return 'You haven’t been to the Clock Gallery yet. Elena and Tobias are waiting there.';
  }
  if (roomId >= 3 && !state.discoveredClue) {
    return 'You haven’t examined any evidence in the Workshop yet.';
  }
  return null;
}

export function compileScene(roomId, state) {
  const room = ROOMS[roomId];
  if (!room) return { error: 'Unknown room.' };
  const missing = prerequisites(roomId, state);
  if (missing) return { room, missing };

  const t = state.trustedCharacter;
  const c = state.discoveredClue;
  const sources = room.ambience.map((a) => ({ ...a, id: `${a.sound}@${a.pos}`, file: undefined }));
  let dialogue = [];
  let markers = [];
  let sceneKey;

  if (roomId === 1) {
    const P = room.positions;
    sceneKey = `${WORLD_VERSION}-room1`;
    dialogue = ['r1_01', 'r1_02', 'r1_03', 'r1_04', 'r1_05', 'r1_06'].map((id) => line(id, P[LINES[id].speaker]));
    // A hidden voice only heard near the guard post, looping with a gap.
    sources.push({ id: 'voice-guard', voice: 'r1_guard', pos: P.guard, radius: 1.4, gain: 0.8, gapSec: 7, kind: 'voice', caption: 'Sam’s night log on the radio: “' + LINES.r1_guard.text + '”', effect: 'radio' });
    markers = [{ who: 'curator', pos: P.curator }, { who: 'restorer', pos: P.restorer }, { who: 'guard', pos: P.guard }];
  }

  if (roomId === 2) {
    const other = t === 'curator' ? 'restorer' : 'curator';
    const P = { [t]: room.positions.trusted, [other]: room.positions.other };
    const ids = t === 'curator' ? ['r2_cur_1', 'r2_cur_2', 'r2_cur_3'] : ['r2_res_1', 'r2_res_2', 'r2_res_3'];
    sceneKey = `${WORLD_VERSION}-room2-${t}`;
    dialogue = ids.map((id) => line(id, P[LINES[id].speaker]));
    markers = [{ who: t, pos: P[t] }, { who: other, pos: P[other] }];
  }

  if (roomId === 3) {
    const P = room.positions;
    const prefix = { curator: { ledger: 'r3_cl', letter: 'r3_ct' }, restorer: { ledger: 'r3_rl', letter: 'r3_rt' } }[t][c];
    sceneKey = `${WORLD_VERSION}-room3-${t}-${c}`;
    dialogue = [1, 2, 3].map((n) => line(`${prefix}_${n}`, P[LINES[`${prefix}_${n}`].speaker]));
    // The echo corner replays the line from Room 1 that belongs to whoever you trusted.
    const echoId = t === 'curator' ? 'r1_05' : 'r1_06';
    sources.push({ id: 'voice-echo', voice: echoId, pos: room.echoCell, radius: 1.2, gain: 0.7, gapSec: 5, kind: 'voice', effect: 'echo', caption: `An echo of ${CHARACTERS[t].short} from the gallery: “${LINES[echoId].text}”` });
    markers = [{ who: 'curator', pos: P.curator }, { who: 'restorer', pos: P.restorer }];
  }

  return { room, sceneKey, bed: room.bed, sources, dialogue, markers };
}

export function explainEnding(state) {
  const t = CHARACTERS[state.trustedCharacter];
  const clue = state.discoveredClue === 'ledger' ? 'the maintenance ledger' : 'Tobias’s letter';
  const why = {
    'curator-ledger': 'Because you trusted Elena and found her signature, she confessed to ordering the removal herself.',
    'curator-letter': 'Because you trusted Elena but read Tobias’s letter, she explained the conservation motive behind it.',
    'restorer-ledger': 'Because you trusted Tobias and found the authorised order, he challenged why an honest act was hidden.',
    'restorer-letter': 'Because you trusted Tobias and read his letter, he admitted he was the one who took the Heart.',
  }[`${state.trustedCharacter}-${state.discoveredClue}`];
  return { headline: `You trusted ${t.short} and found ${clue}.`, why };
}
