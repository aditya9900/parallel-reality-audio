# Parallel Reality Audio: The Missing Minute

A mobile web demo. Each of the three rooms (Clock Gallery, Workshop, Archive) is a 4×4 grid.
Every cell is a different spot in the room, and what you hear there is a spatial mix of:

- **background**: a room tone that plays everywhere in the room
- **ambience**: positioned loops (rain on the skylight, a wall of clocks, a radio)
- **sound effects**: positioned details (a dripping tap, rustling paper that marks where the evidence is, the ticking Glass Heart)
- **voices**: characters stand on specific cells, so their lines get louder, clearer and pan toward them as you walk closer. There are also hidden voices (the guard's radio log, the "echo corner" in the Archive)

Your choices (whom you trust in Room 1, which clue you find in Room 2) change which voices,
lines and hidden sounds each room compiles. That gives four different finales.

## Run it

```bash
npm install
npm run dev
```

Open the URL it prints. On your phone, use the "Network" URL while on the same wifi.

Before any audio is generated, the app uses procedural placeholder sounds and plays the dialogue as silent, timed text. The full flow still works.

## Generate the real audio (ElevenLabs)

1. `cp .env.example .env` and paste your key into `ELEVENLABS_API_KEY`.
2. `npm run voices` lists the premade (free-plan) voices and shows which ones would be cast.
3. `npm run estimate` shows how much would be generated (about 2,750 characters of speech plus 14 sound loops).
4. `npm run generate` generates everything that's missing. It prints your credit balance before and after.

Re-run a single clip with `npm run generate -- --only=r3_rt --force`.
Choose voices with `VOICE_CURATOR=...` etc. in `.env`.

The key is only used by the script on your machine. It never goes into the website.

## Files

- `src/story.js`: the whole authored world (lines, sounds, grids, positions). Edit this to change the experience.
- `src/compiler.js`: room + your choices → scene (dialogue, positions, hidden voices)
- `src/audio.js`: Web Audio spatial engine (distance falloff, stereo pan, low-pass, crossfade)
- `src/main.js`: UI and flow
- `scripts/generate.mjs`: ElevenLabs generator

## Links

No QR codes needed: rooms link to each other. Each room also has its own URL: `https://<your-site>/#/room/1`, `/#/room/2` and `/#/room/3`.
Add `?presenter` before the `#` to get presenter shortcuts that jump to any of the four endings.

## Deploy

`npm run build`, then drag the `dist` folder onto https://app.netlify.com/drop. Re-run both after any change.
