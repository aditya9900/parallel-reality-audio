// The authored world for "The Missing Minute".
//
// Fixed truth (never changes between paths):
//   The Glass Heart escapement would crack in the gallery's humidity. Tobias (restorer)
//   wrote Elena (curator) a letter warning her. Elena signed a secret removal order.
//   At 3:14 a.m. Tobias removed the Heart (stopping the clock) and hid it in the archive's
//   climate case. They hid the removal from the board, because the opening's funding
//   depended on the Heart being on display.
//
// Each room is a grid. Every cell is a place in the room; what you hear there is the
// mix of the room bed, nearby ambience, nearby sound effects and nearby voices.

export const WORLD_VERSION = 'v1';

export const CHARACTERS = {
  curator: { name: 'Elena Vasquez', short: 'Elena', role: 'Curator', initial: 'E', voicePrefs: ['Alice', 'Charlotte', 'Matilda', 'Sarah', 'Laura'] },
  restorer: { name: 'Tobias Wren', short: 'Tobias', role: 'Restorer', initial: 'T', voicePrefs: ['George', 'Daniel', 'Brian', 'Callum', 'Will'] },
  guard: { name: 'Sam, night guard', short: 'Sam', role: 'Night guard', initial: 'S', voicePrefs: ['Bill', 'Roger', 'Chris', 'Eric', 'Charlie'] },
};

export const CLUES = {
  ledger: {
    label: 'Inspect the maintenance ledger',
    title: 'Maintenance ledger, Oct 16',
    body: 'Removal of Glass Heart escapement, AUTHORISED. Signed: E. Vasquez. Time: 03:14. Note in margin: "Not to be recorded in public log."',
  },
  letter: {
    label: 'Read the letter in the locked drawer',
    title: 'Unsent letter, in Tobias’s hand',
    body: 'Elena, the gallery humidity will crack the Heart within a week. I know the board wants it on display. If you won’t move it, I will. Please don’t make me do this alone. T.',
  },
};

// Every spoken line. The generator renders each one to public/audio/voice/<id>.mp3.
export const LINES = {
  // Room 1: the argument
  r1_01: { speaker: 'curator', text: 'It stopped at three fourteen. Thirteen hours before opening, the Hollow Clock simply stopped. And the Glass Heart is gone from inside it.' },
  r1_02: { speaker: 'restorer', text: 'It didn’t simply stop, Elena. Someone opened the case. The seal was cut cleanly. That takes a key, and a steady hand.' },
  r1_03: { speaker: 'curator', text: 'You have the key, Tobias. And we both know whose hands are steadiest in this building.' },
  r1_04: { speaker: 'restorer', text: 'And you sign every work order. Ask yourself why last night’s public log is blank.' },
  r1_05: { speaker: 'curator', text: 'Don’t listen to him. He’s been obsessed with that heart since the day it arrived.' },
  r1_06: { speaker: 'restorer', text: 'Obsessed with keeping it intact. Believe whoever you like. But decide soon.' },
  r1_guard: { speaker: 'guard', text: 'Night log, gallery two. Three fourteen. Clock’s gone quiet. Both of them still in the building. Didn’t see who left last.' },

  // Room 2: reaction to whom you trusted
  r2_cur_1: { speaker: 'curator', text: 'Thank you. Most people side with him. He has a gentle voice. Look around his workshop. He keeps everything: ledgers, letters, every screw he’s ever turned.' },
  r2_cur_2: { speaker: 'restorer', text: 'Go on, then. Read my ledger. You’ll find her signature in it.' },
  r2_cur_3: { speaker: 'curator', text: 'Pick one. The ledger on his desk, or the letter he keeps locked in that drawer.' },
  r2_res_1: { speaker: 'restorer', text: 'You believed me. Good. Then you should know I’m not innocent either. Only honest. Everything you need is in this room.' },
  r2_res_2: { speaker: 'curator', text: 'He’ll show you whatever flatters him. Ask him about the letter in the drawer.' },
  r2_res_3: { speaker: 'restorer', text: 'The ledger on the desk records every job. The letter in the drawer is the one I never wanted read. Your choice.' },

  // Room 2: the clue, read aloud when examined
  clue_ledger: { speaker: 'restorer', text: 'October sixteenth. Removal of the Glass Heart escapement, authorised. Signed, E. Vasquez. Three fourteen a.m. Not to be recorded in the public log.' },
  clue_letter: { speaker: 'restorer', text: 'Elena. The gallery humidity will crack the Heart within a week. I know the board wants it on display. If you won’t move it, I will. Please don’t make me do this alone.' },

  // Room 3: four finales, each calls back BOTH choices
  r3_cl_1: { speaker: 'curator', text: 'You trusted me, and you found the ledger. So you’ve seen my signature. Yes. I ordered the Heart removed at three fourteen.' },
  r3_cl_2: { speaker: 'restorer', text: 'She signed it. I carried it down here. And we both lied to the board.' },
  r3_cl_3: { speaker: 'curator', text: 'You trusted me first, so I’ll trust you with the rest. Listen. You can hear it. Still ticking.' },

  r3_ct_1: { speaker: 'curator', text: 'You trusted me, but you read his letter. Then you know why. The gallery air would have cracked it within a week.' },
  r3_ct_2: { speaker: 'restorer', text: 'She didn’t sign that order for the board. She signed it to save the thing.' },
  r3_ct_3: { speaker: 'curator', text: 'Conservation over spectacle. That’s the job, even when nobody thanks you. Listen. Still ticking.' },

  r3_rl_1: { speaker: 'restorer', text: 'You trusted me, and you found her signature in my ledger. So ask the real question. If the removal was authorised, why hide it?' },
  r3_rl_2: { speaker: 'curator', text: 'Because the board would have cancelled the opening. Because the funding is the Heart.' },
  r3_rl_3: { speaker: 'restorer', text: 'An honest act, done in secret. That’s what stopped the clock. Listen. It’s safe. Still ticking.' },

  r3_rt_1: { speaker: 'restorer', text: 'You trusted me, and you read my letter. Then you know it was me. I took the Heart at three fourteen, before the damp could break it.' },
  r3_rt_2: { speaker: 'curator', text: 'And I let him. I signed the order the night he begged me.' },
  r3_rt_3: { speaker: 'restorer', text: 'I’m not a thief. I’m the reason it still exists. Listen. Still ticking.' },
};

