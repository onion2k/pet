import './style.css'

import { registerServiceWorker } from '../pwa'

import { CURIOS, CURIO_COUNT, CURIO_SETS, TRADE_COST } from '../data/curios'
import { KIT, KIT_COUNT } from '../data/kit'
import { FOODS } from '../data/foods'
import { MEADOW_GROUNDS } from '../data/grounds'
import { ICON_LABEL, ICON_ORDER, iconRows, type IconId } from '../data/icons'
import { MINIGAMES } from '../game/minigames'
import { SPECIES_COUNT, SPECIES_LIST, speciesOf, type Species } from '../data/species'
import { SHELLS } from '../data/shells'
import { TEMPERAMENTS, type TemperamentId } from '../game/temperament'
import { VISITORS } from '../data/visitors'
import { PLANTS } from '../data/plants'
import type { PetState } from '../game/types'
import { artTile, gameScreen, iconTile, pixelWord } from './screens'
import { creatureSprite } from './voxel-sprite'
import { meadowMap } from './map'

/**
 * The instructions booklet.
 *
 * Almost nothing here is written twice: the creatures are drawn from their own
 * voxel models, the games draw their own screens, and the tables of food,
 * grounds, curios and forms are read out of the same data the game plays from.
 * What is written by hand is the prose -- what a thing is for, and what to do
 * about it -- which is the part the game cannot tell you itself.
 *
 * What is deliberately left out: the dice. Which curio wants which weather, how
 * far out the rare things live, what the odds are of coming home muddy. Those
 * are the game's to reveal, and a booklet that printed them would hand the
 * player the answers to the only questions worth having.
 */

const book = document.getElementById('book')!

/** Builds an element from markup, which is how every block below is written. */
function html<T extends HTMLElement>(markup: string): T {
  const holder = document.createElement('div')
  holder.innerHTML = markup.trim()
  return holder.firstElementChild as T
}

let sectionNumber = 0
const contents: { id: string; title: string }[] = []

/** One numbered chapter, added to the running table of contents. */
function chapter(id: string, title: string, lede: string, body: string): HTMLElement {
  sectionNumber++
  contents.push({ id, title })
  const node = html(`
    <section id="${id}">
      <h2><span class="num">${sectionNumber}</span>${title}</h2>
      <p class="lede">${lede}</p>
      ${body}
    </section>`)
  book.append(node)
  return node
}

/** Drops a canvas into the placeholder that was left for it. */
function fill(root: ParentNode, selector: string, node: Node): void {
  root.querySelector(selector)?.append(node)
}

// --- cover -----------------------------------------------------------------

const hero = html(`
  <div class="hero" id="top">
    <p class="sub">The illustrated booklet</p>
    <div class="title"></div>
    <p>
      A creature lives in a plastic shell with three rubber buttons. It gets
      hungry, it gets tired, it grows up into something you cannot quite
      predict, and it walks off over the hill to bring things home. This is
      everything the device never got round to explaining.
    </p>
  </div>`)
book.append(hero)
fill(hero, '.title', pixelWord('HOW TO PLAY', '#3f3357', 1, 7))

const nav = html('<nav class="contents"></nav>')
book.append(nav)

// --- 1. the device ---------------------------------------------------------

chapter(
  'device',
  'The device',
  'Three buttons, and nothing else. They are moulded A, B and C into the shell, so a hint on the screen means the same thing whether you are tapping or typing.',
  `
  <table>
    <thead><tr><th>Button</th><th>Keyboard</th><th>What it does</th></tr></thead>
    <tbody>
      <tr><td><span class="key">A</span></td><td><span class="key">A</span> <span class="key">&larr;</span></td><td>Previous icon, or the item above on a menu.</td></tr>
      <tr><td><span class="key">B</span></td><td><span class="key">B</span> <span class="key">Enter</span> <span class="key">Space</span></td><td>Select, confirm, act. The button that does things.</td></tr>
      <tr><td><span class="key">C</span></td><td><span class="key">C</span> <span class="key">&rarr;</span> <span class="key">Esc</span></td><td>Next icon, or back out of a screen.</td></tr>
    </tbody>
  </table>

  <div class="callout">
    <b>Hold C to leave.</b> During a game every button is spoken for, so backing
    out is a press held down rather than a spare button — a little bar fills
    while you hold it. Leaving a game before a single round has been decided
    costs nothing. Leaving after that counts as a loss, so a game that is going
    badly cannot be quietly dropped.
  </div>

  <h3>Turning it over</h3>
  <p>
    Drag anywhere that is not a button and the whole device turns in your hands,
    carrying a little momentum. Double-click, or press <b>RECENTRE</b> at the
    bottom of the page, to put it straight again. It is worth doing once: the
    lights are fixed where you are sitting, so the shine travels across the
    plastic as it turns.
  </p>

  <h3>The controls under the screen</h3>
  <div class="grid">
    <div class="card tint-sun"><b>SOUND</b><p class="note">Turns the beeper on and off. Remembered between visits.</p></div>
    <div class="card tint-berry"><b>SHELL</b><p class="note">Cycles the colours your family has earned. There is one to start with; the rest are unlocked by what you do.</p></div>
    <div class="card tint-cool"><b>RECENTRE</b><p class="note">Appears once you have turned the device. Puts it back.</p></div>
    <div class="card tint-grass"><b>NEW PET</b><p class="note">The hard reset. It erases the pet <em>and</em> the whole family — album, curios, streak and all. To pass the torch instead, retire a grown pet from its status screen.</p></div>
  </div>`,
)

