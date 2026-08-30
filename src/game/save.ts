import type { PetState, SaveFile } from './types'
import { emptyYard } from './yard'

const KEY = 'petz9000.save'
export const SAVE_VERSION = 5

/**
 * The slice of `localStorage` the save needs, behind a seam. A test supplies a
 * plain object; the browser supplies the real thing. Storage that is missing
 * altogether -- a headless run, a locked-down browser -- is a supported state
 * rather than a crash, so the game boots either way.
 */
export interface SaveStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

function defaultStorage(): SaveStorage | null {
  try {
    const store = (globalThis as { localStorage?: SaveStorage }).localStorage
    return store ?? null
  } catch {
    // Merely reading `localStorage` throws in some privacy modes.
    return null
  }
}

let storage: SaveStorage | null | undefined

function currentStorage(): SaveStorage | null {
  if (storage === undefined) storage = defaultStorage()
  return storage
}

/** Swaps the backing store. Tests use this; nothing in the game does. */
export function setStorage(store: SaveStorage | null): void {
  storage = store
}

/** Back to the browser's own storage. */
export function resetStorage(): void {
  storage = undefined
}

/** An in-memory store, for tests and for browsers that will not give us one. */
export function memoryStorage(initial: Record<string, string> = {}): SaveStorage & {
  data: Record<string, string>
} {
  const data: Record<string, string> = { ...initial }
  return {
    data,
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      data[key] = value
    },
    removeItem: (key) => {
      delete data[key]
    },
  }
}

/**
 * A store that throws on every operation, which is what a private-mode browser
 * with storage disabled looks like from in here.
 */
export function brokenStorage(): SaveStorage {
  const fail = (): never => {
    throw new Error('storage unavailable')
  }
  return { getItem: fail, setItem: fail, removeItem: fail }
}

/**
 * Ids for new pets, behind a seam so a test can pin one down. `randomUUID` is
 * missing in insecure contexts and in a few embedded browsers, and a pet with
 * no id is a pet the terrain cannot be seeded from -- so there is a fallback.
 */
const browserId = (): string =>
  globalThis.crypto?.randomUUID?.() ?? `pet-${Math.random().toString(36).slice(2)}`

let nextId: () => string = browserId

export function setIdSource(fn: () => string): void {
  nextId = fn
}

export function resetIdSource(): void {
  nextId = browserId
}

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
  // 3 -> 4 adds the yard: what the pet has planted and what it has befriended.
  // An existing save starts with an empty one, which is where it already was.
  3: (raw) => ({ ...raw, yard: { plantings: [], strays: [] } }),
  // 4 -> 5 adds the larder. Nothing has been foraged yet, so it starts bare.
  4: (raw) => ({ ...raw, larder: {} }),
}

export function newPet(name: string, at: number): PetState {
  return {
    id: nextId(),
    name,
    speciesId: 'egg',
    stage: 'egg',
    bornAt: at,
    lastTick: at,
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
    yard: emptyYard(),
    larder: {},
  }
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

const str = (v: unknown, fallback: string): string => (typeof v === 'string' ? v : fallback)
const num = (v: unknown, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback
const bool = (v: unknown, fallback: boolean): boolean =>
  typeof v === 'boolean' ? v : fallback
const arr = <T>(v: unknown, fallback: T[]): T[] => (Array.isArray(v) ? (v as T[]) : fallback)
const rec = <T>(v: unknown, fallback: Record<string, T>): Record<string, T> =>
  isRecord(v) ? (v as Record<string, T>) : fallback

/**
 * Fills in anything a hand-edited or half-written save is missing.
 *
 * Migrations assume the file they are handed is the shape the previous version
 * wrote. A file that is not -- truncated by a full disk, edited by a curious
 * child, written by a build that has since been rolled back -- would otherwise
 * boot into a crash on the first frame that read the missing field, which for
 * this game means a pet that cannot be reached rather than an error message.
 * Anything unreadable falls back to what an empty save would have had, so the
 * worst case is a lost setting rather than a lost pet.
 */
function repair(data: Record<string, unknown>): SaveFile {
  const base = emptySave()
  const streak = isRecord(data.streak) ? data.streak : {}
  const counters = isRecord(data.counters) ? data.counters : {}
  const yard = isRecord(data.yard) ? data.yard : {}
  return {
    version: SAVE_VERSION,
    pet: isRecord(data.pet) ? (data.pet as unknown as PetState) : null,
    muted: bool(data.muted, base.muted),
    worldOffset: num(data.worldOffset, base.worldOffset),
    discovered: arr(data.discovered, base.discovered),
    album: arr(data.album, base.album),
    curios: rec(data.curios, base.curios),
    streak: { days: num(streak.days, 0), lastDay: str(streak.lastDay, '') },
    counters: {
      sessions: num(counters.sessions, 0),
      retirements: num(counters.retirements, 0),
    },
    shell: str(data.shell, base.shell),
    yard: { plantings: arr(yard.plantings, []), strays: arr(yard.strays, []) },
    larder: rec(data.larder, base.larder),
  }
}

export function load(): SaveFile {
  let raw: unknown
  try {
    const store = currentStorage()
    if (!store) return emptySave()
    const text = store.getItem(KEY)
    if (!text) return emptySave()
    raw = JSON.parse(text)
  } catch {
    // Corrupt or unavailable storage should never stop the app from booting.
    return emptySave()
  }

  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return emptySave()
  let data = raw as Record<string, unknown>
  const from = typeof data.version === 'number' ? data.version : 0
  if (from > SAVE_VERSION) return emptySave()

  for (let v = from; v < SAVE_VERSION; v++) {
    const migrate = MIGRATIONS[v]
    if (migrate) data = migrate(data)
  }
  return repair(data)
}

let pending: ReturnType<typeof setTimeout> | null = null
let pendingFile: SaveFile | null = null

export function save(file: SaveFile): void {
  try {
    currentStorage()?.setItem(KEY, JSON.stringify(file))
  } catch {
    // Private-mode storage failures are not worth interrupting play for.
  }
}

/** Coalesces the many small state changes a session makes into one write per second. */
export function saveSoon(file: SaveFile): void {
  pendingFile = file
  if (pending) return
  pending = setTimeout(() => {
    pending = null
    const queued = pendingFile
    pendingFile = null
    if (queued) save(queued)
  }, 1000)
}

/** Writes any coalesced save immediately. Tests use this; so could a shutdown. */
export function flushSave(): void {
  if (pending) {
    clearTimeout(pending)
    pending = null
  }
  const queued = pendingFile
  pendingFile = null
  if (queued) save(queued)
}

/** Drops a coalesced save without writing it, so tests do not leak timers. */
export function cancelPendingSave(): void {
  if (pending) {
    clearTimeout(pending)
    pending = null
  }
  pendingFile = null
}

/** Whether a coalesced write is still outstanding. */
export const savePending = (): boolean => pending !== null

export function wipe(): void {
  cancelPendingSave()
  try {
    currentStorage()?.removeItem(KEY)
  } catch {
    /* nothing we can do */
  }
}
