import type { StatKey } from '../game/types'
import type { WeatherId } from './seasons'

/**
 * The pet's voice: little lines it says through the news ticker. All are
 * shown as `NAME: LINE`, so they read as the pet talking rather than the
 * device reporting. Kept short — the screen is 192 pixels wide and a line
 * should finish its crawl before it wears out its welcome.
 */

const pick = <T>(pool: T[]): T => pool[Math.floor(Math.random() * pool.length)]!

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
export const NEED_LINES: Partial<Record<StatKey, string>> = {
  hunger: "MY TUMMY IS RUMBLING...",
  hygiene: "I AM ABSOLUTELY FILTHY. HELP?",
  energy: "SO... SLEEPY... COULD I NAP?",
  happiness: "PLAY WITH ME? PRETTY PLEASE?",
}

export const SICK_LINE = "I DON'T FEEL SO GOOD..."

/** Idle musings. General pool plus lines the moment makes true. */
const MONOLOGUE = [
  "DO CLOUDS EVER GET LONELY?",
  "I LIKE IT HERE. IT'S HOME.",
  "ONE DAY I'LL CLIMB THAT BOULDER",
  "THE SHRUBS ARE WHISPERING AGAIN",
  "AM I ROUND? I FEEL ROUND TODAY",
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
  welcome: (longAway: boolean) => pick(longAway ? WELCOME_LONG : WELCOME),
  fed: (food: string) => pick(FED)(food.toUpperCase()),
  cleaned: () => pick(CLEANED),
  medicine: () => pick(MEDICINE),
  game: (won: boolean) => pick(won ? WON : LOST),
  goodnight: () => pick(GOODNIGHT),
  morning: () => pick(MORNING),
  monologue: (night: boolean, weather: WeatherId): string => {
    const pool = [...MONOLOGUE]
    if (night) pool.push(...MONOLOGUE_NIGHT)
    pool.push(...(MONOLOGUE_WEATHER[weather] ?? []))
    return pick(pool)
  },
  egg: () => pick(EGG_LINES),
}
