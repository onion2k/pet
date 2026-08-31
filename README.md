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

Seven icons ring the screen: feed, play, clean, forage, medicine, sleep and
status. An icon blinks red when the matching stat is critical.

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

### The booklet

A **HOW TO PLAY** link sits at the top right of the page, and behind it is
`how-to-play.html`: an illustrated instructions booklet covering the buttons,
the icon ring, the five stats, the food, the three games, the whole family tree,
foraging, the curio board and the kit, the world's clock, and a map of the
meadow with the four grounds laid out by how far off they are. It does not yet
know the family can move house — the map and its prose are still the meadow's
alone.

Almost none of it is written twice. The creatures are drawn from their own voxel
models (`howto/voxel-sprite.ts`), so a picture in the booklet cannot disagree
with the thing that hatches. The minigame illustrations are real `GameSession`s,
wound forward a few frames and asked to draw themselves onto a canvas the same
192x172 as the glass — which is what the drawing half of `Hud` was split into
`render/pixels.ts` for. The tables of food, grounds, curios, kit, forms, shells
and visitors are read out of the same data the game plays from.

What it deliberately leaves out is the dice: which curio wants which weather,
how far out the rare things live, what the odds are of coming home muddy. Those
are the game's to reveal, and a booklet that printed them would hand the player
the answers to the only questions worth having. The kit is the exception, and
prints what earns each piece — because there are no dice in it to spoil, and a
list of things to go and do is no use to anybody kept secret.

## The long game

Care keeps a pet well; the lineage is why you keep coming back.

- **Retirement.** Hold B on an adult's status screen and it retires — a
  farewell, a slow walk into the meadow haze, and a place in the album. The
  next egg hatches with an heirloom: a small starting bonus per ancestor,
  capped. NEW PET remains the hard reset; retirement is how a family grows.
