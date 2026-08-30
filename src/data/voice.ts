import { random } from '../engine/random'
import type { StatKey } from '../game/types'
import type { WeatherId } from './seasons'
import type { YardGameId } from './yardgames'

/**
 * The pet's voice: little lines it says through the news ticker, shown as
 * `NAME: LINE` so they read as the pet talking rather than the device
 * reporting. Kept short — the screen is 192 pixels wide and a line should
 * finish its crawl before it wears out its welcome.
 *
 * Every species carries a personality pack layered over the generic pools, so
 * the voice changes as the pet evolves: the wide-eyed hatchling grows into a
 * braggart, a stoic, a garden mystic — whatever it was raised into.
 */

export const pick = <T>(pool: T[]): T => pool[Math.floor(random() * pool.length)]!

/** How often a species line wins over a generic one, when the pack has any. */
const PACK_BIAS = 0.6

/** Draws from a shared pool, favouring a species' own lines when it has any. */
export function blend<T>(base: T[], extra: T[] | undefined): T {
  if (extra && extra.length > 0 && random() < PACK_BIAS) return pick(extra)
  return pick(base)
}

/** A species' contribution to the voice. Everything optional; gaps fall back. */
interface VoicePack {
  monologue?: string[]
  night?: string[]
  welcome?: string[]
  fed?: ((food: string) => string)[]
  cleaned?: string[]
  medicine?: string[]
  won?: string[]
  lost?: string[]
  goodnight?: string[]
  morning?: string[]
  needs?: Partial<Record<StatKey, string>>
  /** What it says about something out in the yard it would like to play with. */
  yard?: Partial<Record<YardGameId, string[]>>
}

