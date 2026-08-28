# PETZ-9000

A 3D virtual pet in a plastic shell. Single page, no backend, saves to
`localStorage`. Built with [ogl](https://github.com/oframe/ogl), TypeScript and
Vite; every asset — geometry, textures, font, sound — is generated in code, so
there is nothing to load.

```bash
npm install
npm run dev
```

`npm run build` typechecks and emits a static `dist/` you can host anywhere.

## Playing it

Three rubber buttons, and nothing else. They are labelled A, B and C — moulded
into the shell beneath each one, so the on-screen hints mean something whether
you are tapping or typing:

| Button | Keyboard | Does |
| --- | --- | --- |
| A | `A`, `←` | Previous icon / menu item |
| B | `B`, `Enter`, `Space` | Select, confirm, act |
| C | `C`, `→`, `Esc` | Next icon / back |

Six icons ring the screen: feed, play, clean, medicine, light (sleep) and
status. An icon blinks red when the matching stat is critical.

**Hold C** — press and hold the third button, or the C key — to back out of the
feed menu, the game menu, or a game in progress:
every button is spoken for during a minigame, so leaving is a held press rather
than a spare button. A progress bar fills while you hold, and the prompt is
advertised for the first few seconds of a game. Abandoning a game before any
round has been decided costs nothing; quitting after that counts as a loss, so a
game can't be dropped mid-way to protect a win rate.

Drag anywhere off the buttons to turn the device over in your hands; it carries
a little momentum and the pitch is clamped so it never ends up unusable.
Double-click, or the RECENTRE control that appears once you have turned it,
puts it back. Turning the shell rather than moving the camera is deliberate —
the lights are fixed in view space, so the highlight travels across the plastic
as it turns, and the mouldings catch it at a raking angle.

## How it works

### Time

Stats decay against wall-clock time, so the pet keeps living while the tab is
closed. On load, `reconcile()` replays the gap in five-minute chunks rather than
applying one big delta, so a long absence follows the same curves a live session
would. The pet cannot die — health bottoms out at `HEALTH_FLOOR` and it just
gets sick, sad, and stops thriving until you put it right.

### Branching

Every form is a node in a graph with weighted branch rules. When a stage's
duration elapses, each candidate branch scores itself against four normalised
measures of how the pet was raised, and the highest score wins:

- **care** — time spent with a stat bottomed out, plus a penalty per illness
- **diet** — the ratio of sweet / protein / veg / junk meals eaten
- **play** — minigame win rate weighted by how often you actually played
- **sleep** — whether bedtimes landed in the pet's night window

Egg → Blobbit → one of three children → one of six adults. Eleven forms, and two
playthroughs genuinely diverge.

### Rendering

The pet lives in a 192×160 render target — a real low-resolution framebuffer,
not a filter. That buffer goes through a threshold-and-blur bloom chain, then
gets sampled by the shell's screen shader, which applies barrel distortion,
scanlines, an aperture grille, chromatic fringing, ordered dithering and a glass
glare. Everything you see on the screen is genuinely 192 pixels wide.

The shell and buttons are superellipsoids from the same generator at different
exponents. The brand and speaker grille on the front are a height map generated
in code (`render/decal.ts`, reusing the same pixel font) that the plastic shader
reads as a bump map — real mouldings that catch the key light, not a painted-on
texture. The shell's front is flattened into a true plateau — the face varies
by 0.0016 across the whole screen — so the glass sits directly on the plastic
with no bezel to hide a gap. The lit area is masked to a superellipse and its
corners are discarded rather than painted black, so the picture simply ends on a
moulded curve where it meets the shell. The HUD lays itself out against that
same curve (`Hud.safeHalfWidth`) so nothing is ever clipped by it. The pet's
alpha channel doubles as a bloom mask, so emissive voxels glow even when they
are not the brightest thing in frame.

## Authoring content

**A new pet form.** Add a `VoxelModel` to `src/data/models.ts`: a stack of ASCII
layers, bottom first, where the last row of each layer is the pet's face and `.`
is air. Mark characters as `emissive` to make them bloom. Register it in
`src/data/species.ts` with branch rules scoring against `Metrics`. The mesh
builder culls interior faces and bakes corner ambient occlusion, which is what
makes the cubes read at this resolution.

**A new food.** Add it to `src/data/foods.ts` with a `DietAxis` and stat deltas.
Anything with an axis shows up on the feed menu and counts toward branching;
`axis: null` is medicine.

**A new minigame.** Implement `Minigame` in `src/game/minigames.ts`. It gets the
three buttons and draws itself onto the same low-res HUD canvas.

**Balance.** Every tuning number lives in `src/game/tuning.ts`. `TIME_SCALE`
fast-forwards the whole simulation for playtesting.

## Layout

```
src/
  data/       voxel models, species graph, foods, pixel font, menu icons
  game/       simulation, save/migration, actions, branching metrics, minigames
  render/     ogl scene, voxel mesh builder, shell geometry, bloom, HUD canvas
  engine/     input hit-testing, WebAudio beeper
  ui/         screen drawing
```

In dev builds `window.__pet` exposes `{ app, hud, shell, step, advance }` so the
game can be driven frame by frame from the console.