// --- 2. the screen ---------------------------------------------------------

/** What each icon in the ring is for. The labels come from the game. */
const ICON_NOTES: Record<IconId, string> = {
  feed: 'Opens the menu of food. A meal fills your pet up, and quietly counts toward what it grows into.',
  play: 'Opens the three games. Winning cheers your pet up; playing at a bad moment does very little.',
  clean: 'A wash, on the spot. No menu — one press and your pet is clean again.',
  forage: 'Sends your pet out over the hill to look for things. Only once it has grown up a bit.',
  medicine: 'A dose, for when your pet is poorly. It works, and your pet will not thank you for it.',
  sleep: 'Puts your pet to bed, or wakes it up. Bedtime winds the night past to sunrise.',
  status: 'Everything about your pet on one page — and the door to the collection board.',
}

const screenSection = chapter(
  'screen',
  'The screen',
  'Seven icons ring the glass. A is the one before, C is the one after, B is the one you mean. An icon blinks red when the thing it looks after is in trouble.',
  `
  <div class="icon-row">
    ${ICON_ORDER.map(
      (id) => `
      <div class="icon-card" data-icon="${id}">
        <div class="plate"></div>
        <div><b>${ICON_LABEL[id]}</b><span>${ICON_NOTES[id]}</span></div>
      </div>`,
    ).join('')}
  </div>

  <h3>The ticker</h3>
  <p>
    A line of news crawls along the bottom of the screen: the weather, a season
    on its way, what your family is still missing, and anything that has just
    happened — an evolution, a find, a visitor in the yard. It is also where
    your pet talks. It welcomes you back, and more warmly the longer you were
    gone; it thanks you for meals and baths; it says goodnight on its way to
    bed; and it mutters to itself when it thinks nothing much is going on.
  </p>

  <h3>Bubbles</h3>
  <p>
    Above your pet, now and then, a bubble: a thought with little puffs behind
    it, or speech with a tail. The bubble is what your pet says — <b>FEED ME</b>,
    <b>SO TIRED</b>, <b>LA LA LA</b> — and the ticker says the same thing in the
    game's words at the same moment, so the two arrive together. Needs come
    round often enough to act on. Idle thoughts are rare on purpose: they are
    meant to be a small surprise, not wallpaper.
  </p>

  <h3>The status page</h3>
  <p>
    Press <b>B</b> on <span class="tag">STATUS</span> for your pet's name, form
    and age, its five bars, the world's clock, the season and the weather, the
    diet it is leaning toward, and your visiting streak. Below that is the one
    line worth watching: <b>BECOMING</b>, and a few words about the direction
    your pet is currently heading in. It never says what it will turn into. It
    says what it is being raised like, while there is still time to change your
    mind. Once your pet is grown, that line becomes its character instead.
  </p>
  <p class="note">
    From the status page, <b>A</b> opens the collection board. On a grown pet,
    <b>holding B</b> retires it — see the last chapter before you do.
  </p>`,
)

for (const id of ICON_ORDER) {
  fill(screenSection, `[data-icon="${id}"] .plate`, iconTile(id, '#ffd93d', 6))
}

// --- 3. care ---------------------------------------------------------------