// Every non-voice sound. The generator renders each to public/audio/sfx/<id>.mp3 with
// ElevenLabs Sound Effects. `fallback` is a procedural stand-in used until that file exists.
export const SOUNDS = {
  r1_bed: { prompt: 'Large empty museum gallery at night, quiet room tone, distant air handling, soft reverb', seconds: 15, fallback: { type: 'noise', freq: 220, q: 0.5 } },
  r1_clocks: { prompt: 'A wall of many antique clocks ticking slightly out of sync, close up, dry', seconds: 10, fallback: { type: 'tick', rate: 2.7, freq: 2400 } },
  r1_rain: { prompt: 'Gentle steady rain falling on a glass skylight overhead, interior perspective', seconds: 12, fallback: { type: 'noise', freq: 3000, q: 0.7 } },
  r1_pendulum: { prompt: 'Faint eerie metallic creak of a large stopped clock pendulum settling, sparse', seconds: 8, fallback: { type: 'hum', freq: 82 } },
  r1_static: { prompt: 'Quiet walkie-talkie static crackle, intermittent, security radio on a desk', seconds: 8, fallback: { type: 'noise', freq: 1500, q: 4 } },

  r2_bed: { prompt: 'Small cluttered workshop room tone, old radiator ticking, faint lamp buzz', seconds: 15, fallback: { type: 'noise', freq: 400, q: 0.6 } },
  r2_gears: { prompt: 'Small clockwork gears being turned by hand on a wooden workbench, tiny tools clinking', seconds: 10, fallback: { type: 'tick', rate: 6, freq: 3600 } },
  r2_drip: { prompt: 'Slow water drips falling into a metal sink, small room', seconds: 8, fallback: { type: 'tick', rate: 0.9, freq: 900 } },
  r2_radio: { prompt: 'Old valve radio playing faint muffled 1940s swing music, heard from across a room', seconds: 12, fallback: { type: 'hum', freq: 196 } },
  r2_paper: { prompt: 'Paper pages gently rustling, close, quiet', seconds: 6, fallback: { type: 'noise', freq: 5000, q: 2 } },

  r3_bed: { prompt: 'Underground archive room tone, deep steady climate control hum', seconds: 15, fallback: { type: 'hum', freq: 55 } },
  r3_heart: { prompt: 'A single tiny delicate clock escapement ticking softly with a glassy resonance', seconds: 8, fallback: { type: 'tick', rate: 4, freq: 5200 } },
  r3_vent: { prompt: 'Air vent hissing steadily, close', seconds: 10, fallback: { type: 'noise', freq: 2000, q: 0.4 } },
  r3_stacks: { prompt: 'Rolling metal archive shelving creaking slowly in the distance', seconds: 10, fallback: { type: 'hum', freq: 110 } },
};

