import './style.css';
import { ROOMS, CHARACTERS, CLUES, SOUNDS } from './story.js';
import { compileScene, explainEnding, soundFile, voiceFile } from './compiler.js';
import { SpatialEngine, attenuation } from './audio.js';
import * as S from './state.js';

const app = document.getElementById('app');
const engine = new SpatialEngine();
const presenter = new URLSearchParams(location.search).has('presenter');

let state = S.load();
let textOnly = false; // visitor chose to continue without sound
let view = null; // current room view context
let playToken = 0;

engine.ambienceOn = state.ambienceOn;

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const roomFromHash = () => {
  const m = location.hash.match(/room\/(\d)/);
  return m ? Number(m[1]) : location.hash.includes('end') ? 'end' : null;
};

function header(sub) {
  return `<header class="top"><a href="#/" class="brand">The Missing Minute</a><span class="sub">${sub || 'A fictional interactive audio exhibit'}</span></header>`;
}

// ---------- Home ----------
function renderHome() {
  view = null;
  engine.setRoom({ sources: [] }, [0, 0]);
  const started = state.completed.length > 0;
  const next = !state.trustedCharacter ? 1 : !state.discoveredClue ? 2 : 3;
  app.innerHTML = `
    ${header()}
    <main class="home">
      <p class="eyebrow">Parallel Reality Audio</p>
      <h1>Same place.<br/>Different story.</h1>
      <p class="lede">A clock stopped at 3:14 and its Glass Heart vanished. Each room is a map: walk around it and every spot sounds different. Voices, ambience and sounds move as you move.</p>
      <p class="lede">What you choose and discover changes what you hear next. About three minutes. Headphones are best. Every word is also on screen.</p>
      <div class="stack">
        <button class="primary big" data-act="start">${started ? `Continue with sound (Room ${next})` : 'Start listening'}</button>
        <button class="ghost" data-act="text">Continue without sound</button>
        ${started ? '<button class="ghost danger" data-act="reset">Restart from the beginning</button>' : ''}
      </div>
      <p class="fine">Fictional museum, fictional people. Voices and sounds generated with ElevenLabs.</p>
    </main>`;
  app.querySelector('[data-act=start]').onclick = async () => {
    textOnly = false;
    await engine.unlock();
    location.hash = `#/room/${next}`;
  };
  app.querySelector('[data-act=text]').onclick = () => {
    textOnly = true;
    location.hash = `#/room/${next}`;
  };
  const r = app.querySelector('[data-act=reset]');
  if (r) r.onclick = () => { state = S.reset(); renderHome(); };
}

// ---------- Room ----------
function renderRoom(roomId) {
  const scene = compileScene(roomId, state);
  const room = scene.room;
  playToken++;

  if (scene.missing) {
    engine.setRoom({ sources: [] }, [0, 0]);
    const back = !state.trustedCharacter ? 1 : 2;
    app.innerHTML = `${header(`Room ${roomId} of 3`)}
      <main class="room"><h2>${esc(room.name)}</h2>
      <div class="notice"><p>${esc(scene.missing)}</p>
      <a class="primary big" href="#/room/${back}">Go to ${esc(ROOMS[back].name)}</a></div>
      ${navBar(roomId)}</main>`;
    bindNav();
    return;
  }

  const pos = state.pos[roomId] || room.start;
  view = { roomId, scene, pos, line: -1, playing: false, paused: false };

  app.innerHTML = `
    ${header(`Room ${roomId} of 3`)}
    <main class="room">
      <div class="room-head">
        <h2>${esc(room.name)}</h2>
        <p class="instruction">${esc(room.instruction)}</p>
      </div>
      <div class="layout">
        <section class="map-col">
          <div class="grid" role="grid" aria-label="Room map. Use arrow keys to move." style="--cols:${room.cols}"></div>
          <div class="listen" aria-live="polite"></div>
        </section>
        <section class="side-col">
          <div class="player">
            <div class="controls">
              <button class="primary" data-act="play">▶ Play scene</button>
              <button class="ghost" data-act="pause" disabled>Pause</button>
              <button class="ghost" data-act="replay">Replay</button>
            </div>
            <p class="status"></p>
          </div>
          <ol class="transcript"></ol>
          <div class="choices"></div>
        </section>
      </div>
      ${navBar(roomId)}
      ${presenter ? presenterPanel() : ''}
    </main>
    ${!engine.unlocked && !textOnly ? soundGate() : ''}`;

  renderGrid();
  renderHere();
  renderTranscript();
  renderChoices();
  renderStatus();
  bindRoom();
  bindNav();
  if (engine.unlocked) engine.setRoom(scene, pos);
}