chapter(
  'care',
  'Looking after it',
  'Five bars, and they run down whether the page is open or not. Your pet lives its life while you are away.',
  `
  <div class="grid">
    <div class="card tint-berry"><b>FULL</b><p class="note">Empties fastest of the lot. Feed it. What you feed it matters more than you would think.</p></div>
    <div class="card tint-sun"><b>HAPPY</b><p class="note">Kept up by games, treats, a clean coat and a good night. A sad pet stands with its head down; you can see it from across the yard.</p></div>
    <div class="card tint-cool"><b>ENERGY</b><p class="note">Spent by being awake, by playing and by walking out to forage. Sleep is the only thing that gives it back.</p></div>
    <div class="card tint-grass"><b>CLEAN</b><p class="note">One press of <span class="tag">CLEAN</span>. Grubbiness drags on health if it is left.</p></div>
    <div class="card tint-berry"><b>HEALTH</b><p class="note">Climbs on its own while everything else is comfortable, and erodes while anything is not. Low enough and your pet is visibly poorly.</p></div>
  </div>

  <div class="callout">
    <b>Your pet cannot die.</b> Health has a floor it will not go below. A
    neglected pet gets sick, sad, grubby and stops growing into anything good —
    but it is always still there, and a meal, a bath and a dose put it right.
  </div>

  <h3>When it is poorly</h3>
  <p>
    A sick pet looks it, says <b>OW</b>, and the <span class="tag">MEDS</span>
    icon blinks. Medicine restores a good chunk of health and costs a little
    happiness, which is about right for medicine. Illness is remembered: it
    counts against how well your pet was kept.
  </p>

  <h3>Sleep, and what bedtime is worth</h3>
  <p>
    Press <span class="tag">SLEEP</span> and your pet walks itself into the
    shelter, settles just inside the open front, and curls up. Then the world's
    clock runs forward to sunrise, however far off that is — so a sleep is worth
    whatever the hour makes it.
  </p>
  <ul class="plain">
    <li><b>Bedded down at dusk</b> — most of a night. Your pet wakes rested, cheerful and hungry for breakfast.</li>
    <li><b>Bedded down at noon</b> — it sleeps most of a day and wakes ravenous.</li>
    <li><b>Bedded down just before dawn</b> — barely any sleep at all, and it is up again almost at once.</li>
  </ul>
  <p>
    A sleeping pet barely burns anything, and its spirits climb while it dreams.
    It wakes on its own once it is rested and the sun is up, so a nap never ends
    in the small hours — and a pet left asleep while you are away wakes at the
    dawn it would have woken at, rather than sleeping through the whole absence.
    Whether bedtimes land while the sun is actually down is one of the four
    things your pet is quietly being judged on.
  </p>

  <h3>Going away</h3>
  <p>
    The first few hours of an absence run at the usual rate: your pet is simply
    carrying on without you. After that it paces itself, and there is a floor
    under how far anything can fall while you are gone. Come back after a night
    and it is hungry. Come back after a weekend and it is hungry, filthy and
    unwell — and a meal, a bath and a dose still put it right. Those slow hours
    are left out of how your pet is judged, so a weekend off tells on its
    condition without being held against how it was raised.
  </p>
  <p class="note">
    Come back after a long enough gap and you get a welcome screen with what
    happened while you were out — and, once in a while, something your pet found
    on its own to make up for it.
  </p>`,
)

// --- 4. food ---------------------------------------------------------------

const AXIS_LABEL: Record<string, string> = {
  sweet: 'Sweet',
  protein: 'Protein',
  veg: 'Greens',
  junk: 'Junk',
}

const bought = FOODS.filter((f) => f.axis && !f.gathered)
const gathered = FOODS.filter((f) => f.gathered)

chapter(
  'food',
  'Feeding',
  'Press B on FEED for the menu; A and C walk it, B serves. Every meal fills your pet up — and every meal is a vote for what it becomes.',
  `
  <h3>On the menu</h3>
  <div class="grid">
    ${bought
      .map(
        (f) => `
      <div class="card">
        <b><span class="swatch" style="background:${f.color}"></span>${f.name}</b>
        <p class="note">${f.note}${f.served ? ` Served ${f.served}.` : ''}</p>
        <span class="tag">${AXIS_LABEL[f.axis!]}</span>
      </div>`,
      )
      .join('')}
  </div>

  <h3>Brought home</h3>
  <p>
    A grown pet feeds itself. What it carries back from a forage appears on the
    same menu with a count beside it, costs nothing, counts toward its diet like
    any other meal, and disappears from the menu when it runs out.
  </p>
  <div class="grid">
    ${gathered
      .map(
        (f) => `
      <div class="card tint-grass">
        <b><span class="swatch" style="background:${f.color}"></span>${f.name}</b>
        <p class="note">${f.note}</p>
        <span class="tag">${AXIS_LABEL[f.axis!]}</span>
      </div>`,
      )
      .join('')}
  </div>

  <div class="callout">
    <b>The same dish is worth different things on different days.</b> A hot meal
    goes further in winter and a cold one in summer. Whether a dish is hot or
    cold is decided by what it is, not by what it does — so a plate of fries is
    a hot dinner whatever the season thinks of it.
  </div>

  <p class="note">
    Medicine is on the same menu and is not a meal: it counts toward nothing,
    and feeding it to a healthy pet only makes it cross.
  </p>`,
)