- **Moving house.** Hold C on an adult's status screen and the family can move
  somewhere else. The grounds and the visitors come with the house, so where you
  live decides what there is to do; the garden stays behind and the strays come
  along. See [Moving house](#moving-house).
- **The collection.** FOUND x/12 counts species reached across every
  generation. One form, Aurorix, exists only for a well-cared-for child
  evolved while the world is in winter.
- **Foraging.** The pet's own job, and the main way the board gets filled. A
  child can be sent as far as the old wall; an adult can be sent anywhere. See
  **Sending the pet out**, below.
- **Curios.** Most finds are gated by season or weather (a snowdrop needs
  winter, a dewdrop needs rain) and the rarest is gated on how far the pet was
  pushed, so completing CURIOS x/8 takes visits at different times and trips
  that went badly. They live on a **collection board** — reached with A from the
  status screen — where every curio has a slot, found ones in their own colour
  and the rest as flat silhouettes. Showing the gaps is the point. The kit
  shares that board, on a row of its own beneath them.

  The board has a verb: **three spares trade up** for whichever curio is still
  missing, so a season you keep failing to catch stops being a wall the year
  takes an hour to come round. It is grouped into three sets — stones, blooms,
  weather — and finishing one is a standing reward that makes the pet better at
  the job that fills the board: surer footed on a long trip, sharper eyed for a
  find, or able to read the sky. Being left alone for twenty minutes or more
  still turns something up now and then, but only one of the ordinary things,
  and only a quarter of the time: absence is the consolation, not the equal.
- **The kit.** The other half of the board, and the half the pet *uses*. Eight
  things — an umbrella, a bobble hat, a snowboard, a torch, stout boots,
  waders, a basket and a pine cone — each tied to a condition the world already
  produces, and none of them found. **Every one is earned by doing the job it
  then helps with:** go out in the rain three times and the pet takes to
  carrying an umbrella; push past the first leg often enough and it puts boots
  on. There are no dice anywhere in it, and the board says how many more trips
  each one wants — so the half you have not earned is a list of things to go
  and do rather than a wall to wait behind. Kit belongs to the family rather
  than to the pet carrying it, so a torch one pet walked out three dark nights
  for is still in the porch for the next, and NEW PET takes it, tally and all.

  Six of the eight are visible on the pet: the hat goes on when it snows, the
  umbrella up in the rain, the torch out after dark, the boots stay on and
  become waders in the wet, and the basket rides on its back. Kit shows when it
  is *doing* something rather than whenever it is owned — a pet wearing all
  eight at once would be a hat stand, and would say nothing about the day. The
  snowboard leans by the shelter door on a snowy day, and so does the umbrella
  on every day it is not up. Only the pine cone has no look. See
  [Kit on the pet](#kit-on-the-pet).

  It is not a currency and cannot be traded: a second umbrella is worth nothing,
  so there is nothing to spend. The rule the whole list obeys is that kit does
  not make a good day better — it makes a bad day playable. Which is why simply
  owning a thing is enough to have it, and why a full kit does not so much make
  every day good as make every day legible.

  A trip counts toward everything it was, and every trip counts. One pushed
  through snow after dark is three kinds of trip at once, and a trip that came
  home with nothing was still a trip out in the rain — which matters, because
  the worst days are exactly the ones a player most wants kit for.

  Three of them read the day so far. An **umbrella** takes wet weather out of
  the reckoning, so the long hill is worth a try in the rain rather than not
  today — and the pet never comes home caked in mud. **Waders** are its mirror:
  a ground that wanted rain stops needing it, so the creek is workable on a dry
  afternoon. A **bobble hat** does the same for winter, and keeps the pet warm
  through a winter night without burning the kindling it went out to fetch.
  The grounds menu names whichever of them is speaking for a ground, so the
  read never silently changes underneath you.

  Forgiving a miss is not the same as manufacturing a hit: the best a forgiven
  day can read is *worth a try*, never *looks promising*. If a full kit could
  make any old day promising, the sky would stop being worth reading, which is
  the one thing this game asks of a player.

  Three more work on the far end of a trip, which is the only place anything
  ever goes wrong. **Stout boots** cut the odds of a mishap and mean the pet
  never limps home footsore. A **snowboard** halves the price of one more leg
  while there is snow to ride, so a snowy day is the day to go deep — and the
  prompt that offers the leg names the board that made it cheap. A **torch**
  answers the dark, which is the one thing in the game the kit makes *worse*:
  after nightfall, pushing on is riskier than it is by day, and a lit torch
  puts it back the way it was and sees a leg further out besides. The forage
  menu says so both ways round, so neither the risk nor the answer to it is
  something the player has to work out for themselves.

  The dark is a multiplier on the price of being greedy rather than a risk of
  its own, so a there-and-back after dark is exactly as safe as it always was.
  Risk in this game is always chosen.

  The last two are about the supply line and the sky. A **basket** brings
  supplies home more often and lets the larder hold three more of anything, so
  a foraging adult can actually bank a stock rather than topping one up. And a
  **pine cone**, which closes before rain, tells you when the weather is going
  to break and what to — printed under WHERE TO?, because that is the screen
  where a day is a thing you are spending rather than a thing you are reading.

  The forecast is not a guess. The weather is a hash of which spell of the
  world's clock a moment falls in, so the cone asks the same function the sky
  is painted from about a moment that has not arrived. It reports the next
  *change* rather than the next spell — "clear" in clear weather tells nobody
  anything — and says nothing at all when the sky is set for as far ahead as it
  looks.
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

**A long absence is a setback, not a catastrophe.** The first three hours away
run at the live rate — the pet is simply carrying on without you. After that it
paces itself at `AWAY_SLOW_PACE`, and offline decay can carry a stat down to
`AWAY_FLOOR` and no further (health to `AWAY_HEALTH_FLOOR`, which is just below
sick). Come back after a night and the pet is hungry; come back after a weekend
and it is hungry, filthy and unwell, and a meal, a bath and a dose put it right.
The cushion only ever stops a stat falling — it never hands back one the pet had
already spent. Those same slowed-down hours are left out of the care counters
entirely, so a weekend away tells on the pet's condition without being held
against how it was raised.

**Being away is measured from the page, not from the last frame.** A hidden tab
is still handed the odd animation frame in some browsers, which is enough to
keep `lastTick` current and make an eight-hour absence look like the minute
since the last one. So `visibilitychange` records when the page went away and
the app reports the gap from there. A catch-up big enough to have been an
absence also counts as one even if the tab never reported itself hidden — the
welcome screen, the pet's greeting and the curio roll all fire on a returning
tab, not only on a fresh load.

### Branching

Every form is a node in a graph with weighted branch rules. When a stage's
duration elapses, each candidate branch scores itself against four normalised
measures of how the pet was raised, and the highest score wins:

- **care** — time spent with a stat bottomed out, plus a penalty per illness
- **diet** — the ratio of sweet / protein / veg / junk meals eaten
- **play** — minigame win rate weighted by how often you actually played, and,
  for games played out in the yard, which sort of play it was
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

### Kit on the pet

Six of the eight are visible on the pet. It puts its bobble hat on when it
snows, its umbrella up in the rain, its torch out after dark; it wears its
boots always and swaps them for waders in the wet; the basket rides on its back
and shows when it turns. So the yard says what the weather is doing — which is
the one channel that never did.

It is the face's trick a second time, and cost almost nothing because of that. A
hat is a small voxel model merged into the pet's own mesh with the head's `part`
on every vertex, after which it twists with the idle look-around, settles when
the pet sleeps, bows when it is sad and rises with each stride — **without one
line of the shader changing.**

Where it goes is measured the way the face is. Eight items across a dozen forms
would be ninety-six placements to write down and ninety-six chances for one to
drift the next time a model is edited; measured, it is one pass that cannot
disagree with the creature it is measuring. The catch is that the top of a model
is not the top of a head — Mochimo has a tuft of four sparkles up there and the
hatchling an antenna — so a layer has to be a decent share of the creature's
fullest one to count as somewhere to put a hat. A wisp is not a head.

Kit is built at the wearer's own voxel size, so its blocks line up with the
head's. That is not the same as being one size for everyone: the forms are
normalised to a single world height but are not all the same number of voxels
tall, so a voxel is a shade bigger on a shorter creature and its hat is too.

Four anchors carry the lot, and which part each piece rides on is the whole of
how it moves: the crown for a hat, which twists with the look-around; a hand
for the umbrella and the torch, which counter-swing with the walk; both feet
for boots, which pivot from the hip and stay planted; the back for the basket,
which rides with the body. Two of those are a *pair* — a pet does not put one
boot on — and two are held, in different hands, so a wet night does not put the
umbrella and the torch in the same fist.

Placement wants two ideas beyond "stand it on the anchor". Things sink: a hat
resting exactly on the crown floats, so it goes down a voxel and the brim
grips. And things are held **outward**, away from the model's middle: an arm
ends at the body's own edge, so a torch tall enough to be worth drawing
vanishes behind the head without it. A single number does for both hands,
because outward is signed by the side the hand is on.

What decides whether a thing is worn at all is `shows(day)` on the item. Kit
shows when it is *doing* something rather than whenever it is owned — a pet
wearing all eight at once would be a hat stand and would say nothing about the
day. Boots and the basket are the exceptions and are worn always: they say
something about the family rather than about the sky.

Two pieces belong in the yard rather than on the pet, and are stood by the
shelter door instead — built exactly the way plantings are, since they are the
same sort of thing: put somewhere, never moving, and rebuilt only when they
change. A **snowboard** is bigger than the pet and cannot be carried
convincingly, so on a snowy day it simply leans there, ready. And the
**umbrella** is furled against the wall on every day it is not up, which makes
it the one object that *moves* with the weather: in the pet's hand when it is
wet and by the door when it is not, so where it is says which. A test holds it
to being in exactly one of those two places on every day the world can
produce — nowhere at all would read as having lost it.

Being part of the one mesh is what buys all of that, and what it costs is a
rebuild whenever the kit changes — which is why `setWorn` is called every frame
and does nothing at all unless the answer has actually moved.

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
or speech with a tail, carrying a few words in the same font the HUD uses. It
holds what the *pet* says — "FEED ME", "SO TIRED", "LA LA LA" — while the ticker
carries what the game says about it, "PIP IS HUNGRY". Keeping those apart is
what stops the two repeating each other. Needs come first, so a hungry pet never stands there musing about the
weather, and a cheerful one hums, with notes rising past its head.

A symbol on its own says very little: a bowl could be hunger or dinner, and a
question mark could be anything at all. So the bubble never goes up alone. Each
one is paired with the words for it — "PIP IS HUNGRY" — which cut straight to
the front of the ticker rather than joining the queue, where they would arrive a
minute after the bubble they belong to had gone. The bubble then stays up for
exactly as long as its line takes to scroll past, so the two begin and end
together.

After that the pet holds its tongue for a long time. A bubble every half minute
is wallpaper and stops being worth looking up for, so a need — something the
player can actually do something about — comes round every two or three minutes
while it goes unmet, and an idle musing only every four to nine. Most of the
time the pet simply gets on with its day.

There was a held placard as well, and it did not work. A sign has to look held,
and these creatures have no arm in view to hold one with, so it read as a
rectangle floating beside them rather than as something the pet was doing.
A bubble carries a tail back to the pet and needs no hands. Everything the sign
used to say is simply said.

The bubble stands well in front of the pet and off to one side. Placed level with
it and only a little aside, the quad sits inside the pet's own head and is never
seen.

It is billboarded about its own position rather than the pet's. A quad with a
+z normal turned by *t* has the normal (sin *t*, 0, cos *t*), so *t* is the
bearing from the quad **to** the camera — not the camera's own pan, which is the
bearing the other way and turns the quad away by twice the error as the pet
moves off centre. Turning the parent instead of the quad would swing the bubble
around the pet on an arc rather than turning it where it stands.

The weather falls through a volume far wider than it is deep. The yard runs the
whole width of the meadow and the camera turns forty degrees to follow the pet
across it, so a volume square in plan — which is what it was — left the rain
stopping short well inside the frame at either extreme. Its particle counts are
derived from a density rather than written down, so widening the volume cannot
quietly thin the rain out.

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

**Sleep is restorative.** A sleeping pet's metabolism slows right down rather
than easing off a little — a night costs it a fraction of the hunger and grime
the same hours awake would — and its happiness climbs while it dreams. So a full
night ends with the pet rested, cheerful and ready for breakfast, instead of
waking to a screen of empty bars that the sleep itself emptied.

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

### Showing the stakes

Twelve forms branch on four vectors of behaviour, and every branch carries a
line of prose explaining it — *a sweet tooth and a quiet life*, *greens and
early nights*. That line used to appear in exactly one place: the evolution
screen, at the moment the decision had already been spent. The status screen now
names the branch the pet is currently earning, in those same words, while there
is still time to steer it. What it becomes stays hidden, because knowing you are
heading somewhere is the useful part and knowing exactly where would end the
surprise.

### Temperament

The four raising metrics — care, diet, play and sleep — fed exactly one
decision, which branch the pet took, and that decision is spent the moment it
grows up. They carried on being computed for the rest of its life while nothing
read them, which is why adulthood felt like the point where the game stopped
having a memory.

Growing up now settles a **temperament** from that same reading, kept for the
rest of the pet's life. A lively pet burns through its spirits and its energy
and gets more out of a game; a restful one holds both and keeps its own hours; a
devoted one frets when left alone but stays clean. Two Mochimos raised
differently are no longer the same pet.

Nothing stands out unless it genuinely stands out, and the readings are not on
the same scale — care sits high for anyone half attentive, while play wants
twenty games and sleep wants punctual bedtimes. Compared raw, three pets in four
came out devoted. Each is measured against what is typical for that axis
instead, so an ordinary player gets a spread and a deliberate one gets what they
raised for.

### Elders, and why you would stay

Adulthood used to be terminal by construction: `STAGE_DURATION` had no entry for
it, so `readyToEvolve` always answered no. And the heirloom passed to the next
egg was `album.length × 5` — a count of how many pets you had retired, not how
they lived. Between them, retiring the moment a pet grew up was strictly
optimal: it advanced the album, advanced the heirloom, and restarted the only
system in the game where choices accumulate. There was no incentive to stay
because the incentive pointed at the exit.

Three **elder** forms answer that. They are reachable only after three hours of
adulthood, and which one — if any — is decided by the temperament: Wardenor for
the devoted, Zephyrix for the lively, Somnix for the restful. An easygoing pet,
having settled on nothing in particular, stays as it is. So the whole chain now
pays off end to end: how you raise a pet decides its temperament, and its
temperament decides what it can still become.

Scoring alone could not express this. `chooseBranch` takes the highest score, so
a branch scoring zero is still taken when it is the only one on offer; branches
gained an `available` gate for conditions that are not unlikely but impossible.

The heirloom is now what the ancestors were *worth* rather than how many there
were. A life is scored on how long it was allowed to be grown up and how well it
was kept, so a pet retired the instant it came of age passes on nothing at all,
and a full one passes on the lot.

### Foraging

Sending the pet out used to be one button, ten seconds of black screen and a
weighted roll. The README claimed the whole decision was *when* to send it, and
the code never gave that decision anywhere to land. It is now four things: a
choice of ground, a trip that is told, a risk you can take on purpose, and a
supply line back into the rest of the game.

**Where to send it.** Four grounds, on a menu built to the feed menu's shape —
A/C to pick, B to go — each wanting a different sort of day. They belong to the
place the family lives, so moving house swaps all four.

| Role | From | Costs | Wants | In the meadow | On the shore |
| --- | --- | --- | --- | --- | --- |
| near | child | 6 | nothing in particular | The Old Wall | The Tideline |
| wet | adult | 10 | rain, or a mist | The Creek | The Rockpools |
| sheltered | adult | 9 | autumn | The Hollow | The Dunes |
| far | adult | 14 | clear weather | The Long Hill | The Headland |

Every biome supplies the same four roles at the same costs. That is not
tidiness: it is what stops moving house from stranding anyone. A child always
has exactly one ground wherever it lives, and nowhere lacks somewhere to go on a
fair day. What differs is what a place turns up, because curios are the
collection and that is the right thing to make somewhere worth living in.

| Place | Leans toward |
| --- | --- |
| Meadow | an even spread — pebbles, dewdrops, toadstools, feathers, geodes |
| Woodland | blooms: blossom and toadstools, and snowdrops off the ridge |
| Beach | stones and weather: pebbles, feathers, geodes |
| Hillside | geodes and snowdrops — cold, stony finds |
| Village | blossom, and the churchyard for the autumn ones |

Sunpetals are the summer bloom nothing inland favours, and they are why two of
the five are worth the walk: the beach turns them up on the tideline and the
village out on the water meadow. A collection you cannot finish without living
somewhere else is the point of the whole arrangement.

Every row carries a read on today — LOOKS PROMISING, WORTH A TRY, NOT TODAY —
worked out from the ground against the live season and weather, and the same
read settles the trip when it comes home. That line is the load-bearing part of
the whole feature: it turns what the player knows about the year into something
they spend. A ground with no preference is always fair, which is what makes the
near ground the sensible fallback on a day when nothing else looks good. The
child's single ground is also how the job grows with the pet rather than
arriving all at once at the last stage.

**The trip is told, not waited out.** The pet trots off over the hill and the
picture fades to black as before — that part was always worth watching — but the
black now hands over to a screen of its own, and the walk arrives a beat at a
time: setting out, the middle of it, the way home, what it came back with. Beats
are drawn from the ground, the season, the weather, whether it is dark, and the
species' own pack, so a Grumphal sighs at the state of the path where a Warden
checks the boundary as it goes. This had to be a screen rather than a dimmed
picture: `uDim` in the screen shader multiplies the finished frame, HUD and
ticker included, so a forage that stayed dimmed could not say anything at all.
The trip screen is opaque, so handing over from a black picture to a black panel
is a change of what is drawn rather than anything the eye can catch.

**Push your luck.** Halfway through, the trip asks: `B GO ON   C HOME`, with a
bar counting down. Nobody answering means coming home, so looking away is never
punished and never blocks. Each extra leg costs energy, makes a find likelier,
and raises the chance of a mishap — home caked in mud, limping and footsore,
late and empty, or caught out and looking it. A mishap that does not spoil the
find is said alongside it, because the whole point of pushing on is coming back
muddy and pleased with yourself. Three legs is as far as it goes, and it is the
only way to reach the rarest finds: the geode, the seeds, the strays.

**What it brings back.** Curios for the board; supplies for the larder; and on a
long trip, something that changes the yard. Supplies are picked up *on the way*
rather than looked for, so they ride along with whatever the trip was actually
about — including a bad one, which is what stops a wasted trip feeling wasted.

- **Food.** Bramble berries, wild roots, honeycomb. They appear on the feed menu
  beside the bought food with a count beside them, are free, count toward the
  diet axes like any other meal, and vanish from the menu when they run out. So
  a grown pet feeds itself, and can be raised toward a particular form on what
  it finds rather than on what it is handed.
- **Kindling.** Spent automatically when the pet turns in, and a banked fire
  costs it `WARM_NIGHT` of what the night would otherwise take. The rest sleep
  already gives is untouched — only the draining rates are scaled — so a warm
  night is a pet that wakes up in better shape, not one that wakes up sooner.
- **Seeds and strays.** See **The yard remembers**, below.

It is the one job the game asks of an adult, and the icon strip grew a seventh
button for it. That strip was written for three icons a row; it now lays out
whatever it is given, so the extra one did not quietly fall off the end.

### The yard remembers

Everything else in the yard is either scenery stamped into the terrain when the
pet changes, or a visitor rolled fresh each world day. A **planting** is
neither: the pet carries a seed home from a long trip, puts it straight in the
ground on one of the verge pitches, and it grows a stage a world day until it is
a bramble, a young tree, or a moonflower that lights itself after dark.

Plantings take the visitors' meshes, shader and lamp lighting but none of their
dice — they are where they were put and they never leave. Their meshes are
rebuilt only when something is planted or grows, not per frame, so a yard full
of trees costs nothing to keep standing. Routing them through the visitors
rather than the terrain is deliberate: props are baked into the terrain mesh at
`scatterProps`, and a 40ms rebuild is too much to spend on a seed going in.

A **stray** is the other kind: on the longest trip the pet can win over
something living — a rabbit, a butterfly, the fireflies — after which it turns
up whenever its season does instead of only sometimes. That is what befriending
it bought.

Both live on the save rather than on the pet, so they outlive the pet that
brought them home. Retiring ends a life, not a garden — and a yard that is
slowly filling with things a family walked out and found is the one part of the
world that is a record rather than a seed.

### Moving house

A family can move. Hold C on an adult's status screen — alongside hold B to
retire, because both are things you do a handful of times in a family's life and
neither should happen because a thumb rested on a button — and the move menu
offers everywhere it could live.

Five places to live: the **Meadow**, the **Woodland**, the **Beach**, the
**Hillside** and the **Village**.

Moving is not a repaint. **The grounds and the visitors come with the house**, so
where you live decides what the next stretch of play is made of: a different four
grounds turning up different curios, and a different cast out in the yard. A
biome that only changed the colours would be wallpaper, and you would pick one
once and forget it.

What tells the five apart on screen is mostly what stands up out of the ground —
trunks, cottages, outcrops, marram — and only secondarily the colours. That means
how much of the *shared* cover a place gets is part of its character too: a
village green has had the stones picked off it, a hilltop has less grass than a
meadow, and a beach has none at all. Left even, the shared stones and grass
outweigh everything distinctive and all five read as a recoloured meadow.

Four other levers do the rest of the work, and each of them exists because
colours and prop pools alone were not enough.

**How close the scatter stands.** Density is the chance a candidate slot is
taken; `propSpacing` is how far apart the slots are. At the shared three columns
a wood at full density is still a plantation with a clear metre between every
trunk, so the wood closes the grid to two and the hill and the village open it
to four. The wood's trees are also twice the height they were: from a camera at
the pet's eye level, height is the whole of a tree's read, and nothing tall is
allowed to stand between the camera and the pet — a fourteen-voxel pine two
lengths from the lens is a trunk filling a third of the frame.

**What a place wears, as against what it is made of.** A flat `materials`
override says sand is sand in April. It was also being used for leaf colour,
which is not a fact about a wood but about the month — so the wood stayed green
through October while the meadow beside it turned. Anything seasonal goes in
`seasonMaterials` instead, one set per season, blended across the turn exactly
as the season's own colours are: fresh green, deep green, gold, and bare.

**How the ground lies.** `Relief` pulls the noise toward a height ahead of the
pet and another behind it. A beach falls away in front into water and rises
behind into dunes; a wood only rises, which carries its trees up over the
shelter roof; a hilltop only falls, because a shoulder climbing behind the pet
would stand between it and the one thing a hill has to offer.

**What is in the sky.** The patch is fourteen lengths deep and hazed out before
its far edge, so nothing in the scene can say how far you can see from where you
are standing — which is exactly what a hilltop has to say. `Sky` gives a place
cloud and distant ridges on the backdrop, and a `horizon`: where this place's
skyline actually falls in the frame, since anything drawn below it is simply
behind the ground. It is authored per biome rather than derived because it
depends on the relief, on what is standing on it, and on where the place points
the camera.

The village's buildings are stone and seven columns across, which they can only
be because they bring their own footing. The rule that a stamp needs ground
level to within a voxel is right for a bush and fatal for a building; a prop
marked `foundation` digs its footprint flat instead, and the built things are
scattered in a first pass so they are not left picking through the holes between
a hundred and fifty tufts.

### The sea

The beach has water at the front of it — between the pet and the camera — and
where the water could go was decided by the haze rather than by taste.

The patch fades into the sky with depth so its edge is never a visible boundary:
by the far row the haze is already eight parts in ten. Water at the back of the
patch was therefore a band of horizon four pixels tall — and a swell four pixels
tall is a still picture. So the sea is in the foreground. Just past the lane the
pet walks, the ground falls away toward the camera — pulled toward one seabed
value rather than having depth subtracted from it, which damps the noise as it
descends and is what keeps the waterline a single line instead of a scatter of
sandbanks — and the water fills what it leaves, running off the bottom of the
frame. Dunes climb behind, so the picture reads bottom to top: water, the flat
the pet walks, sand, sky.

The water is one flat plane, two triangles, with everything that moves in the
fragment stage, and at two lengths from the lens there is enough of it on screen
for that to be worth doing. The swell travels. The crests take the sun in a line
of sparks written into the same bloom mask the lantern glass uses. The shallows
over the sand are a different colour from the water past them. And the surf runs
up the beach and slides back: the water is discarded above a line made of two
slow sines, which puts the wet sand the terrain already paints back on show as it
drains — the retreat is the half of the motion that reads, and it costs nothing.

Two details are load-bearing. The plane sits a sixth of a voxel above its
nominal level, because the seabed is voxels and a column that comes out exactly
`level` high has its top face in exactly the water's plane — which at twenty
metres is a field of tearing pixels rather than a shore. And the fall is
straight rather than eased at both ends: eased in, the band of sand standing one
voxel proud of the waterline came out half a length deep, which at this angle is
a white stripe ruled across the frame rather than a line of foam.

The one place it deliberately parts company with the land is the fade. The
terrain hazes all the way to the sky, because its edge is meant to disappear.
Water given the same treatment vanishes outright — almost everything you can see
of a sea is the far part, beyond where the sand stops, and hazed to sky that part
*is* sky. A real sea keeps most of its colour right up to the horizon and then
stops at a line. So the water settles toward a horizon tint rather than toward
the sky and never quite gets there, which is what puts a horizon in the frame at
all.

Wet sand and foam are two more materials rather than something painted into the
water, so the band follows every wander of the waterline instead of ruling a
straight line across it — and goes grey in winter like everything else. They are
read off the height, but only out on the shore: the clearing is levelled to
exactly the height a foam line wants, and by height alone the whole lane the pet
walks in came up white.

Nothing the pet touches is ever near it. The pet does not sample the ground as it
walks — it is placed at `groundY` wherever it goes — so a roaming band that dipped
to the waterline would have it standing in the sea and never knowing. The lane,
the verge, the lantern row and the shelter pad are all asserted dry across a
spread of seeds in `test/unit/shore.test.ts`, which is the part of the renderer
that is pure arithmetic and the part that can drown a pet.

**The garden stays, the friends follow.** Plantings belong to the ground they
were put in — moving leaves three generations of trees standing where they are,
and that is the price. Strays come along, even where they do not belong: a rabbit
out on a wood clearing is slightly wrong, entirely charming, and the only visible
proof the family used to live somewhere else. Gardens are keyed by place rather
than cleared, so going back finds the trees still there — and the terrain is
seeded from the pet **and** the place, so going back is going back to the same
patch of ground rather than to a new one that happens to share a name.

Three of the five yard games are already scarce by season. Gating them by place
as well would leave a player with a healthy adult and nothing to do, so a game
that wants a creature asks for a **role** and the biome says who fills it — a
moth in the wood where the meadow has a butterfly, glow-worms where it has
fireflies. Same game, same rhythm, different thing to look at. What the pet
plays with is a role too: the meadow's ball is a beach ball at the tideline, a
football on the green and a fallen cone in the wood, and FETCH asks for whatever
this place's toy happens to be. Only things somebody left out or built — the
sled, the pile of leaves, the snowman, the jack-o-lantern — belong nowhere in
particular and turn up everywhere. Journey narration is written per ground role for the same reason: a
new place costs four names and a curio table, not a fresh set of trip lines.

The rebuild is one very long frame — the whole 160×80 patch is re-meshed — so the
pet walks off and the screen settles for a couple of seconds while the new ground
is built behind it. A long frame in the middle of the yard reads as a fault; the
same frame behind a walk reads as a journey.

### Inheritance

What a life is worth to the one after it counts three things: how long the pet
was allowed to be grown up, how well it was kept, and how much of the collection
it helped fill. Every term is gated on having lived, so retiring a pet the
moment it comes of age still passes on almost nothing — but a life spent looking
is worth passing on.

A family leans the way its forebears did. Retired ancestors are weighed by what
their lives were worth, and if one temperament carries the weight it nudges the
matching reading when the next pet's branch is chosen — enough that raising a
family with an eye to what came before is a strategy, not enough to decide
anything on its own. A single half-lived ancestor is a coincidence rather than a
trait, and old saves with no temperaments recorded lean nowhere.

The nudge is applied where branches are chosen rather than inside `metrics`, so
what the status screen reports about a pet stays about that pet.

### Systems that touch each other

Depth came from making the levers depend on one another rather than adding more
of them. A tired or hungry pet is poor company: it gets half as much from a game
and tires half again as fast for it, so there is a right *time* to play and not
only a right amount. A hot dish is worth a third more in winter and a cold one
a third more in summer, so the same food is a different thing depending on the
day it is served.

Which dish is which is stated on the food rather than inferred. Reading it off
the energy a food happens to give made Fries summery and Cake warming, and
handed Medicine a seasonal bonus for being a meal it is not — it was healing
thirty percent better in July.

### Playing with what is out there

PLAY was the one lever that read nothing. Feeding swings with the season and
steers the diet axes, foraging reads the ground against the day, and playing was
the same three abstract games in July and January — while the yard it happened
in went unmentioned. Visitors were announced on the ticker and then were
scenery.

So the thing in the yard is the game. Five of them, each asking for something
the others do not:

| Game | Needs | Wants | Asks for |
| --- | --- | --- | --- |
| FETCH | the toy, whatever it is here | nothing in particular | effort — tap to wind up the kick, and it sags if you stop |
| CHASE | the butterfly | clear weather | prediction — it leans one way, and sometimes that lean is a lie |
| DIVE IN | the leaf pile | dry leaves | tracking — keep your eye on the deep drift while they swirl |
| THE HILL | the sled | snow | steering — down the hill, past what is in the way |
| CATCH THEM | the fireflies | a clear night | reaction — whichever lights, press its button |

That table is the feature. A game tied to what turned up today is only worth
having if it plays unlike the three that are always there, so no two of the
eight share a verb — and a test asserts it, by insisting no two games share a
hint line.

The row is built to the forage menu's shape — a name, a note, a read on today,
and what it costs — because that is already this game's way of saying *here is a
choice that depends on the day*. What a yard game must **not** do is restate its
visitor's season: whether the toy is out there already carries summer and
autumn, and saying it again would make the read a tautology that always looked
promising. A yard game reads the part presence leaves open — the weather, and
the hour. CATCH THEM needs no rule about darkness at all: the fireflies keep
their own hours, and a game is not offered for something that cannot be seen.
Which does mean the one way to catch them is to keep the pet up past its
bedtime, and the sleep metric will remember that you did.

**The read has to change something, or it is decoration.** A ground's prospect
scales the odds of finding anything; a yard game's scales what the game is
worth. On a good day it beats anything on the standing menu, on a fair day it
still edges it, and on a bad one it is worth less than staying in — for the same
energy. Chasing a butterfly through the rain is still chasing a butterfly; it is
just not much of an afternoon.

**The pet asks.** The yard already announces an arrival — *a ball has turned up
in the yard* — but that is the device reporting, it happens once, and it says
nothing about there being a game in it. So the pet mentions it too, in the first
person and in its own species' voice, alongside everything else it muses about:
*THE BALL! THE BALL IS OUT!* from a Blazeon, *THERE'S A BALL OUT THERE. NOT THAT
I CARE.* from a Grumphal, and a Lumenox asking you to stay up because the
fireflies are here. Without it the extra row on the PLAY menu is only ever found
by a player who thought to look at PLAY twice.

It is an invitation and not a nag. One line even when three things are out, for
the same reason only one arrival a day is announced. It stops the moment you
take the hint — starting a game counts, even one abandoned, because the pet
asked and you went out. It is never said about a game the PLAY icon would then
refuse, which is the one way the line could actively mislead; `PLAY_MIN_ENERGY`
is shared between the two rather than written twice, and a test insists no yard
game costs more than it. What it does *not* do is survive the session: the yard
is rolled fresh every world day, and a pet that mentioned the ball yesterday
should be free to mention it again today.

The three abstract games stay, as the tail of the menu. A day with nothing out
there is a quieter day, not a locked door. Only the selected row carries its
detail, the way the feed menu does, so the list grows by a line rather than a
block — it has to, because a summer night can put the ball, the butterfly and
the fireflies out at once, and six full-height rows would run off the bottom of
the screen.

A yard game also counts toward a **play axis** — `chase`, `romp` or `quiet` —
kept on the pet the way meals are kept against the diet axes. Only yard games
score there: the abstract three are the same game whatever the day, so they say
nothing about how a pet was raised beyond how often it was played with.

That axis is a **second route to a form**. The branch rules already scored
themselves against what a pet was fed; now they read what it was played with
too, and three forms have a way in through the yard that they did not have
before:

| Route | Opened by | Because |
| --- | --- | --- |
| Blobbit → Spikelet | `romp` | leaf piles and sledding make a rough child |
| Spikelet → Blazeon | `chase` | a pet raised chasing things becomes a competitor |
| Sproutling → Lumenox | `quiet` | the fireflies are the night game |

The last is the neatest of the three, because catching fireflies already costs
what a Lumenox is: nights the pet was kept up for.

Two properties keep this from being either a gimmick or a wrecking ball. It is
**a route rather than a tiebreaker** — a pet with the same diet and the same
amount of play still branches differently for what the play *was*. And it is
**worth less than how the pet was actually kept** — a wholly neglected pet does
not become a Blazeon on the strength of a ball. Both are asserted rather than
asserted-about.

The reading is damped by how many yard games there were, because a share on its
own cannot tell one afternoon from a habit: a single game chasing a butterfly
would otherwise read as a pet wholly given over to it. Four is the point at
which it counts in full — lower than the diet's six, since a meal is always
available and a yard game needs something to have turned up. The upshot is the
property that made this safe to add at all: **a pet that has never played
outside scores zero on every axis**, so every rule reads exactly what it read
before.

`PLAY CHASE` sits beside `DIET PROTEIN` on the status screen, and the BECOMING
line underneath already accounts for it — so a habit forming in the yard is
visible while it can still be steered, which is the same promise the diet makes.

Making any of this possible meant moving one thing. Who is in the yard today was
settled inside the renderer, so the game could not know what was out there — and
a yard the game cannot see is a yard it cannot offer you anything to do with.
The roll is game state that the renderer happens to draw, so it lives in
`src/game/visitors.ts` now and the renderer asks. Both sides call the same
function rather than keeping a copy each, because two rolls that drifted apart
would put a game on the menu for a visitor nobody could see.

Every game has to be able to end on its own. A game owns all three buttons while
it runs, so one that waits for a press that never comes is a pet that can no
longer be fed — DIVE IN shipped that way for an afternoon and the test for it
caught it. A firefly left to fade is a miss, an unanswered leaf pile is a miss,
and every round has a beat it resolves on whether or not anybody is watching.

### Visitors

Some days there is something in the yard: a ball to knock about, a rabbit
grazing on the verge, a snowman somebody built, wildflowers, a jack-o-lantern
by the door, a butterfly, a pile of leaves, a sled. Each belongs to one or two
seasons and turns up on a given world day only if the dice say so, rolled from
the day number so it is settled for the day rather than flickering. Arrivals are
announced on the ticker, which is the only reason a small thing on the far verge
gets noticed at all.

Each arrival is written out in full — *the leaves have blown into a pile*,
*somebody has built a snowman* — rather than dropped into a shared sentence
frame. One frame made every arrival read as the same message however many
different things turned up, and it could not be made to agree with a plural
name: *wildflowers is in the yard*. Only one arrival is announced per day, too,
because a season turning brings several at once and a run of them buried
everything else the ticker had to say.

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

Every one of those effects has to be measured in the picture's own pixels rather
than the display's. The dither was keyed on the fragment coordinate, so its
four-by-four matrix cycled several times inside each source pixel — nearly five
display pixels across — and beat against it. Against ordinary scenery that
passed for texture; against something flat and bright, like an eye, it read as
moire.

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

**A new place to live.** Add a `Biome` to `src/data/biome.ts`: a name, a line for
the move menu, a scatter density, a prop pool, its four grounds, and who fills
each `VisitorRole` — including `toy`, the thing it leaves lying about for the pet
to shove. Optionally a `materials` override — a handful of colours painted over
the season's palette rather than a palette of its own, since five places times
four seasons would be twenty palettes to keep in step, and a wood should still
look wintry in winter — plus `seasonMaterials` for anything that changes with the
month, `propSpacing` for how close the scatter stands, `relief` for ground that
falls away or climbs, `sky` for cloud and distant ridges, and `extras` for local
colour no game asks for. Nothing is rebuilt for a tint: terrain and props store a
material index and the colour behind it is uploaded every frame anyway. The patch's dimensions, the lantern row and the verge pitches stay shared
constants — `LAMP_COUNT` in particular is baked into three shaders at module
load, so it has to stay fixed. Add the id to `BiomeId`, bump `SAVE_VERSION` only
if the shape of the save changes, and give the biome four grounds in
`src/data/grounds.ts` with one of each `GroundRole`.

**Terrain and scenery.** `src/render/terrain.ts` turns a biome into geometry.
`src/data/props.ts` holds the props themselves as small voxel models with a
placeholder palette — `s`/`t` for stone, `f`/`e` for foliage, `w` for stems, `p`
for flowers, `r`/`n` for roof and interior — resolved against the materials at
build time, so one prop set can dress several biomes. Ground cover is shared and
the tall things are not, which is most of why two places read as different from
the same generator. Give each a `weight` for how often it appears and a `spacing`
for how much room it needs, and mark anything built rather than grown with
`foundation` so it digs its own footing instead of being refused every slot that
is not already flat.

**A new food.** Add it to `src/data/foods.ts` with a `DietAxis` and stat deltas.
Anything with an axis shows up on the feed menu and counts toward branching;
`axis: null` is medicine.

**A new yard game.** Add a row to `src/data/yardgames.ts` naming the visitor it
needs, the stage it wants and what it costs, and a `Minigame` under the same id
in `YARD_SESSIONS`. Give it a `weather` only if it genuinely minds — its
visitor's seasons are already doing that work. Costs must stay under fifteen,
which is what the PLAY icon insists a pet has before it will open the menu at
all. Use `scoreboard`, `settle` and `betweenRounds` for the five-rounds-win-three
bookkeeping rather than writing it out again, make sure every round can resolve
without a press, and give it a verb none of the other seven has — the data tests
check the last of those by comparing hint lines.

**A new minigame.** Implement `Minigame` in `src/game/minigames.ts`. It gets the
three buttons and draws itself onto the same low-res HUD canvas.

**Balance.** Every tuning number lives in `src/game/tuning.ts`. `TIME_SCALE`
fast-forwards the whole simulation for playtesting.

## Tests

```bash
npm test              # the whole suite, about three seconds
npm run test:watch
npm run test:coverage # the same, with a coverage report
npm run verify        # typecheck, suite and coverage threshold -- run before pushing
```

`npm run build` typechecks and emits `dist/`. It deliberately does not run the
suite: a deploy is not the place to find out, and the three seconds it saves are
three seconds off every deploy for a check that has already been made. The
typecheck stays, because `vite build` does none of its own -- esbuild strips the
types without reading them, so a type error would ship in silence.

That trade is only worth what `npm run verify` is worth, which is the whole of
the gate in one command: typecheck, suite, and the 100% threshold below.

**The gate is run for you, on the way out.** `.githooks/pre-push` runs
`npm run verify` before anything leaves the machine, and refuses the push if it
fails. A push is the last moment the check is still cheap to act on: after it,
the thing that finds out is somebody else's clone.

The hook is committed rather than left in `.git/hooks`, where it would live in
one clone and nowhere else. `npm install` points git at it -- that is the whole
of the `prepare` script -- so a fresh checkout is covered by the install it
needs anyway. To wire it up by hand, or to check it is on:

```bash
git config core.hooksPath .githooks
```

It skips a push that only deletes branches, since there is no code in one.
`git push --no-verify` skips it altogether, which is the right move for a
work-in-progress branch nobody is deploying and the wrong one for `main`.

The typecheck covers `test` as well as `src`. It did not always: adding a
required field to `Metrics` should have been a compile error in the three test
files that build one by hand, and instead it was fourteen runtime failures with
`Cannot read properties of undefined`. A fixture that has drifted from the type
it claims to be is exactly the thing a typechecker is for.

The game is for children, so the failures that matter are not crashes but the
quiet ones: a lost pet, a button that stops working, a screen with no way off
it. Those take hours to reach by hand and seconds to reach in a harness, so
almost everything is tested through one.

**The seams.** Three things the game cannot be tested around are behind
swappable implementations: `engine/random.ts` (every die the game rolls),
`engine/clock.ts` (the wall clock) and the storage backend in `game/save.ts`. In
play they are `Math.random`, `Date.now` and `localStorage`; under test they are
a seeded generator, a clock wound by hand, and a plain object. Nothing else in
`src/game` or `src/data` reaches for a global.

**The harness** (`test/harness.ts`) is the whole game with the shell taken off.
`App` already talks to the renderer through five callbacks and reads back two
flags, so the harness drives that same interface: real button presses, real
frames, a real save file, and no canvas anywhere. A pet's entire life runs in a
few milliseconds, which is what makes it affordable to test the situations that
actually worry a player rather than fragments of them — a weekend away, a night
skipped, a game quit halfway, four thousand presses in a row.

```ts
const h = harness().start().growTo('adult')   // hatched, raised, grown up
h.select('forage').tap('b')                    // sent out over the hill
h.until('the prompt', () => h.app.forageChoosing)
h.tap('b')                                     // pushed on one more leg
```

**What is covered.** `src/game`, `src/data` and the two engine seams are at 100%
of statements, branches, functions and lines, enforced as a threshold rather
than reported. `src/render` and `main.ts` are excluded: they are WebGL, canvas
and DOM wiring, and a faked GL context would prove nothing about a shader while
making the number a lie. The pure helpers that live among them are tested
directly. Browser end-to-end tests are deliberately not here yet.

**The soak** (`test/property/soak.test.ts`) covers the runs nobody would think
to write down. `fast-check` generates sequences of presses, holds, absences and
icon selections, and after every one it asks the same short list of questions:
stats inside their bounds, no number gone to NaN, a stage that never walks
backwards within a life, a menu cursor still inside its list, a way back to the
main screen from wherever the run ended, and a save file that reads back the
same twice.

It draws the screen too, which is not the same question and was added because
of the one bug in this list the rest of it could not have found. Pressing B on
the move menu set a refusal, played the refusing blip and drew nothing, because
the line was only ever drawn on the main screen; every state assertion passed
and the player saw a dead button. So each step now also asks the screen two
things: that it can be drawn at all -- a state random play can reach is a state
somebody can be sat in front of, and a throw here is a black screen there -- and
that anything the game has said is on it. Four per cent slower, and it catches
that bug two presses from boot. When one fails, fast-check shrinks the run to the few presses that
actually matter and prints a seed to reproduce it — which is the point, because
a failure forty presses deep is not a bug report until it is three presses deep.
A second property does the same to the save file itself, generating right-shaped
saves full of wrong values and asking only that the game boots into something
playable.

The dice are pinned like every other die in this suite. Left to itself
fast-check seeds from the wall clock, which would mean a failure nobody else
could reproduce and a coverage number that moved on every run -- so the seed is
a constant, and a different sweep is a different seed said out loud. The cost of
that is real: a pinned seed explores the same runs every time, and the third bug
the soak found was one the default seed does not reach at any depth. So both
knobs matter, and the sweep worth doing before a release turns them together:

```bash
SOAK_RUNS=40000 SOAK_SEED=$RANDOM npm test   # about a minute
```

Forty thousand rather than a few: eight thousand was the first recommendation
here and it was too modest to be worth typing. Five sweeps at that depth came
back clean, and the next two at forty thousand each found a bug -- one at
seventeen thousand runs in, one at three and a half. A sweep that only ever
passes is not a sweep, it is a slower version of the suite.

The default hundred runs take about a tenth of a second and go in the suite.
What a sweep finds belongs in `unit/` or `integration/` afterwards, as a test
with a name: the soak is for discovering the case, not for documenting it.

Getting to 100% turned up two real bugs and a pile of defensive code that could
not fire. The care streak compared elapsed milliseconds against local midnight,
so anyone who played after about noon read as two days since yesterday and lost
the streak they were building; it counts whole local days now. A save that was
the right version but the wrong shape — truncated, hand-edited, written by a
build since rolled back — went through migration untouched and crashed on the
first frame that read the missing field; `load` now repairs one field by field,
so the worst case is a lost setting rather than a lost pet.

## Layout

```
public/     manifest, service worker, generated icons -- copied to dist as-is
src/
  data/       voxel models, species graph, foods, pixel font, menu icons
  game/       simulation, save/migration, actions, branching metrics, minigames
  render/     ogl scene, voxel mesh builder, shell geometry, bloom, HUD canvas
  engine/     input hit-testing, WebAudio beeper, the clock and dice seams
  ui/         screen drawing
  howto/      the instructions booklet: voxel sprites, screen shots, the map
test/
  harness.ts  the game driven by button presses, with no renderer
  unit/       one module at a time
  integration/ whole flows: a life, a day's care, a forage, getting around
  property/   the soak: random presses against invariants, shrunk when they fail
tools/
  make-icons.mjs  draws the app icons, the way everything else here is drawn
.githooks/
  pre-push        runs the gate before anything leaves the machine
```

In dev builds `window.__pet` exposes `{ app, hud, shell, step, advance }` so the
game can be driven frame by frame from the console.

## Installing it

The site is a PWA: `public/manifest.webmanifest` names it and points at the
icons, and `public/sw.js` keeps a copy of the two pages and their assets so the
pet opens without a network. Together they are what makes a browser offer to
install it; once installed it runs full-screen with no chrome, which is what
a thing pretending to be a handheld wants.

The worker is registered only in production builds (`src/pwa.ts`) -- in dev it
would sit in front of Vite's module graph and serve you yesterday's code. It
serves pages network-first, so a deploy is picked up on the next launch, and
assets cache-first, since the build content-hashes their names. **Bump `CACHE`
in `public/sw.js` when you ship**; older caches are dropped on activation.

The icons are not drawn by hand either:

```bash
node tools/make-icons.mjs
```

writes `public/icons/` from a 32x32 grid in the script -- the shell, its screen
and a pet in it -- at the sizes the manifest, iOS and maskable masks ask for.
The PNGs are committed, so this only needs rerunning when the picture changes.