// pos is [col, row] on the room grid (fractions allowed). radius is in cells.
export const ROOMS = {
  1: {
    id: 1,
    name: 'The Clock Gallery',
    instruction: 'Walk the gallery. Elena and Tobias stand on opposite sides. Play the scene, then decide whom to trust.',
    cols: 4,
    rows: 4,
    start: [1, 3],
    cells: [
      ['Under the skylight (west)', 'Under the skylight', 'Under the skylight (east)', 'Wall of clocks'],
      ['Display cases', 'The Hollow Clock', 'Beside the clock case', 'Wall of clocks (low)'],
      ['Elena’s side', 'Gallery centre', 'Gallery centre (east)', 'Tobias’s side'],
      ['Guard post', 'Visitor bench', 'Gift-shop doorway', 'Fire exit'],
    ],
    bed: { sound: 'r1_bed', gain: 0.25, caption: 'Night-time gallery hush' },
    ambience: [
      { sound: 'r1_clocks', pos: [3, 0.5], radius: 2.6, gain: 0.7, kind: 'ambience', caption: 'Dozens of clocks ticking out of sync' },
      { sound: 'r1_rain', pos: [1, 0], radius: 2.4, gain: 0.6, kind: 'ambience', caption: 'Rain on the skylight' },
      { sound: 'r1_pendulum', pos: [1, 1], radius: 1.6, gain: 0.6, kind: 'sfx', caption: 'The stopped pendulum creaks' },
      { sound: 'r1_static', pos: [0, 3], radius: 1.5, gain: 0.45, kind: 'sfx', caption: 'Radio static at the guard post' },
    ],
    positions: { curator: [0, 2], restorer: [3, 2], guard: [0, 3] },
  },
  2: {
    id: 2,
    name: 'The Workshop',
    instruction: 'Listen for the paper rustling: the evidence is hidden in two corners. Stand on one and examine it. You only get one.',
    cols: 4,
    rows: 4,
    start: [1, 3],
    cells: [
      ['Sink', 'Shelf of spare parts', 'Window', 'Old radio'],
      ['Tobias’s desk', 'Workbench', 'Workbench lamp', 'Coat rack'],
      ['Tool wall', 'Stool', 'Parts drawers', 'Locked drawer'],
      ['Doorway', 'Floorboards', 'Floorboards (east)', 'Back door'],
    ],
    bed: { sound: 'r2_bed', gain: 0.25, caption: 'Radiator and lamp buzz' },
    ambience: [
      { sound: 'r2_gears', pos: [1.5, 1], radius: 1.8, gain: 0.55, kind: 'sfx', caption: 'Clockwork gears on the bench' },
      { sound: 'r2_drip', pos: [0, 0], radius: 1.6, gain: 0.6, kind: 'sfx', caption: 'A tap dripping into the sink' },
      { sound: 'r2_radio', pos: [3, 0], radius: 2.2, gain: 0.5, kind: 'ambience', caption: 'Swing music on an old radio' },
      { sound: 'r2_paper', pos: [0, 1], radius: 1.3, gain: 0.7, kind: 'sfx', caption: 'Pages rustling: the ledger' },
      { sound: 'r2_paper', pos: [3, 2], radius: 1.3, gain: 0.7, kind: 'sfx', caption: 'Pages rustling: a letter' },
    ],
    // Whoever you trusted meets you at the bench; the other lurks in the doorway.
    positions: { trusted: [1.5, 1], other: [0, 3] },
    clueCells: { ledger: [0, 1], letter: [3, 2] },
  },
  3: {
    id: 3,
    name: 'The Archive',
    instruction: 'Find the climate case. Somewhere down here, something is still ticking.',
    cols: 4,
    rows: 4,
    start: [0, 3],
    cells: [
      ['Rolling stacks', 'Map drawers', 'Card catalogue', 'Records boxes'],
      ['Aisle', 'Reading table', 'Climate case', 'Beside the case'],
      ['Aisle (south)', 'Archive centre', 'In front of the case', 'Dark corner'],
      ['Stairwell', 'Return desk', 'Vent grille', 'Air vent'],
    ],
    bed: { sound: 'r3_bed', gain: 0.3, caption: 'Deep climate-control hum' },
    ambience: [
      { sound: 'r3_heart', pos: [2, 1], radius: 2.0, gain: 0.8, kind: 'sfx', caption: 'Something tiny, ticking behind glass' },
      { sound: 'r3_vent', pos: [3, 3], radius: 1.8, gain: 0.5, kind: 'ambience', caption: 'The air vent hissing' },
      { sound: 'r3_stacks', pos: [0, 0], radius: 2.0, gain: 0.5, kind: 'ambience', caption: 'Shelving creaking in the dark' },
    ],
    positions: { curator: [1, 1], restorer: [3, 1] },
    echoCell: [3, 2],
  },
};