// --- 5. the games ----------------------------------------------------------

const GAME_NOTES: Record<string, string> = {
  guess:
    'Left or right, five times. Call it with <b>A</b> or <b>C</b> and the arrow shows which way it actually went. Pure luck, and still the one that feels most like the real thing.',
  rhythm:
    'A marker sweeps the track; a coloured zone is where you want it. <b>B</b> stops it. The zone narrows and the marker speeds up with every round, so the last one is genuinely hard.',
  memory:
    'The three buttons light in order. Watch, then repeat it with <b>A</b>, <b>B</b> and <b>C</b>. A hit makes the sequence one longer; a miss starts the sequence again from one.',
}

const gamesSection = chapter(
  'games',
  'The games',
  'Press B on PLAY to choose. Every game is five rounds and you need three of them. Win and your pet is delighted; lose and it is only a bit disappointed.',
  MINIGAMES.map(
    (game) => `
    <div class="game" data-game="${game.id}" style="margin-bottom:26px">
      <div class="shot"></div>
      <div class="card">
        <b style="font-size:20px">${game.title}</b>
        <p>${GAME_NOTES[game.id] ?? ''}</p>
        <p class="note">The screen says <b>${game.hint}</b> &nbsp;·&nbsp; five rounds, three to win.</p>
      </div>
    </div>`,
  ).join('') +
    `
  <div class="callout">
    <b>There is a right time to play.</b> A tired or hungry pet is poor company:
    it gets much less out of a game and tires faster for it. Feed it first, and
    a win is worth twice as much.
  </div>
  <p class="note">
    Games are remembered — how many you played, how many you won and your best
    run of rounds. That record is one of the four things that decides what your
    pet grows into, and a pet played with constantly turns out quite different
    from one left to its own devices.
  </p>`,
)

for (const game of MINIGAMES) {
  fill(gamesSection, `[data-game="${game.id}"] .shot`, gameScreen(game.id, 2))
}

// --- 6. growing up ---------------------------------------------------------

/** A creature's card: its own model, its name, and what the game says about it. */
function creatureCard(species: Species, because?: string, extra = ''): string {
  return `
    <div class="creature" data-creature="${species.id}">
      <div class="pic"></div>
      <b>${species.name}</b>
      <div class="stage">${species.stage}</div>
      <div class="blurb">${species.blurb}</div>
      ${because ? `<div class="because">${because}</div>` : ''}
      ${extra}
    </div>`
}

const blob = speciesOf('blob')
const children = blob.branches.map((b) => ({ species: speciesOf(b.to), because: b.because }))
/** Aurorix hangs off every child, so it is shown once on its own rather than three times. */
const AURORA = 'aurora'
const auroraBecause =
  children[0]!.species.branches.find((b) => b.to === AURORA)?.because ?? 'devotion through the long winter'

/** Which temperament opens each elder, asked of the branch rather than looked up. */
const elderBranches = speciesOf('mochi').branches.map((branch) => {
  const needs = (Object.keys(TEMPERAMENTS) as TemperamentId[]).find((id) =>
    branch.available?.({ temperament: id } as PetState),
  )
  return { species: speciesOf(branch.to), because: branch.because, needs }
})