const PACKS: Record<string, VoicePack> = {
  blob: {
    monologue: [
      "EVERYTHING IS SO BIG OUT HERE",
      "I HAVE FEET! LOOK! FEET!",
      "WHAT DOES 'OUTSIDE' TASTE LIKE?",
      "BEING ROUND IS GOING GREAT SO FAR",
    ],
    welcome: ["HI HI HI HI HI!"],
    goodnight: ["FIRST SLEEPS ARE THE BEST SLEEPS"],
    yard: {
      fetch: ["A ROUND THING! LIKE ME! HELLO ROUND THING!"],
      dive: ["LEAVES! ALL THE LEAVES! I COULD LIVE IN THERE!"],
    },
  },
  pudge: {
    monologue: [
      "THINKING ABOUT SECOND BREAKFAST",
      "IS IT SNACK TIME? IT FEELS SNACKY",
      "I DREAM IN FLAVOURS",
      "STEP ONE: EAT. THERE IS NO STEP TWO",
    ],
    fed: [(food) => `${food}! AND YET I COULD GO AGAIN`],
    needs: { hunger: "FEED ME OR I SHALL BE VERY SAD" },
  },
  spike: {
    monologue: [
      "MY SPIKES LOOK EXTRA SHARP TODAY",
      "I COULD TAKE THAT BOULDER. EASY.",
      "FEAR ME, TINY BEETLES",
      "BEING COOL IS A FULL TIME JOB",
    ],
    won: ["OBVIOUSLY. I NEVER LOSE."],
    lost: ["THAT ONE DIDN'T COUNT. REMATCH."],
    yard: {
      fetch: ["I COULD KICK THAT BALL OVER THE WALL. WATCH."],
      hill: ["THAT HILL DOESN'T SCARE ME. IT SHOULD."],
      chase: ["NOTHING OUTRUNS ME. NOTHING."],
    },
  },
  sprout: {
    monologue: [
      "PSST. I ATE SUNLIGHT AGAIN.",
      "THE FERNS TELL EXCELLENT JOKES",
      "GROWING TAKES SO MUCH PATIENCE",
      "I THINK I FEEL A LEAF COMING IN",
    ],
    morning: ["SUN'S UP! TIME TO PHOTOSYNTHESISE!"],
  },
  mochi: {
    monologue: [
      "ADORABLE? ME? WELL. YES.",
      "A CREATURE THIS SOFT NEEDS REST",
      "I ACCEPT COMPLIMENTS ALL DAY",
      "SOMEONE SHOULD PAINT MY PORTRAIT",
    ],
    welcome: ["YOU RETURN TO YOUR FAVOURITE. WISE."],
    cleaned: ["YES. POLISH THE MASTERPIECE."],
  },
  gloop: {
    monologue: [
      "EVERYTHING STICKS TO ME. FINE.",
      "I'M NOT SULKING. I'M GLISTENING.",
      "TODAY I TOUCHED A ROCK. BIG DAY.",
      "DON'T TELL ANYONE I'M HAPPY",
    ],
    welcome: ["OH. IT'S YOU. ...GOOD."],
    fed: [() => "IT WAS... ADEQUATE. THANKS."],
  },
  blaze: {
    monologue: [
      "UNDEFEATED. JUST SAYING.",
      "I RACED MY SHADOW. I WON.",
      "TRAINING MONTAGE STARTS NOW",
      "IS THERE A TROPHY FOR EXISTING?",
    ],
    won: ["CHAMPION! AS FORETOLD!"],
    lost: ["THE SUN WAS IN MY EYES"],
    yard: {
      chase: ["THAT BUTTERFLY HAS NEVER BEEN CAUGHT. UNTIL TODAY."],
      fetch: ["BALL. ME. NOW. THIS IS A SPORT."],
      hill: ["I HOLD THE HILL RECORD. AGAINST MYSELF."],
    },
  },
  grump: {
    monologue: [
      "IN MY DAY THE GRASS WAS GREENER",
      "BAH. CLOUDS AGAIN.",
      "MY BACK HURTS FROM ALL THIS JOY",
      "I'VE SEEN THINGS. MOSTLY CEILINGS.",
    ],
    welcome: ["HMPH. TOOK YOU LONG ENOUGH."],
    fed: [() => "NOT BAD. I'VE HAD WORSE."],
    needs: { hunger: "A CREATURE COULD STARVE OUT HERE" },
    yard: {
      fetch: ["THERE'S A BALL OUT THERE. NOT THAT I CARE."],
      dive: ["SOMEONE PILED THOSE LEAVES UP. WASTEFUL. ...DEEP, THOUGH."],
      hill: ["A SLED. AT MY AGE. ...WELL. PERHAPS ONCE."],
    },
  },
  verdant: {
    monologue: [
      "BLOOM WHERE YOU ARE PLANTED",
      "THE GARDEN GROWS. SO DO I.",
      "EVERY PETAL KNOWS ITS TIME",
      "BREATHE IN. BREATHE OUT. BLOOM.",
    ],
    goodnight: ["REST IS HOW GARDENS GROW..."],
    yard: {
      dive: ["THE LEAVES HAVE COME DOWN. THEY ARE MEANT TO BE FALLEN IN."],
      chase: ["THE BUTTERFLY AND I HAVE AN UNDERSTANDING"],
    },
  },
  lumen: {
    monologue: [
      "I GLOW, THEREFORE I AM",
      "THE DARK IS JUST LIGHT RESTING",
      "STARS ARE JUST FAR AWAY FRIENDS",
    ],
    night: ["3AM IS MY FINEST HOUR"],
    goodnight: ["DIMMING TO STANDBY... GOODNIGHT"],
    yard: {
      catch: [
        "THE LITTLE LIGHTS ARE OUT. THEY GLOW LIKE ME.",
        "STAY UP. JUST TONIGHT. THE FIREFLIES ARE HERE.",
      ],
    },
  },
  aurora: {
    monologue: [
      "THE SNOW REMEMBERS EVERYTHING",
      "I HUM WHEN THE SKY LISTENS",
      "WINTER CHOSE ME. I CHOSE IT BACK.",
      "COLD IS JUST ANOTHER KIND OF WARM",
    ],
    morning: ["THE FROST AND I ARE BOTH AWAKE"],
  },
}

const packOf = (speciesId: string): VoicePack => PACKS[speciesId] ?? {}

/** Coming back after a short while away. */
const WELCOME = [
  "OH! HELLO! HI! HELLO!",
  "YOU CAME BACK! I KNEW IT!",
  "I MISSED YOU A WHOLE LOT",
  "I WAS JUST THINKING ABOUT YOU!",
]

/** Coming back after hours. Reproachful, but only a little. */
const WELCOME_LONG = [
  "I THOUGHT YOU'D NEVER COME BACK!",
  "WHERE WERE YOU? TELL ME EVERYTHING",
  "I COUNTED EVERY CLOUD WHILE I WAITED",
]

const FED = [
  (food: string) => `THAT ${food} WAS DELICIOUS!`,
  (food: string) => `MMM! ${food}! MY FAVOURITE!`,
  () => "YOU ALWAYS KNOW WHEN I'M PECKISH",
  () => "CHOMP CHOMP CHOMP. THANK YOU!",
]

const CLEANED = [
  "SO FRESH! SO CLEAN! THANK YOU!",
  "SPARKLING! LOOK AT ME GO!",
  "I FEEL LIKE A BRAND NEW CREATURE",
]

const MEDICINE = ["BLEH. BUT THANK YOU. REALLY.", "FEELING BETTER ALREADY!"]

const WON = ["AGAIN! AGAIN! THAT WAS GREAT!", "WE MAKE A GOOD TEAM, YOU AND ME"]
const LOST = ["FUN ANYWAY! REMATCH SOON?", "I ALMOST HAD IT THAT TIME"]

