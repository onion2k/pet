import type { PetState, SaveFile } from './types'

const KEY = 'petz9000.save'
export const SAVE_VERSION = 3

/**
 * Migrations run in order for every version below the current one. Adding a
 * field means adding a migration here rather than wiping anyone's pet.
 */
const MIGRATIONS: Record<number, (raw: any) => any> = {
  // 0 -> 1 is the initial format; nothing to do.
  // 1 -> 2 adds the world clock offset. Existing pets start in step with the
  // wall clock, which is where they already were.
  1: (raw) => ({ ...raw, worldOffset: 0 }),
  // 2 -> 3 adds the lineage: album, curios, streak, counters and shell. What
  // the current pet has already discovered seeds the lineage-wide list.
  2: (raw) => ({
    ...raw,
    discovered: raw.pet?.discovered ?? [],
    album: [],
    curios: {},
    streak: { days: 0, lastDay: '' },
    counters: { sessions: 0, retirements: 0 },
    shell: 'plum',
  }),
}

export function newPet(name: string, now: number): PetState {
  return {
    id: crypto.randomUUID(),
    name,
    speciesId: 'egg',
    stage: 'egg',
    bornAt: now,
    lastTick: now,
    ageMs: 0,
    stats: { hunger: 70, happiness: 70, energy: 90, hygiene: 90, health: 100 },
    asleep: false,
    sick: false,
    care: { neglectSeconds: 0, thrivingSeconds: 0, sicknessCount: 0 },
    diet: { sweet: 0, protein: 0, veg: 0, junk: 0, meals: 0 },
    play: { gamesPlayed: 0, gamesWon: 0, bestStreak: 0 },
    sleep: { onTimeSleeps: 0, lateSleeps: 0, overtiredSeconds: 0 },
    discovered: ['egg'],
  }
}

export function emptySave(): SaveFile {
  return {
    version: SAVE_VERSION,
    pet: null,
    muted: false,
    worldOffset: 0,
    discovered: [],
    album: [],
    curios: {},
    streak: { days: 0, lastDay: '' },
    counters: { sessions: 0, retirements: 0 },
    shell: 'plum',
  }
}

export function load(): SaveFile {
  let raw: unknown
  try {
    const text = localStorage.getItem(KEY)
    if (!text) return emptySave()
    raw = JSON.parse(text)
  } catch {
    // Corrupt or unavailable storage should never stop the app from booting.
    return emptySave()
  }

  if (typeof raw !== 'object' || raw === null) return emptySave()
  let data = raw as SaveFile & Record<string, unknown>
  const from = typeof data.version === 'number' ? data.version : 0
  if (from > SAVE_VERSION) return emptySave()

  for (let v = from; v < SAVE_VERSION; v++) {
    const migrate = MIGRATIONS[v]
    if (migrate) data = migrate(data)
  }
  data.version = SAVE_VERSION
  return data
}

let pending = 0

export function save(file: SaveFile): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(file))
  } catch {
    // Private-mode storage failures are not worth interrupting play for.
  }
}

/** Coalesces the many small state changes a session makes into one write per second. */
export function saveSoon(file: SaveFile): void {
  if (pending) return
  pending = window.setTimeout(() => {
    pending = 0
    save(file)
  }, 1000)
}

export function wipe(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* nothing we can do */
  }
}