const treeSection = chapter(
  'growing',
  'Growing up',
  `The album has room for ${SPECIES_COUNT} forms. Your pet hatches, becomes a Blobbit, and from there every step is earned rather than given.`,
  `
  <p>
    When a stage has run its course, the game looks at four things — how well
    your pet was <b>cared for</b>, what it has been <b>fed</b>, how much you
    have <b>played</b> with it, and whether its <b>bedtimes</b> landed while the
    sun was down — and picks the branch it has earned. The line under each
    creature below is the reason the game itself gives when it happens.
  </p>

  <div class="tree">
    <div class="single">${creatureCard(speciesOf('egg'))}</div>
    <div class="arrow">&#9660;</div>
    <div class="single">${creatureCard(blob)}</div>
    <div class="arrow">&#9660;</div>
  </div>

  <div class="grid" style="align-items:start">
    ${children
      .map(({ species, because }) => {
        const adults = species.branches.filter((b) => b.to !== AURORA)
        return `
        <div class="branch">
          ${creatureCard(species, because)}
          <div class="arrow">&#9660;</div>
          <div class="pair">
            ${adults.map((b) => creatureCard(speciesOf(b.to), b.because)).join('')}
          </div>
        </div>`
      })
      .join('')}
  </div>

  <h3>The one that only winter brings</h3>
  <div class="grid" style="align-items:center">
    ${creatureCard(speciesOf(AURORA), auroraBecause)}
    <div class="card tint-cool">
      <p>
        Whichever of the three your pet is, it has one more way to go. A
        well-kept pet that comes of age <b>while the world is in winter</b>
        becomes Aurorix instead. The world's year turns about every hour, so
        this is a matter of watching the sky and timing a childhood — which is
        exactly why it is the rarest thing in the album.
      </p>
    </div>
  </div>

  <h3>Character, and what comes after adulthood</h3>
  <p>
    Growing up settles your pet's <b>temperament</b> from the same four
    readings, and it keeps it for life. A lively pet burns through its spirits
    and its energy and gets more out of a game. A restful one holds both and
    keeps its own hours. A devoted one frets when it is left alone but stays
    clean. Two pets of the same form, raised differently, are no longer the same
    pet.
  </p>
  <div class="grid">
    ${Object.values(TEMPERAMENTS)
      .map(
        (t) => `<div class="card tint-sun"><b>${t.name}</b><p class="note">${t.blurb}</p></div>`,
      )
      .join('')}
  </div>
  <p>
    Keep a grown pet for a good long while — hours, not minutes — and its
    temperament decides whether there is one last form waiting for it. An
    easygoing pet, having settled on nothing in particular, stays exactly as it
    is. This is the one thing in the game that retiring and starting again
    cannot get you.
  </p>
  <div class="grid">
    ${elderBranches
      .map(({ species, because, needs }) =>
        creatureCard(
          species,
          because,
          `<p class="note" style="margin:8px 0 0">Needs a <b>${needs ? TEMPERAMENTS[needs].name.toLowerCase() : ''}</b> pet.</p>`,
        ),
      )
      .join('')}
  </div>`,
)

for (const species of SPECIES_LIST) {
  const slot = treeSection.querySelector(`[data-creature="${species.id}"] .pic`)
  if (slot) slot.append(creatureSprite(species.model, { unit: species.stage === 'egg' ? 8 : 7 }))
}

// --- 7. foraging -----------------------------------------------------------