const GOODNIGHT = ["GOODNIGHT... SEE YOU TOMORROW...", "OFF TO DREAM ABOUT SNACKS..."]
const MORNING = ["GOOD MORNING! WHAT A DAY AHEAD!", "I DREAMT I WAS ENORMOUS. ANYWAY."]

/** First-person needs, for the ambient rotation. */
const NEED_BASE: Partial<Record<StatKey, string>> = {
  hunger: "MY TUMMY IS RUMBLING...",
  hygiene: "I AM ABSOLUTELY FILTHY. HELP?",
  energy: "SO... SLEEPY... COULD I NAP?",
  happiness: "PLAY WITH ME? PRETTY PLEASE?",
}

export const SICK_LINE = "I DON'T FEEL SO GOOD..."

/**
 * Noticing something out in the yard, in the first person.
 *
 * The arrival is already announced by the yard itself -- *a ball has turned up*
 * -- but that is the device reporting, it happens once, and it says nothing
 * about there being a game in it. This is the pet asking, which is the only
 * thing that makes the extra row on the PLAY menu findable by a player who
 * never thought to look at PLAY twice.
 */
const YARD_BASE: Record<YardGameId, string[]> = {
  fetch: [
    "THE BALL! THE BALL IS OUT!",
    "SOMEBODY LEFT A BALL. FOR ME? FOR ME.",
  ],
  chase: [
    "THERE IS A BUTTERFLY AND I MUST HAVE IT",
    "IT KEEPS GOING THE OTHER WAY. RUDE.",
  ],
  dive: [
    "THOSE LEAVES ARE PERFECTLY PILED UP",
    "ONE OF THOSE DRIFTS IS DEEP. I CAN TELL.",
  ],
  hill: [
    "SOMEONE LEFT THE SLED OUT!",
    "THE HILL IS RIGHT THERE. RIGHT THERE.",
  ],
  catch: [
    "THE FIREFLIES ARE OUT! QUICK!",
    "LITTLE LIGHTS. I WANT ONE.",
  ],
}

/** Idle musings everyone shares. Species packs colour them heavily. */
const MONOLOGUE = [
  "DO CLOUDS EVER GET LONELY?",
  "I LIKE IT HERE. IT'S HOME.",
  "THE SHRUBS ARE WHISPERING AGAIN",
  "NOTE TO SELF: DIG A HOLE LATER",
]

const MONOLOGUE_NIGHT = [
  "THE STARS ARE OUT TONIGHT",
  "THE MOON IS FOLLOWING ME. SUSPICIOUS.",
]

const MONOLOGUE_WEATHER: Partial<Record<WeatherId, string[]>> = {
  rain: ["I LIKE THE SOUND OF THE RAIN"],
  snow: ["SNOWFLAKES TASTE LIKE SKY"],
  mist: ["THE MIST TICKLES MY FEET"],
}

/** The egg has thoughts too, of a sort. Shown without a name. */
export const EGG_LINES = [
  "THE EGG WOBBLES HOPEFULLY",
  "SOMETHING TAPS FROM INSIDE",
  "THE EGG HUMS A TINY TUNE",
]

export const voice = {
  welcome: (longAway: boolean, speciesId: string) =>
    longAway ? pick(WELCOME_LONG) : blend(WELCOME, packOf(speciesId).welcome),
  fed: (food: string, speciesId: string) =>
    blend(FED, packOf(speciesId).fed)(food.toUpperCase()),
  cleaned: (speciesId: string) => blend(CLEANED, packOf(speciesId).cleaned),
  medicine: (speciesId: string) => blend(MEDICINE, packOf(speciesId).medicine),
  game: (won: boolean, speciesId: string) =>
    won ? blend(WON, packOf(speciesId).won) : blend(LOST, packOf(speciesId).lost),
  goodnight: (speciesId: string) => blend(GOODNIGHT, packOf(speciesId).goodnight),
  morning: (speciesId: string) => blend(MORNING, packOf(speciesId).morning),
  need: (need: StatKey, speciesId: string): string | undefined =>
    packOf(speciesId).needs?.[need] ?? NEED_BASE[need],
  yard: (game: YardGameId, speciesId: string): string =>
    blend(YARD_BASE[game], packOf(speciesId).yard?.[game]),
  monologue: (night: boolean, weather: WeatherId, speciesId: string): string => {
    const base = [...MONOLOGUE]
    if (night) base.push(...MONOLOGUE_NIGHT)
    base.push(...(MONOLOGUE_WEATHER[weather] ?? []))
    const pack = packOf(speciesId)
    const extra = [...(pack.monologue ?? []), ...(night ? (pack.night ?? []) : [])]
    return blend(base, extra)
  },
  egg: () => pick(EGG_LINES),
}