function soundGate() {
  return `<div class="gate" role="dialog" aria-label="Enable sound">
    <div class="gate-card"><p>Tap to enter the room with sound.</p>
    <button class="primary big" data-act="gate-sound">Enter with sound</button>
    <button class="ghost" data-act="gate-text">Continue without sound</button></div></div>`;
}

function iconFor(src) {
  return src.kind === 'voice' ? '\u{1F5E3}' : src.kind === 'ambience' ? '≈' : '✦';
}

function renderGrid() {
  const { scene, pos, roomId } = view;
  const room = scene.room;
  const grid = app.querySelector('.grid');
  const positioned = scene.sources.filter((s) => s.pos);
  let html = '';
  for (let r = 0; r < room.rows; r++) {
    for (let c = 0; c < room.cols; c++) {
      const here = pos[0] === c && pos[1] === r;
      // loudness of the whole mix at this cell -> warm tint
      const heat = Math.min(1, positioned.reduce((sum, s) => sum + attenuation(s, [c, r]) * (s.gain ?? 1), 0) / 1.2);
      const icons = positioned.filter((s) => Math.round(s.pos[0]) === c && Math.round(s.pos[1]) === r).map(iconFor);
      const people = scene.markers.filter((m) => Math.round(m.pos[0]) === c && Math.round(m.pos[1]) === r);
      const clue = roomId === 2 && Object.entries(room.clueCells).find(([, p]) => p[0] === c && p[1] === r);
      html += `<button role="gridcell" class="cell${here ? ' here' : ''}${clue ? ' clue' : ''}" data-c="${c}" data-r="${r}"
        style="--h:${heat.toFixed(2)}" aria-label="${esc(room.cells[r][c])}${here ? ', you are here' : ''}" ${here ? 'aria-current="location"' : ''}>
        <span class="cell-label">${esc(room.cells[r][c])}</span>
        <span class="cell-icons">${[...new Set(icons)].join(' ')}</span>
        ${people.map((m) => `<span class="person ${m.who}" title="${esc(CHARACTERS[m.who].name)}">${CHARACTERS[m.who].initial}</span>`).join('')}
        ${clue && state.discoveredClue === clue[0] ? '<span class="found">✓</span>' : ''}
        ${here ? '<span class="you" aria-hidden="true"></span>' : ''}
      </button>`;
    }
  }
  grid.innerHTML = html;
}

// "What you hear here": the same mix the engine plays, written out, so no clue needs hearing.
function renderHere() {
  const { scene, pos } = view;
  const room = scene.room;
  const items = [];
  if (view.line >= 0 && scene.dialogue[view.line]) {
    const l = scene.dialogue[view.line];
    const a = attenuation({ pos: l.pos, radius: 4.5, minGain: 0.18 }, pos);
    items.push({ a: Math.max(a, 0.99), text: `${CHARACTERS[l.speaker].short} is speaking ${a > 0.7 ? 'right beside you' : a > 0.35 ? 'nearby' : 'from across the room'}` });
  }
  scene.sources.forEach((s) => {
    const a = attenuation(s, pos) * (s.gain ?? 1);
    if (a > 0.04) items.push({ a, text: s.caption });
  });
  items.push({ a: scene.bed.gain, text: scene.bed.caption });
  items.sort((x, y) => y.a - x.a);
  app.querySelector(".listen").innerHTML = `
    <p class="here-title">You are at: <strong>${esc(room.cells[pos[1]][pos[0]])}</strong></p>
    <ul class="hear">${items.map((i) => `<li><span class="bar" style="--w:${Math.round(Math.min(1, i.a) * 100)}%"></span>${esc(i.text)}</li>`).join('')}</ul>`;
}

function renderTranscript() {
  const { scene } = view;
  app.querySelector('.transcript').innerHTML = scene.dialogue.map((l, i) => `
    <li class="${i === view.line ? 'active' : ''}"><span class="who ${l.speaker}">${esc(CHARACTERS[l.speaker].short)}</span> ${esc(l.text)}</li>`).join('');
}

function renderStatus() {
  const { scene } = view;
  const haveAudio = scene.dialogue.every((l) => engine.hasFile(l.file));
  const mode = textOnly || !engine.ctx
    ? 'Text only'
    : !engine.unlocked
      ? 'Sound paused by the browser. Tap Play to resume'
      : haveAudio ? 'Saved audio' : 'Placeholder sounds (voices not generated yet, so the text plays silently)';
  app.querySelector('.status').textContent = `${mode} · scene ${scene.sceneKey}`;
  app.querySelector('[data-act=play]').textContent = view.playing && !view.paused ? '▶ Playing…' : view.paused ? '▶ Resume' : '▶ Play scene';
  app.querySelector('[data-act=pause]').disabled = !view.playing || view.paused;
}