chapter(
  'forage',
  'Sending it out',
  'The one job the game asks of your pet, and the main way the collection gets filled. It walks out over the hill on its own and comes back with something to say for itself.',
  `
  <h3>Where to send it</h3>
  <p>
    <span class="tag">FORAGE</span> opens a list of grounds. A is up, C is down,
    B sends it. The near ground opens as soon as your pet is a child; the rest
    are an adult's, so the job grows with your pet rather than arriving all at
    once.
  </p>
  <p class="note">
    These are the meadow's four. Move house and the names change — a coppice for
    a wall, a tideline for a creek — but the four jobs, and what they cost, do
    not. What differs is what they turn up.
  </p>
  <table>
    <thead><tr><th>Ground</th><th>Who can go</th><th>Costs</th><th>What the menu says</th></tr></thead>
    <tbody>
      ${MEADOW_GROUNDS.map(
        (g) => `
        <tr>
          <td><b>${g.name}</b></td>
          <td>${g.from === 'child' ? 'A child, or an adult' : 'An adult'}</td>
          <td>${g.energy} energy</td>
          <td class="note">${g.note}</td>
        </tr>`,
      ).join('')}
    </tbody>
  </table>

  <div class="callout">
    <b>Read the line under each ground.</b> Every one carries a verdict on today
    — <b>LOOKS PROMISING</b>, <b>WORTH A TRY</b>, <b>NOT TODAY</b> — worked out
    from what that ground wants against the season and weather you can see out
    of the window. A ground that wants nothing in particular is always fair,
    which makes the near one the sensible choice on a day when nothing else
    looks good. Knowing the year is the thing you are actually spending here.
  </div>

  <h3>The trip</h3>
  <p>
    Your pet trots off, the picture fades, and the walk is told a beat at a time
    — setting out, the middle of it, the way home, and what it came back with.
    What it says is drawn from where it went, the season, the weather, whether
    it is dark, and the sort of creature it is: a Grumphal sighs at the state of
    the path where a Wardenor checks the boundary as it goes.
  </p>

  <h3>Pushing on</h3>
  <p>
    Halfway through, the trip asks: <b>B GO ON</b> or <b>C HOME</b>, with a bar
    counting down. Doing nothing brings it home, so looking away is never
    punished. Each extra leg costs more energy, makes a find likelier, and
    raises the chance of a mishap — home caked in mud, limping and footsore,
    late and empty, or simply caught out and looking it. There is a limit to how
    far it will go, and going that far is the only way to reach the rarest
    things.
  </p>
  <p class="note">
    A mishap that does not spoil the find is announced alongside it, because the
    whole point of pushing on is coming home muddy and pleased with yourself.
  </p>

  <h3>What comes back</h3>
  <div class="grid">
    <div class="card tint-berry"><b>Curios</b><p class="note">Small treasures for the collection board. See the next chapter.</p></div>
    <div class="card tint-grass"><b>Food</b><p class="note">Picked up on the way rather than looked for, so it rides along with whatever the trip was about — including a bad one. Free, and it goes straight onto the feed menu.</p></div>
    <div class="card tint-sun"><b>Kindling</b><p class="note">Spent automatically when your pet turns in. A night by a banked fire costs it far less than an ordinary one, so it wakes up in better shape.</p></div>
    <div class="card tint-cool"><b>Seeds and strays</b><p class="note">Only from a long trip. A seed goes straight into the ground on the verge; a stray is something living your pet has won over. Both stay in the yard for good.</p></div>
  </div>`,
)

// --- 8. curios -------------------------------------------------------------

const curiosSection = chapter(
  'curios',
  'Curios',
  `There are ${CURIO_COUNT} small treasures, and the board has a slot for every one of them. Found ones sit there in their own colour; the rest are flat silhouettes, which is the point — the board is meant to show you the gaps.`,
  `
  <p>
    Open it with <b>A</b> from the status page. Some curios turn up almost
    anywhere. Others only appear when the world is in the right mood — a
    particular season, a particular sky — and the rarest live a long way out,
    past the point where a sensible player would have called their pet home. The
    board does not tell you which is which. Finding that out is the collection.
  </p>

  <div class="grid">
    ${CURIOS.map(
      (c) => `
      <div class="curio" data-curio="${c.id}">
        <div class="plate"></div>
        <div><b>${c.name}</b><div class="note">${CURIO_SETS.find((s) => s.id === c.set)!.name}</div></div>
      </div>`,
    ).join('')}
  </div>

  <h3>The three sets</h3>
  <p>
    The board is grouped into sets, and finishing one is a standing reward
    rather than a moment. Each makes your pet better at the very job that fills
    the board.
  </p>
  <div class="grid">
    ${CURIO_SETS.map(
      (s) => `
      <div class="card tint-berry">
        <b>${s.name}</b>
        <p class="note">The standing reward:</p>
        <span class="tag">${s.boon}</span>
      </div>`,
    ).join('')}
  </div>

  <div class="callout">
    <b>Spares trade up.</b> Duplicates are not waste: hand over
    ${TRADE_COST} of anything and the board gives you whichever curio you are
    still missing — so a season you keep failing to catch stops being a wall
    that takes an hour of the world's year to come round again.
  </div>

  <p class="note">
    Leaving your pet alone for a good while still turns something up now and
    then, but only one of the ordinary things and only occasionally. Being away
    is the consolation prize; sending your pet out is the way to fill the board.
  </p>

  <h3>The kit</h3>
  <p>
    A second row runs beneath the curios, and it holds a different kind of
    thing. Curios are for the shelf; these ${KIT_COUNT} are practical. Each one
    turns up only on the sort of day it is for — so the world hands your pet
    the tool at about the moment you first wished it had one.
  </p>
  <div class="grid">
    ${KIT.map(
      (k) => `
      <div class="curio" data-kit="${k.id}">
        <div class="plate"></div>
        <div><b>${k.name}</b><div class="note">${k.note}</div></div>
      </div>`,
    ).join('')}
  </div>
  <p class="note">
    Kit belongs to the family rather than to the pet carrying it, so anything
    one pet fetches home is still there for the next. It cannot be traded —
    a second umbrella would be worth nothing, so there is nothing to spend.
  </p>
  <div class="callout">
    <b>What it changes.</b> An umbrella, a pair of waders and a bobble hat each
    take something out of the reckoning when you send your pet out — so a day,
    or a place, that was <em>not today</em> becomes one worth a try. Watch the
    forage menu: it names whichever of them is speaking for a ground. They can
    never make a day <em>look promising</em>, though. Forgiving a bad day is
    not the same as making a good one, and the sky is still worth reading.
  </div>
  <p>
    Boots, a board and a torch work on the far end of a trip instead — the only
    place anything ever goes wrong. Boots keep your pet out of trouble; the
    board makes one more leg cheap while there is snow to ride it on. And the
    torch is for the one thing that makes a trip <em>worse</em>: after dark,
    pushing on is riskier than it is by day. A lit torch puts that back the way
    it was, and sees a little further out besides. The forage menu tells you
    which of the two you are looking at.
  </p>
  <p class="note">
    A trip there and back is as safe after dark as it ever was. It is only
    going further that the night charges for — risk here is always chosen.
    The basket and the pine cone are found and kept and do nothing yet.
  </p>`,
)

