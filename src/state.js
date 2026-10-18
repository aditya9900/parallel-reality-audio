// Visitor state, kept only on this device (localStorage). No accounts, no server.
import { WORLD_VERSION } from './story.js';

const KEY = `pra.${WORLD_VERSION}.state`;

function fresh() {
  return {
    version: WORLD_VERSION,
    sessionId: Math.random().toString(36).slice(2, 10),
    trustedCharacter: null, // 'curator' | 'restorer'
    discoveredClue: null, // 'ledger' | 'letter'
    completed: [],
    pos: {},
    ambienceOn: true,
  };
}

let memory = null; // used when storage is blocked (private mode etc.)

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s && s.version === WORLD_VERSION) return { ...fresh(), ...s };
    }
  } catch {}
  return memory ? { ...memory } : fresh();
}

export function save(state) {
  memory = { ...state };
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {}
}

export function reset() {
  const s = fresh();
  save(s);
  return s;
}

// Each choice can only be made once per run; repeat scans/taps never re-apply it.
export function chooseTrust(state, who) {
  if (state.trustedCharacter) return state;
  const s = { ...state, trustedCharacter: who, completed: [...new Set([...state.completed, 1])] };
  save(s);
  return s;
}

export function chooseClue(state, clue) {
  if (state.discoveredClue || !state.trustedCharacter) return state;
  const s = { ...state, discoveredClue: clue, completed: [...new Set([...state.completed, 2])] };
  save(s);
  return s;
}

export function completeRoom3(state) {
  const s = { ...state, completed: [...new Set([...state.completed, 3])] };
  save(s);
  return s;
}

export function setPos(state, roomId, pos) {
  const s = { ...state, pos: { ...state.pos, [roomId]: pos } };
  save(s);
  return s;
}

export function setAmbience(state, on) {
  const s = { ...state, ambienceOn: on };
  save(s);
  return s;
}