function renderChoices() {
  const { roomId, scene } = view;
  const box = app.querySelector('.choices');
  if (roomId === 1) {
    if (state.trustedCharacter) {
      box.innerHTML = `<p class="chosen">You chose to trust <strong>${esc(CHARACTERS[state.trustedCharacter].name)}</strong>.</p>
        <a class="primary big" href="#/room/2">Next: The Workshop →</a>
        <p class="fine">Changed your mind? Restart from the beginning (bottom of the page).</p>`;
    } else {
      box.innerHTML = `<p class="ask">Whom do you trust?</p>
        <button class="choice" data-trust="curator">Trust Elena, the curator</button>
        <button class="choice" data-trust="restorer">Trust Tobias, the restorer</button>`;
    }
  }
  if (roomId === 2) {
    const room = scene.room;
    if (state.discoveredClue) {
      const c = CLUES[state.discoveredClue];
      box.innerHTML = `<div class="evidence"><p class="ev-title">${esc(c.title)}</p><p>${esc(c.body)}</p></div>
        <a class="primary big" href="#/room/3">Next: The Archive →</a>`;
    } else {
      box.innerHTML = `<p class="ask">Examine one piece of evidence</p>` + Object.entries(CLUES).map(([k, c]) => {
        const at = room.clueCells[k];
        const standing = view.pos[0] === at[0] && view.pos[1] === at[1];
        return `<button class="choice${standing ? ' near' : ''}" data-clue="${k}">${esc(c.label)}<small>${standing ? 'You’re standing right by it' : `at ${esc(room.cells[at[1]][at[0]])}`}</small></button>`;
      }).join('');
    }
  }
  if (roomId === 3) {
    if (state.completed.includes(3)) {
      const e = explainEnding(state);
      box.innerHTML = `<div class="reveal"><p class="ev-title">What happened</p><p class="headline">${esc(e.headline)}</p><p>${esc(e.why)}</p>
        <p class="fine">The truth never changed. What you heard did. Someone who chose differently heard a different confession in this same room.</p></div>
        <button class="primary big" data-act="again">Try another path</button>`;
    } else {
      box.innerHTML = `<button class="ghost" data-act="finish">I’ve read it. Show what happened.</button>`;
    }
  }
}

function presenterPanel() {
  const combos = [['curator', 'ledger'], ['curator', 'letter'], ['restorer', 'ledger'], ['restorer', 'letter']];
  return `<aside class="presenter"><p><strong>Presenter</strong> trust=${state.trustedCharacter} clue=${state.discoveredClue} done=[${state.completed}] session=${state.sessionId}</p>
    ${combos.map(([t, c]) => `<button class="ghost small" data-combo="${t},${c}">Jump: ${t} + ${c}</button>`).join('')}</aside>`;
}

function navBar(roomId) {
  return `<nav class="roomnav" aria-label="Rooms">
    ${[1, 2, 3].map((n) => `<a href="#/room/${n}" class="${n === roomId ? 'on' : ''}">${n}. ${esc(ROOMS[n].name.replace('The ', ''))}</a>`).join('')}
    <span class="spacer"></span>
    <label class="toggle"><input type="checkbox" data-act="amb" ${state.ambienceOn ? 'checked' : ''}/> Ambience</label>
    <button class="ghost small danger" data-act="restart">Restart</button>
  </nav>`;
}

function bindNav() {
  const amb = app.querySelector('[data-act=amb]');
  if (amb) amb.onchange = () => { state = S.setAmbience(state, amb.checked); engine.setAmbience(amb.checked); };
  const rs = app.querySelector('[data-act=restart]');
  if (rs) rs.onclick = () => {
    if (!confirm('Restart and clear your choices?')) return;
    state = S.reset();
    location.hash = '#/room/1';
    if (roomFromHash() === 1) route();
  };
}

function moveTo(c, r) {
  const room = view.scene.room;
  c = Math.max(0, Math.min(room.cols - 1, c));
  r = Math.max(0, Math.min(room.rows - 1, r));
  view.pos = [c, r];
  state = S.setPos(state, view.roomId, view.pos);
  engine.moveTo(view.pos);
  renderGrid();
  renderHere();
  if (view.roomId === 2 && !state.discoveredClue) renderChoices(), bindChoices();
  app.querySelector(`.cell[data-c="${c}"][data-r="${r}"]`)?.focus();
}