for (const item of KIT) {
  fill(curiosSection, `[data-kit="${item.id}"] .plate`, artTile(item.glyph.split('/'), item.colour, 5))
}

for (const curio of CURIOS) {
  fill(curiosSection, `[data-curio="${curio.id}"] .plate`, artTile(curio.glyph.split('/'), curio.colour, 5))
}

// --- 9. the world ----------------------------------------------------------

chapter(
  'world',
  'The world outside',
  'The meadow keeps its own clock, and it runs much faster than yours. A day is about twenty-four minutes; a season is a little over an hour. Four seasons pass in an afternoon.',
  `
  <p>
    The sun arcs over, warms through dawn and dusk and hands over to a moon.
    Night is simply the sun being down — which means the bedtime your pet is
    judged against is the one you can see out of the window, and it moves with
    the season, because winter nights are longer. Lanterns come up as the light
    goes, and go out again once your pet is in bed: the yard is lit for your
    pet, not for you.
  </p>

  <h3>Weather</h3>
  <p>
    Rain and mist in spring and autumn, snow in winter, mostly clear in summer.
    It changes every so often on its own, dulls the sky and flattens the sun.
    Weather is worth watching for two reasons: some grounds want a particular
    sort of day, and so do some of the things your pet might find.
  </p>

  <h3>Visitors</h3>
  <p>
    Some days there is something in the yard. Each belongs to a season or two
    and turns up if the day's dice say so, and an arrival is announced on the
    ticker — which is the only reason a small thing on the far verge gets
    noticed at all. Over a year you might see:
  </p>
  <p class="note">${VISITORS.map((v) => v.arrival).join(' · ')}</p>
  <p class="note">
    Whatever rolls is the one you can join in with — a ball in the meadow, a
    beach ball at the shore, a football on the green, a cone in the wood. It
    rolls properly, and your pet will wander over and shove it about on its own.
  </p>

  <h3>A yard that remembers</h3>
  <p>
    Most of what turns up is gone by morning. Two things are not. A <b>seed</b>
    carried home from a long trip is planted on the verge and grows a stage
    every world day until it is ${PLANTS.map((p) => p.name).join(', ').replace(/, ([^,]*)$/, ' or $1')}. A
    <b>stray</b> is something living your pet has won over out there, and once
    it has, it comes back every time its season does instead of only sometimes.
  </p>
  <p>
    Both outlive the pet that brought them home. Retiring ends a life, not a
    garden — and a yard slowly filling with things your family walked out and
    found is the one part of the world that is a record rather than a fresh
    start.
  </p>`,
)

// --- 10. the map -----------------------------------------------------------

