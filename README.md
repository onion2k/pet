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

Six icons ring the screen: feed, play, clean, medicine, sleep and status. An
icon blinks red when the matching stat is critical.

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
- **sleep** — whether bedtimes landed while the world's sun was down

Egg → Blobbit → one of three children → one of six adults. Eleven forms, and two
playthroughs genuinely diverge.

### Moving about

Pets have short arms and legs. Both are swung about their joint — the hip and
the shoulder, whose heights the mesh builder measures from the model — rather
than translated, because translating one part of a rigid voxel model shears it
apart. Arms counter-swing against the legs, which is what makes a walk read as
a walk, and the body rises and falls with each stride while the feet stay
planted.

The pet ambles around its clearing: it picks somewhere to go, walks there,
pauses, then turns back to face the viewer. Put it to bed and it walks itself
into the shelter, settles just inside the open front where it stays visible,
and curls up only once it has arrived — a pet shuffling to bed should still be
walking, not hunched over mid-stride. Wake it and it comes back out. A pet
loaded from a save while asleep starts indoors rather than trudging there. Targets are flattened along the
view axis, so it mostly moves across the frame rather than into it, and roaming
is bounded well inside the level clearing so its feet never step onto ground
that steps up or down beneath them. Eggs have nothing to walk with, and a
sleeping pet stays where it is.

### Time, seasons and weather

The world keeps its own clock, running far faster than real time. A day takes
**twenty-four minutes**, one minute to the hour — following the player's real
clock was the obvious first move and the wrong one, because someone who only
plays after work would only ever see night. At this rate a few minutes with the
pet covers a visible sweep of sky, and a single sitting can span dawn to dusk.
The sun arcs across, warms through dawn and dusk, and hands over to a moon.
Night keeps a usable light floor: this is a pet you have to be able to see, so
the mood comes from the light shifting cold rather than from darkness.

A season lasts **seventy minutes**, a little under three world days, so all four
pass in under five hours. That period is deliberately not a whole number of
days: on a round one the two lock in phase and seasons would always turn over at
the same hour. Each season holds, then turns over into the next across its last
quarter.

Night is simply the sun being down, so the bedtime the game judges the pet's
sleep discipline against is the same one the player can see in the sky — and it
moves with the season, since winter nights are longer.

**Putting the pet to bed winds the night past.** Once it has settled in the
shelter, the world clock runs forward eight hours over about three seconds: the
sun comes up, the sky turns, and the pet wakes rested and hungry. It gets the
rest it slept through — energy back, and a night's worth of hunger and grime —
but it does not age, because a whole stage is shorter than a night and one sleep
would otherwise carry a hatchling clean through to adult. The offset the sleep
adds is saved, so the world stays where the pet left it.

Weather is drawn from the season — rain and mist in spring and autumn, snow in
winter, mostly clear in summer — and changes every eighteen minutes, dulling the
sky, flattening the sun and lifting the fill light the way an overcast day does.
Both the day and the year come from the wall clock, so they advance while the
app is closed and nothing about them needs saving.

Repainting the world for the season would mean rebuilding every mesh, so terrain
and props store a **material index** instead of a colour and look it up in a
one-row palette texture. Sixteen pixels are uploaded each frame, the geometry is
never touched, and seasons can cross-fade rather than jump.

### The world

The pet stands on a voxel terrain patch built from the same mesh path as the
pets themselves, so it gets identical hidden-face culling and baked corner
occlusion. Heights come from two octaves of deterministic value noise, seeded
from the pet's id — every life gets its own ground. The middle is levelled into
a clearing for the pet to stand and eventually move around in. The patch fades
into the sky with depth-based haze, so its edge is never a visible boundary.

A shelter stands at the back of the yard, on its own levelled pad with a level
path running forward to the clearing — the pet does not sample terrain height as
it walks, so every surface it crosses has to be flat. Its front is left open so
the pet stays in view inside, and its interior is tall enough for the pet to
stand up in. Which side it sits on depends on the seed.

Rocks and plants are scattered over the rest: pebbles, rocks and boulders, and
tufts, ferns, shrubs and blooms. They are stamped **into the terrain's own voxel field**
rather than added as separate meshes, which is what makes them sit convincingly
in the grass — a rock occludes the ground it rests on and picks up real contact
shading, and the buried faces are culled along with everything else. Placement
is a deterministic jittered scatter that keeps props out of the pet's clearing,
out of the shelter's pad and path, apart from each other, and off ground too
uneven to stand on.

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
is air. Pets are authored on an 11-wide, 9-deep grid. Mark leg characters in
`legs` and arm characters in `arms` and the walk cycle picks them up; joints are
derived from wherever those voxels reach, so nothing needs measuring by hand. Set `mirror` and give only
the left half plus the centre column — six characters per row — and the model is
mirrored on build, so symmetry is structural rather than something to get right
by hand. Mark characters as `emissive` to make them bloom, but sparingly: a
dense emissive layer blows out to a solid white slab under the bloom pass.
Register the form in `src/data/species.ts` with branch rules scoring against
`Metrics`. The mesh builder culls interior faces and bakes corner ambient
occlusion, which is what makes the cubes read at this resolution.

**Terrain and scenery.** `src/data/biome.ts` holds the palettes, the patch's
dimensions and the scatter density; `src/render/terrain.ts` turns them into
geometry. A biome is a surface pair, a soil and a rock colour, sky and haze
tints, and the colours its props resolve to. `src/data/props.ts` holds the props
themselves as small voxel models with a placeholder palette — `s`/`t` for stone,
`f`/`e` for foliage, `w` for stems, `p` for flowers — resolved against the biome
at build time, so one prop set can dress several biomes. Give each a `weight`
for how often it appears and a `spacing` for how much room it needs.

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