async function playScene(fromStart) {
  if (view.paused && !fromStart) {
    view.paused = false;
    await engine.unlock();
    renderStatus();
    return;
  }
  if (!textOnly && !engine.unlocked) {
    await engine.unlock();
    await engine.setRoom(view.scene, view.pos);
  }
  if (engine.ctx?.state === 'suspended') await engine.ctx.resume();
  const token = ++playToken;
  engine.stopDialogue();
  view.playing = true;
  view.paused = false;
  const lines = view.scene.dialogue;
  for (let i = 0; i < lines.length; i++) {
    if (token !== playToken) return;
    view.line = i;
    renderTranscript();
    renderHere();
    renderStatus();
    if (textOnly || !engine.ctx) {
      await new Promise((r) => setTimeout(r, Math.max(1800, lines[i].text.length * 60)));
    } else {
      const h = engine.playLine(lines[i]);
      view.stopLine = h.stop;
      await h.done;
    }
  }
  if (token !== playToken) return;
  view.playing = false;
  view.line = -1;
  renderTranscript();
  renderHere();
  renderStatus();
  if (view.roomId === 3 && !state.completed.includes(3)) {
    state = S.completeRoom3(state);
    renderChoices();
    bindChoices();
  }
}

function bindChoices() {
  app.querySelectorAll('[data-trust]').forEach((b) => (b.onclick = () => {
    state = S.chooseTrust(state, b.dataset.trust);
    renderChoices();
    bindChoices();
  }));
  app.querySelectorAll('[data-clue]').forEach((b) => (b.onclick = async () => {
    const k = b.dataset.clue;
    const at = view.scene.room.clueCells[k];
    moveTo(at[0], at[1]);
    state = S.chooseClue(state, k);
    renderGrid();
    renderChoices();
    bindChoices();
    // read the clue aloud from where it lies
    if (!textOnly && engine.unlocked) {
      playToken++;
      engine.stopDialogue();
      engine.playLine({ id: `clue_${k}`, file: voiceFile(`clue_${k}`), text: CLUES[k].body, pos: at });
    }
  }));
  const fin = app.querySelector('[data-act=finish]');
  if (fin) fin.onclick = () => { state = S.completeRoom3(state); renderChoices(); bindChoices(); };
  const again = app.querySelector('[data-act=again]');
  if (again) again.onclick = () => { state = S.reset(); location.hash = '#/room/1'; };
}

function bindRoom() {
  app.querySelector('.grid').onclick = (e) => {
    const cell = e.target.closest('.cell');
    if (cell) moveTo(Number(cell.dataset.c), Number(cell.dataset.r));
  };
  app.querySelector('[data-act=play]').onclick = () => playScene(false);
  app.querySelector('[data-act=replay]').onclick = () => playScene(true);
  app.querySelector('[data-act=pause]').onclick = async () => {
    view.paused = true;
    await engine.pause();
    renderStatus();
  };
  const gs = app.querySelector('[data-act=gate-sound]');
  if (gs) gs.onclick = async () => {
    await engine.unlock();
    app.querySelector('.gate').remove();
    await engine.setRoom(view.scene, view.pos);
    renderStatus();
  };
  const gt = app.querySelector('[data-act=gate-text]');
  if (gt) gt.onclick = () => { textOnly = true; app.querySelector('.gate').remove(); renderStatus(); };
  app.querySelectorAll('[data-combo]').forEach((b) => (b.onclick = () => {
    const [t, c] = b.dataset.combo.split(',');
    state = S.reset();
    state = S.chooseTrust(state, t);
    state = S.chooseClue(state, c);
    location.hash = '#/room/3';
    route();
  }));
  bindChoices();
}

document.addEventListener('keydown', (e) => {
  if (!view || e.target.matches('input, textarea')) return;
  const d = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[e.key];
  if (!d) return;
  e.preventDefault();
  moveTo(view.pos[0] + d[0], view.pos[1] + d[1]);
});

function route() {
  const r = roomFromHash();
  if (r && ROOMS[r]) renderRoom(r);
  else renderHome();
  window.scrollTo(0, 0);
}

// Browsers suspend audio in background tabs / locked screens; pick back up on return.
engine.onstate = () => view && renderStatus();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && engine.ctx && !textOnly && !view?.paused) engine.ctx.resume().catch(() => {});
});

window.addEventListener('hashchange', route);
engine.init().then(route);

// exposed for debugging in the console
window.__pra = { engine, get state() { return state; }, SOUNDS, soundFile };