const mapSection = chapter(
  'map',
  'The map',
  'The yard, and everywhere your pet can be sent from it. The four grounds are laid out by how far off they are, because distance is the thing you are choosing between.',
  `
  <div class="map-holder"></div>
  <div class="grid" style="margin-top:20px">
    <div class="card tint-grass"><b>The clearing</b><p class="note">The level ground in the middle of the yard. Your pet picks somewhere, walks there, has a look round, and turns back to face you. The camera turns on the spot to follow it, so the meadow is wider than the window onto it.</p></div>
    <div class="card tint-sun"><b>The verge</b><p class="note">The band just past where your pet roams. It is where anything standing still ends up: a snowman, wildflowers, a rabbit, and whatever your family has planted.</p></div>
    <div class="card tint-cool"><b>The lanterns</b><p class="note">A row behind the verge and one by the shelter door. They light themselves as the sun goes down.</p></div>
    <div class="card tint-berry"><b>The shelter</b><p class="note">Where your pet sleeps. Its front is left open so you can still see it curled up inside. Which side of the yard it stands on depends on your pet — a new life gets new ground.</p></div>
  </div>`,
)
mapSection.querySelector('.map-holder')!.innerHTML = meadowMap()

// --- 11. the long game -----------------------------------------------------

chapter(
  'legacy',
  'The long game',
  'Care keeps one pet well. The family is why you come back.',
  `
  <h3>Retiring a pet</h3>
  <p>
    Hold <b>B</b> on a grown pet's status page and it retires: a farewell, a
    slow walk off into the meadow haze, and a place in the album. The next egg
    hatches with an heirloom from everyone who came before it.
  </p>
  <div class="callout">
    <b>Do not be in a hurry.</b> What a life is worth to the next one counts how
    long your pet was allowed to be grown up, how well it was kept, and how much
    of the collection it helped fill. A pet retired the moment it comes of age
    passes on almost nothing. A full life passes on the lot — and a family
    leans, over time, the way its forebears did.
  </div>

  <h3>What is being counted</h3>
  <div class="grid">
    <div class="card tint-sun"><b>FOUND ${SPECIES_COUNT}</b><p class="note">Forms your family has ever reached, across every generation. Never lost, except to NEW PET.</p></div>
    <div class="card tint-berry"><b>CURIOS ${CURIO_COUNT}</b><p class="note">The collection board. Also belongs to the family rather than to one pet.</p></div>
    <div class="card tint-sun"><b>KIT ${KIT_COUNT}</b><p class="note">The row beneath the curios: things to use rather than to look at. The family's, and kept.</p></div>
    <div class="card tint-cool"><b>The album</b><p class="note">A slot for every form, drawn in that creature's own colours. Forms your family has never grown show as silhouettes — which is what makes the branches worth chasing.</p></div>
    <div class="card tint-grass"><b>The streak</b><p class="note">Days you have visited. Consecutive days build it; a missed day takes one off rather than wiping it out.</p></div>
  </div>

  <h3>Shell colours</h3>
  <p>
    The device itself keeps score. Cycle the colours you have earned with the
    <b>SHELL</b> control under the screen.
  </p>
  <div class="grid">
    ${SHELLS.map((s) => {
      const rgb = s.colour.map((c) => Math.round(Math.pow(c, 1 / 2.2) * 255)).join(',')
      return `
      <div class="card">
        <b><span class="swatch" style="background:rgb(${rgb})"></span>${s.name}</b>
        <p class="note">${s.hint ? `Earned by: ${s.hint}.` : 'Yours from the start.'}</p>
      </div>`
    }).join('')}
  </div>

  <p style="margin-top:26px">
    That is the whole of it. Feed it, wash it, play with it, put it to bed at a
    sensible hour, send it out to see what it can find, and see what it turns
    into. It will be waiting when you get back.
  </p>
  <a class="pill toTop" href="#top">&uarr; BACK TO THE TOP</a>`,
)

// --- contents --------------------------------------------------------------

nav.innerHTML = contents
  .map((entry, i) => `<a href="#${entry.id}">${i + 1}. ${entry.title}</a>`)
  .join('')

book.append(
  html(`<footer>PETZ-9000 &nbsp;·&nbsp; every picture in this booklet is drawn by the game itself.</footer>`),
)

// The 8x8 artwork the album uses for each form, printed small at the very end,
// so the whole cast is on one line for anyone who only wanted the pictures.
const strip = html('<div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap"></div>')
for (const species of SPECIES_LIST) {
  strip.append(artTile(species.glyph.split('/'), '#3f3357', 3))
}
book.append(strip)

// The icon ring's own artwork, for the same reason.
const iconStrip = html('<div style="display:flex;gap:10px;justify-content:center;margin-top:12px"></div>')
for (const id of ICON_ORDER) iconStrip.append(artTile(iconRows(id), '#6a5f83', 3))
book.append(iconStrip)

// Landing here first should still install the offline copy of both pages.
registerServiceWorker()
