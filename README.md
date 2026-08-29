# PETZ-9000

A 3D virtual pet in a plastic shell. Single page, no backend, saves to
`localStorage`. Built with [ogl](https://github.com/oframe/ogl), TypeScript and
Vite; every asset — geometry, textures, font, sound — is generated in code, so
there is nothing to load. The screen is a 192x172 framebuffer — twelve rows
taller than the classic 192x160, to house the ticker.

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

A news ticker crawls along the bottom of the screen, above the lower icons: the
weather, a season on its way, the lineage's standing goals, and breaking news —
an evolution, a curio found, a season arriving. Any system can push a line onto
it (`app.pushTicker`), so it is the game's ambient messaging channel; the toast
remains for immediate feedback.

The pet talks through it too, in its own voice: it welcomes you back (more
effusively the longer you were gone), thanks you for meals and baths and
medicine, says goodnight on its way to bed, asks for what it needs in the first
person, and mutters idle thoughts — some only at night or in particular weather.
The egg has lines of its own. Pet-voice lines occupy a single slot rather than a
queue, so five quick meals thank you once, not five times; breaking news still
outranks them.

Every species has its own personality pack (`src/data/voice.ts`) layered over
the shared pools, so the voice changes as the pet evolves: the wide-eyed
hatchling ("I HAVE FEET! LOOK! FEET!") grows into whatever it was raised into —
a braggart Blazeon ("THE SUN WAS IN MY EYES"), a begrudging Gloopus ("IT WAS...
ADEQUATE. THANKS."), a world-weary Grumphal ("HMPH. TOOK YOU LONG ENOUGH."), a
serene Verdantis, a nocturnal Lumenox whose best line only comes out at night.
Species lines win about 60% of draws, so the character shows without the shared
voice disappearing.

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

## The long game

Care keeps a pet well; the lineage is why you keep coming back.

- **Retirement.** Hold B on an adult's status screen and it retires — a
  farewell, a slow walk into the meadow haze, and a place in the album. The
  next egg hatches with an heirloom: a small starting bonus per ancestor,
  capped. NEW PET remains the hard reset; retirement is how a family grows.
- **The collection.** FOUND x/12 counts species reached across every
  generation. One form, Aurorix, exists only for a well-cared-for child
  evolved while the world is in winter.
- **Curios.** Left alone for twenty minutes or more, the pet usually finds
  something — and most finds are gated by season or weather (a snowdrop needs
  winter, a dewdrop needs rain), so completing CURIOS x/8 takes visits at
  different times. They are kept on a **collection board** filling the right of
  the status screen: every curio has a slot, found ones in their own colour,
  the rest as flat silhouettes, with a tally under any the pet has found more
  than once. Showing the gaps is the point — the board says what is still out
  there without saying when to come back for it.
- **The album.** A second board under the curios, one slot per form, each drawn
  in its own body colour taken straight from its voxel model so the board and
  the creature always agree. Forms the family has never grown show as
  silhouettes, which is what makes the branch conditions worth chasing.
- **The streak.** Days visited, shown on the status screen. Consecutive days
  build it; missed days erode it one per day rather than wiping it out.
- **Shell colours.** Earned by milestones — a streak, a retirement, curios,
  discoveries — and cycled with the SHELL button. The device becomes a record
  of what the family has done.

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

The clearing runs the full width of the yard, so the pet has far more ground to
cover than the frame can hold at once. Rather than moving, the camera stays put
and **turns on the spot to follow it**, easing round and stopping at forty
degrees. Inside that arc the pet stays centred; past it the camera holds still
and the pet walks on out towards the side of the screen, which is what makes the
yard feel wider than the window onto it. The sun is shifted by the same angle,
so it stays put in the world instead of riding along with the view.

The framing is set by the field of view rather than by where the camera stands.
The terrain's haze begins at a depth of 11 and the pet stands at about 9, so
pulling the camera back to fit more in would walk the pet and the ground under
it into the fog; widening the lens leaves every distance, and so the haze,
exactly where it was.

### The face

Every creature has eyes, brows, pupils and a mouth, and none of it is drawn by
hand. The eyes of a pet are its darkest voxels, set in the front of its head, so
the face is found by looking at the model rather than by keeping a table of
twelve faces in step with twelve models. A creature whose darkest colour is not
near-black has no face — which is how the egg, correctly, opts out.

The face is built **into the pet's own mesh** rather than laid over it. The pet's
vertex shader bends the whole body: it stretches, settles, twists to look about,
bobs through a walk cycle, hops and hatches. A face on a separate mesh would
have to repeat every one of those exactly, and would slide off the head the first
time one of them changed. Sharing the mesh means it cannot come adrift. Each face
vertex carries which feature it belongs to and its offset from that feature's
centre, which is enough for the shader to blink the eyes, travel the pupils,
curve the mouth and tilt the brows before the body deformation runs.

The first thing drawn is a patch of the head's own colour over the eye the model
painted. That one quad is what frees the rest: while the drawn eye had to hide
the old one, it could never be smaller than it, nor sit anywhere but exactly on
top of it — and the models' eyes are large and wide-set. Painted out, the eye can
be drawn at whatever size and spacing suits, and it is drawn small and close.

The eyes are round — a fan of triangles rather than a quad, and the nose with
them. The shader is untouched by that: it poses each feature from the offset
every vertex carries from its own centre, so it blinks and steers a disc without
knowing it is not a rectangle. The patches that hide the painted features stay
rectangles, because what they cover is rectangular.

The features sit a quarter of a voxel proud of the head; at a fiftieth they came
out striped with z-fighting. The whites carry a dark rim behind them, because
several of these creatures are near-white themselves and a pale sclera on a pale
head simply disappears, leaving the eye reading as nothing but its pupil. The
head colour for the patch is sampled from the voxel beside the eye, so it is
right for every species without a table.

The muzzle some of the models paint between the eyes gets the same treatment as
the eyes: covered over and redrawn at about half the size, since a big blunt
nose is the least cute thing on a face. Finding it takes more care than finding
the eyes, because a model's secondary shading colour also sits below the eyes
and is also "not skin" — ungrouped, a whole band of belly shading reads as an
enormous muzzle. Candidates are grouped by colour, and a muzzle is the group
that straddles the middle, spans a few voxels rather than the whole body, and
sits within two voxels of the eyes. Three of the eleven have one; on the rest
nothing is drawn.

The mouth is set a good way below the eyes to clear whatever muzzle the model has
painted between them, and by that height the body may have bulged out in front
of the face — so the front surface is measured again at the mouth's own height
rather than borrowing the eyes'. Two of the eleven need it; on the rest it
changes nothing. Left on the eyes' plane, those two swallowed their own mouths.

What the face does comes off the same numbers as the rest of the pet, so it can
never disagree with it. Mood curves the mouth and sets the brows; sadness also
drops the gaze and bows the whole body forward from the hips, which reads from
across the yard in a way an eyebrow never will. The eyes blink on their own
timer, and glance about between longer looks straight at you.

### Thoughts and humming

Above the pet is a bubble drawn on a small canvas: a thought with trailing puffs,
or speech with a tail, showing a large pixel symbol — a heart, a bowl, a note, a
question. Needs come first, so a hungry pet never stands there musing about the
weather, and a cheerful one hums, with notes rising past its head.

A symbol on its own says very little: a bowl could be hunger or dinner, and a
question mark could be anything at all. So the bubble never goes up alone. Each
one is paired with the words for it — "PIP IS HUNGRY" — which cut straight to
the front of the ticker rather than joining the queue, where they would arrive a
minute after the bubble they belong to had gone. The bubble then stays up for
exactly as long as its line takes to scroll past, so the two begin and end
together. The pet holds its tongue for a good while afterwards, so the ticker
gets the world back.

There was a held placard as well, and it did not work. A sign has to look held,
and these creatures have no arm in view to hold one with, so it read as a
rectangle floating beside them rather than as something the pet was doing.
A bubble carries a tail back to the pet and needs no hands. Everything the sign
used to say is simply said.

The bubble stands well in front of the pet and off to one side. Placed level with
it and only a little aside, the quad sits inside the pet's own head and is never
seen.

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
shelter the world clock runs forward to sunrise, however far off that is, taking
a second or two per few hours covered. A sleep is therefore worth whatever the
hour makes it: bedded down at dusk the pet gets most of a night and wakes rested
and hungry; bedded down at noon it sleeps most of a day and wakes ravenous;
bedded down just before dawn it gets barely any sleep at all and is up again
almost at once, free to go back to bed. It wakes when the night ends whether or
not that was long enough to fill its energy.

**It also wakes on its own the rest of the time**, once it is rested and the sun
is up — so a nap never ends in the small hours. The same rule applies while the
app is closed: a pet left asleep wakes at the dawn it would have woken at,
rather than sleeping through the whole absence and dodging its hunger. It gets the
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
from the pet's id — every life gets its own ground. The patch is twice as wide
as it is deep, and the middle is levelled into an elliptical clearing that runs
almost its whole width, so the pet has somewhere to roam without ever meeting a
step. The patch fades into the sky with depth-based haze, so its edge is never a
visible boundary.

Lanterns light the yard: one beside the shelter door and a row of six standing
behind the band the pet roams, far enough back that nothing walks into them and
near enough in that they stand on the clearing's level ground. Their glass is
the only scenery that makes its own light — emissive, written into the bloom
mask so it glows rather than merely being bright, and each driving a real point
light over the ground, the shelter and the pet.

They come up as the sun goes down and go out again once the pet is in bed: the
yard is lit for the pet, not for the player. The change is eased over about two
seconds, so bedtime dims the meadow rather than switching it. The pet steers
around the posts rather than through them, since it walks by aiming rather than
by planning a route.

The shaders carry a fixed-size array of lamps and light every slot, so the count
has to match the number actually placed — a spare slot sits at the origin in
view space, which is the camera, and lights whatever comes near it.

A shelter stands at the back of the yard, on its own levelled pad with a level
path running forward to the clearing — the pet does not sample terrain height as
it walks, so every surface it crosses has to be flat. Its front is left open so
the pet stays in view inside, and its interior is tall enough for the pet to
stand up in. Which side it sits on depends on the seed.

### Visitors

Some days there is something in the yard: a ball to knock about, a rabbit
grazing on the verge, a snowman somebody built, wildflowers, a jack-o-lantern
by the door, a butterfly, a pile of leaves, a sled. Each belongs to one or two
seasons and turns up on a given world day only if the dice say so, rolled from
the day number so it is settled for the day rather than flickering. Arrivals are
announced on the ticker, which is the only reason a small thing on the far verge
gets noticed at all.

They are not scenery. Scenery is stamped into the terrain's voxel field, and
that field is only meshed when the pet changes — a 40ms rebuild is far too much
to spend on the year turning. Each visitor is its own small mesh instead, faded
in and out, sharing one program that carries the same sun, fill and lanterns as
everything else.

Standing room is the constraint that shapes the placement. The clearing is level
only inside an ellipse, and the pet roams a smaller one inside that, so anything
standing still has to sit in the gap between the two — past the pet, still on the
flat. That leaves a short row of pitches, which also have to miss the lantern row
and the shelter's frontage, so they are picked from a fixed set and handed out
without collisions. Things that move are freer: the ball sits inside the roaming
band where the pet can reach it, and the pet steers over to it about a third of
the time it picks somewhere new to walk.

The ball rolls properly. It carries a velocity, the pet's shove sets that
velocity, rolling friction takes it away again, and it bounces off the edge of
the roaming band so it can always be fetched back. Its spin is derived from the
travel rather than run off a timer: the axis is horizontal and across the
direction of motion, and one radius of travel is one radian, so it never skates.
Its node sits at the ball's centre with the mesh hung half a diameter below,
because a mesh built sitting on the ground would otherwise pivot on the grass
instead of rolling over it. Nothing else may write to that node's Euler
rotation, since ogl syncs Euler back into the quaternion and would undo the
roll.

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

That shader is also where the frame is encoded for display. The scene is lit in
linear light, so it has to be gamma-encoded once at the end or every midtone
reads far darker than the colour it was picked as — the meadow looked permanently
overcast until it was. The HUD is authored as sRGB hex and so is linearised on
the way in, and a soft shoulder above 0.8 keeps the pale pets from clipping to
white on their lit side. Anything multiplicative happens before the encode and
anything cosmetic and additive after it.

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
