import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  brokenStorage,
  cancelPendingSave,
  emptySave,
  flushSave,
  load,
  memoryStorage,
  newPet,
  resetIdSource,
  resetStorage,
  save,
  savePending,
  saveSoon,
  SAVE_VERSION,
  setIdSource,
  setStorage,
  wipe,
  emptyPlayAxes,
} from '../../src/game/save'
import type { SaveFile } from '../../src/game/types'
import { resetClock, setClock } from '../../src/engine/clock'
import { emptyPlayAxes as axes } from '../../src/game/save'

/**
 * The save file is the one part of the game a player can actually lose. A
 * migration that drops a field, a corrupt write that stops the app booting, a
 * coalesced save that never lands -- each of those is a child losing a pet, so
 * this is the file that gets the paranoid tests.
 */

const KEY = 'petz9000.save'

let store: ReturnType<typeof memoryStorage>

beforeEach(() => {
  store = memoryStorage()
  setStorage(store)
  let n = 0
  setIdSource(() => `id-${++n}`)
})

afterEach(() => {
  cancelPendingSave()
  resetStorage()
  resetIdSource()
  resetClock()
})

describe('newPet', () => {
  it('starts as an egg that has discovered only itself', () => {
    const pet = newPet('PIP', 1000)
    expect(pet).toMatchObject({
      id: 'id-1',
      name: 'PIP',
      speciesId: 'egg',
      stage: 'egg',
      bornAt: 1000,
      lastTick: 1000,
      ageMs: 0,
      asleep: false,
      sick: false,
      discovered: ['egg'],
    })
  })

  it('starts comfortable but not perfect, so there is something to do', () => {
    const { stats } = newPet('PIP', 0)
    expect(stats).toEqual({ hunger: 70, happiness: 70, energy: 90, hygiene: 90, health: 100 })
  })

  it('starts every record at zero', () => {
    const pet = newPet('PIP', 0)
    expect(pet.care).toEqual({ neglectSeconds: 0, thrivingSeconds: 0, sicknessCount: 0 })
    expect(pet.diet).toEqual({ sweet: 0, protein: 0, veg: 0, junk: 0, meals: 0 })
    expect(pet.play).toEqual({ gamesPlayed: 0, gamesWon: 0, bestStreak: 0, byAxis: emptyPlayAxes() })
    expect(pet.sleep).toEqual({ onTimeSleeps: 0, lateSleeps: 0, overtiredSeconds: 0 })
  })

  it('gives every pet its own id', () => {
    expect(newPet('A', 0).id).not.toBe(newPet('B', 0).id)
  })

  it('falls back to a generated id when crypto has no randomUUID', () => {
    resetIdSource()
    const original = Object.getOwnPropertyDescriptor(globalThis, 'crypto')
    try {
      // Some embedded browsers, and any insecure context, expose `crypto`
      // without the UUID helper -- or do not expose it at all.
      Object.defineProperty(globalThis, 'crypto', { value: {}, configurable: true })
      expect(newPet('PIP', 0).id).toMatch(/^pet-/)
      Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true })
      expect(newPet('PIP', 0).id).toMatch(/^pet-/)
    } finally {
      if (original) Object.defineProperty(globalThis, 'crypto', original)
    }
  })

  it('uses crypto.randomUUID when it is there', () => {
    resetIdSource()
    expect(newPet('PIP', 0).id).toMatch(/^[0-9a-f-]{36}$/)
  })
})

describe('emptySave', () => {
  it('is a complete file at the current version', () => {
    const file = emptySave()
    expect(file.version).toBe(SAVE_VERSION)
    expect(file.pet).toBeNull()
    expect(file).toMatchObject({
      muted: false,
      worldOffset: 0,
      discovered: [],
      album: [],
      curios: {},
      streak: { days: 0, lastDay: '' },
      counters: { sessions: 0, retirements: 0 },
      shell: 'plum',
      home: 'meadow',
      larder: {},
    })
    expect(file.yard).toEqual({ gardens: {}, strays: [] })
  })

  it('hands out a fresh object each time, not a shared one', () => {
    const a = emptySave()
    const b = emptySave()
    a.curios.pebble = 1
    a.yard.strays.push('rabbit')
    expect(b.curios).toEqual({})
    expect(b.yard.strays).toEqual([])
  })
})

describe('load', () => {
  it('is an empty save when there is nothing stored', () => {
    expect(load()).toEqual(emptySave())
  })

  it('is an empty save when storage is unavailable altogether', () => {
    setStorage(null)
    expect(load()).toEqual(emptySave())
  })

  it('is an empty save when storage throws', () => {
    setStorage(brokenStorage())
    expect(load()).toEqual(emptySave())
  })

  it('is an empty save on unparseable text', () => {
    store.data[KEY] = '{ not json'
    expect(load()).toEqual(emptySave())
  })

  it('is an empty save on JSON that is not an object', () => {
    store.data[KEY] = '42'
    expect(load()).toEqual(emptySave())
    store.data[KEY] = 'null'
    expect(load()).toEqual(emptySave())
    store.data[KEY] = '"a string"'
    expect(load()).toEqual(emptySave())
  })

  it('is an empty save on an array, which is an object but not a save', () => {
    store.data[KEY] = '[1,2,3]'
    expect(load()).toEqual(emptySave())
  })

  it('refuses a file from a future version rather than guessing at it', () => {
    store.data[KEY] = JSON.stringify({ ...emptySave(), version: SAVE_VERSION + 1, muted: true })
    expect(load()).toEqual(emptySave())
  })

  it('round-trips a current file unchanged', () => {
    const file: SaveFile = {
      ...emptySave(),
      muted: true,
      worldOffset: 5000,
      discovered: ['egg', 'blob'],
      curios: { pebble: 2 },
      streak: { days: 4, lastDay: '2024-06-03' },
      counters: { sessions: 9, retirements: 1 },
      shell: 'teal',
      larder: { kindling: 3 },
    }
    store.data[KEY] = JSON.stringify(file)
    expect(load()).toEqual(file)
  })

  it('keeps the pet across a round trip', () => {
    const pet = newPet('MOSS', 1234)
    store.data[KEY] = JSON.stringify({ ...emptySave(), pet })
    expect(load().pet).toEqual(pet)
  })
})

describe('migrations', () => {
  it('carries a version 0 file all the way forward', () => {
    // A file with no version at all is the very first format.
    store.data[KEY] = JSON.stringify({ pet: null, muted: true })
    const file = load()
    expect(file.version).toBe(SAVE_VERSION)
    expect(file.muted).toBe(true)
    expect(file.worldOffset).toBe(0)
    expect(file.album).toEqual([])
    expect(file.yard).toEqual({ gardens: { meadow: [] }, strays: [] })
    expect(file.larder).toEqual({})
    expect(file.home).toBe('meadow')
  })

  it('seeds the lineage list from the pet that already existed', () => {
    const pet = { ...newPet('PIP', 0), discovered: ['egg', 'blob', 'spike'] }
    store.data[KEY] = JSON.stringify({ version: 2, pet, muted: false, worldOffset: 0 })
    expect(load().discovered).toEqual(['egg', 'blob', 'spike'])
  })

  it('seeds an empty lineage list when there was no pet', () => {
    store.data[KEY] = JSON.stringify({ version: 2, pet: null, muted: false, worldOffset: 0 })
    expect(load().discovered).toEqual([])
  })

  it('adds the world offset at version 1 without disturbing anything else', () => {
    const pet = newPet('ZED', 77)
    store.data[KEY] = JSON.stringify({ version: 1, pet, muted: true })
    const file = load()
    expect(file.worldOffset).toBe(0)
    expect(file.pet).toEqual(pet)
    expect(file.muted).toBe(true)
  })

  it('adds an empty yard at version 3', () => {
    store.data[KEY] = JSON.stringify({ ...emptySave(), version: 3, yard: undefined })
    expect(load().yard).toEqual({ gardens: { meadow: [] }, strays: [] })
  })

  it('adds an empty larder at version 4', () => {
    store.data[KEY] = JSON.stringify({ ...emptySave(), version: 4, larder: undefined })
    expect(load().larder).toEqual({})
  })

  it('preserves a lineage through every migration from the oldest format', () => {
    const pet = { ...newPet('KIRA', 10), discovered: ['egg', 'blob'] }
    store.data[KEY] = JSON.stringify({ pet, muted: false })
    const file = load()
    expect(file.pet?.name).toBe('KIRA')
    expect(file.discovered).toEqual(['egg', 'blob'])
    expect(file.version).toBe(SAVE_VERSION)
  })
})

describe('repair', () => {
  /**
   * A file that is the right version but the wrong shape. Migrations do not
   * look at these, so without repair the first frame that read one would throw.
   */
  const damaged = (extra: Record<string, unknown>) => {
    store.data[KEY] = JSON.stringify({ version: SAVE_VERSION, ...extra })
    return load()
  }

  it('replaces a missing larder rather than crashing the feed menu', () => {
    expect(damaged({}).larder).toEqual({})
  })

  it('replaces a larder that is not an object', () => {
    expect(damaged({ larder: 'oops' }).larder).toEqual({})
    expect(damaged({ larder: [1, 2] }).larder).toEqual({})
  })

  it('replaces a yard that lost its arrays', () => {
    expect(damaged({ yard: { gardens: 'no', strays: 3 } }).yard).toEqual({
      gardens: {},
      strays: [],
    })
  })

  it('replaces a yard that is not an object at all', () => {
    expect(damaged({ yard: null }).yard).toEqual({ gardens: {}, strays: [] })
  })

  it('keeps a yard that is intact', () => {
    const yard = {
      gardens: { meadow: [{ kind: 'sapling', x: 1, z: 2, plantedAt: 3 }] },
      strays: ['rabbit'],
    }
    expect(damaged({ yard }).yard).toEqual(yard)
  })

  it('drops a garden at a place this build has never heard of', () => {
    const yard = { gardens: { meadow: [], atlantis: [{ kind: 'sapling' }] }, strays: [] }
    expect(damaged({ yard }).yard.gardens).toEqual({ meadow: [] })
  })

  it('sends a save home to the meadow when it names somewhere unknown', () => {
    // `home` picks a scatter pool and keys the gardens, so an unrecognised name
    // has to land somewhere real rather than crash the first frame.
    expect(damaged({ home: 'mars' }).home).toBe('meadow')
    expect(damaged({ home: 7 }).home).toBe('meadow')
  })

  it('keeps a home it recognises', () => {
    expect(damaged({ home: 'woodland' }).home).toBe('woodland')
  })

  it('replaces a streak that lost its fields', () => {
    expect(damaged({ streak: {} }).streak).toEqual({ days: 0, lastDay: '' })
    expect(damaged({ streak: { days: 'x', lastDay: 5 } }).streak).toEqual({ days: 0, lastDay: '' })
  })

  it('replaces a streak that is not an object', () => {
    expect(damaged({ streak: 7 }).streak).toEqual({ days: 0, lastDay: '' })
  })

  it('keeps a streak that is intact', () => {
    expect(damaged({ streak: { days: 5, lastDay: '2024-01-01' } }).streak).toEqual({
      days: 5,
      lastDay: '2024-01-01',
    })
  })

  it('replaces counters that lost their fields', () => {
    expect(damaged({ counters: {} }).counters).toEqual({ sessions: 0, retirements: 0 })
    expect(damaged({ counters: null }).counters).toEqual({ sessions: 0, retirements: 0 })
    expect(damaged({ counters: { sessions: 2, retirements: 1 } }).counters).toEqual({
      sessions: 2,
      retirements: 1,
    })
  })

  it('replaces a non-finite world offset, which would poison every clock read', () => {
    expect(damaged({ worldOffset: Number.NaN }).worldOffset).toBe(0)
    expect(damaged({ worldOffset: Number.POSITIVE_INFINITY }).worldOffset).toBe(0)
    expect(damaged({ worldOffset: '900' }).worldOffset).toBe(0)
    expect(damaged({ worldOffset: 900 }).worldOffset).toBe(900)
  })

  it('replaces lists that are not lists', () => {
    expect(damaged({ discovered: 'egg' }).discovered).toEqual([])
    expect(damaged({ album: {} }).album).toEqual([])
    expect(damaged({ curios: [] }).curios).toEqual({})
  })

  it('replaces a shell id that is not a string', () => {
    expect(damaged({ shell: 12 }).shell).toBe('plum')
    expect(damaged({ shell: 'gold' }).shell).toBe('gold')
  })

  it('replaces a mute flag that is not a boolean', () => {
    expect(damaged({ muted: 'yes' }).muted).toBe(false)
    expect(damaged({ muted: true }).muted).toBe(true)
  })

  it('drops a pet that is not an object rather than booting into one', () => {
    expect(damaged({ pet: 'PIP' }).pet).toBeNull()
    expect(damaged({ pet: [] }).pet).toBeNull()
    expect(damaged({ pet: null }).pet).toBeNull()
  })

  it('normalises the version even when the stored one was older', () => {
    expect(damaged({}).version).toBe(SAVE_VERSION)
  })
})

describe('repairing the pet', () => {
  /**
   * The pet is the one field `repair` used to wave through, on the reasoning
   * that a file at the current version was written by the current code. It is
   * also the only field whose loss is a lost pet rather than a lost setting, so
   * it is the one that gets read back a piece at a time.
   */
  const NOW = Date.UTC(2024, 5, 3, 12, 0, 0)

  beforeEach(() => setClock(() => NOW))

  const withPet = (pet: unknown) => {
    store.data[KEY] = JSON.stringify({ version: SAVE_VERSION, pet })
    return load().pet!
  }

  it('builds a whole pet out of an empty object', () => {
    // The case that used to throw on the first frame: `{}` has no `discovered`,
    // and the boot walks it before anything reaches the screen.
    const pet = withPet({})
    expect(pet).toEqual({
      id: 'id-1',
      name: 'PET',
      speciesId: 'egg',
      stage: 'egg',
      temperament: undefined,
      bornAt: NOW,
      lastTick: NOW,
      ageMs: 0,
      stats: { hunger: 70, happiness: 70, energy: 90, hygiene: 90, health: 100 },
      asleep: false,
      sick: false,
      warm: undefined,
      care: { neglectSeconds: 0, thrivingSeconds: 0, sicknessCount: 0 },
      diet: { sweet: 0, protein: 0, veg: 0, junk: 0, meals: 0 },
      play: { gamesPlayed: 0, gamesWon: 0, bestStreak: 0, byAxis: axes() },
      sleep: { onTimeSleeps: 0, lateSleeps: 0, overtiredSeconds: 0 },
      discovered: ['egg'],
    })
  })

  it('keeps an intact pet exactly as it was', () => {
    const pet = {
      id: 'abc',
      name: 'ZED',
      speciesId: 'pudge',
      stage: 'child',
      temperament: 'lively',
      bornAt: 100,
      lastTick: 200,
      ageMs: 300,
      stats: { hunger: 1, happiness: 2, energy: 3, hygiene: 4, health: 50 },
      asleep: true,
      sick: true,
      warm: true,
      care: { neglectSeconds: 1, thrivingSeconds: 2, sicknessCount: 3 },
      diet: { sweet: 1, protein: 2, veg: 3, junk: 4, meals: 5 },
      play: { gamesPlayed: 1, gamesWon: 2, bestStreak: 3, byAxis: { chase: 4, romp: 5, quiet: 6 } },
      sleep: { onTimeSleeps: 1, lateSleeps: 2, overtiredSeconds: 3 },
      discovered: ['egg', 'blob', 'pudge'],
    }
    expect(withPet(pet)).toEqual(pet)
  })

  it('replaces every field that came back the wrong type', () => {
    const pet = withPet({
      id: 9,
      name: null,
      bornAt: 'soon',
      lastTick: 'later',
      ageMs: 'ages',
      stats: 'fine',
      asleep: 'yes',
      sick: 1,
      warm: 'toasty',
      care: 3,
      diet: [],
      play: null,
      sleep: 'well',
      discovered: 'egg',
    })
    expect(pet.id).toBe('id-1')
    expect(pet.name).toBe('PET')
    expect(pet.bornAt).toBe(NOW)
    expect(pet.lastTick).toBe(NOW)
    expect(pet.ageMs).toBe(0)
    expect(pet.stats).toEqual({ hunger: 70, happiness: 70, energy: 90, hygiene: 90, health: 100 })
    expect(pet.asleep).toBe(false)
    expect(pet.sick).toBe(false)
    expect(pet.warm).toBeUndefined()
    expect(pet.care).toEqual({ neglectSeconds: 0, thrivingSeconds: 0, sicknessCount: 0 })
    expect(pet.play.byAxis).toEqual(axes())
    expect(pet.discovered).toEqual(['egg'])
  })

  it('will not hand back a pet with a blank name', () => {
    // A name is not just a label here: the status screen draws it and the
    // ticker reads it out, so an empty one is a hole rather than a default.
    // Whitespace counts as blank for the same reason.
    expect(withPet({ name: '' }).name).toBe('PET')
    expect(withPet({ name: '   ' }).name).toBe('PET')
    expect(withPet({ name: '  ZED  ' }).name).toBe('ZED')
  })

  it('falls the last tick back to the moment the pet was born', () => {
    expect(withPet({ bornAt: 500 }).lastTick).toBe(500)
  })

  it('brings stats back inside their bounds rather than trusting them', () => {
    // A stat outside 0..100 is one the simulation would never have written, and
    // one the bars on the screen cannot draw.
    const high = withPet({ stats: { hunger: 900, happiness: 101, energy: 100, hygiene: 55, health: 900 } })
    expect(high.stats).toEqual({ hunger: 100, happiness: 100, energy: 100, hygiene: 55, health: 100 })

    const low = withPet({ stats: { hunger: -5, happiness: -1, energy: 0, hygiene: 12, health: -900 } })
    // Health has the simulation's floor rather than zero: there is no death here.
    expect(low.stats).toEqual({ hunger: 0, happiness: 0, energy: 0, hygiene: 12, health: 8 })
  })

  it('floors a tally that came back negative', () => {
    const pet = withPet({ ageMs: -5, care: { neglectSeconds: -1 }, play: { byAxis: { chase: -2 } } })
    expect(pet.ageMs).toBe(0)
    expect(pet.care.neglectSeconds).toBe(0)
    expect(pet.play.byAxis.chase).toBe(0)
  })

  it('starts a pet over as an egg when its form is one this build cannot draw', () => {
    // A save from a branch, or from before a species was renamed. Every screen
    // reads the form; a name nothing answers to is a crash on the first frame.
    expect(withPet({ speciesId: 'chimera', stage: 'adult' }).speciesId).toBe('egg')
    expect(withPet({ speciesId: 'chimera', stage: 'adult' }).stage).toBe('egg')
    expect(withPet({ speciesId: 42 }).speciesId).toBe('egg')
  })

  it('reads the stage off the form rather than believing both', () => {
    // Two fields that can disagree are two fields that eventually will: a save
    // claiming to be a child while wearing an adult's form drew one and scored
    // the other.
    expect(withPet({ speciesId: 'blob', stage: 'adult' }).stage).toBe('baby')
    expect(withPet({ speciesId: 'mochi', stage: 'egg' }).stage).toBe('adult')
  })

  it('drops a temperament it has no name or blurb for', () => {
    expect(withPet({ temperament: 'grumpy' }).temperament).toBeUndefined()
    expect(withPet({ temperament: 7 }).temperament).toBeUndefined()
    expect(withPet({ temperament: 'devoted' }).temperament).toBe('devoted')
  })

  it('keeps a banked fire, either way round', () => {
    expect(withPet({ warm: true }).warm).toBe(true)
    expect(withPet({ warm: false }).warm).toBe(false)
  })

  it('cleans the discovered list, which the collection screen counts', () => {
    const pet = withPet({
      speciesId: 'blob',
      discovered: ['egg', 'egg', 'blob', 'chimera', 7, null],
    })
    expect(pet.discovered).toEqual(['egg', 'blob'])
  })

  it('always lists the form the pet is actually wearing', () => {
    expect(withPet({ speciesId: 'pudge', discovered: [] }).discovered).toEqual(['pudge'])
  })
})

describe('save', () => {
  it('writes the file as JSON', () => {
    const file = { ...emptySave(), muted: true }
    save(file)
    expect(JSON.parse(store.data[KEY]!)).toEqual(file)
  })

  it('swallows a storage failure rather than interrupting play', () => {
    setStorage(brokenStorage())
    expect(() => save(emptySave())).not.toThrow()
  })

  it('does nothing when there is no storage at all', () => {
    setStorage(null)
    expect(() => save(emptySave())).not.toThrow()
  })
})

describe('saveSoon', () => {
  it('coalesces many changes into one write', () => {
    vi.useFakeTimers()
    try {
      const file = emptySave()
      const setItem = vi.spyOn(store, 'setItem')
      saveSoon(file)
      saveSoon(file)
      saveSoon(file)
      expect(setItem).not.toHaveBeenCalled()
      vi.advanceTimersByTime(1000)
      expect(setItem).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('writes the newest file, not the one the timer started with', () => {
    vi.useFakeTimers()
    try {
      const first = emptySave()
      const second = { ...emptySave(), shell: 'gold' }
      saveSoon(first)
      saveSoon(second)
      vi.advanceTimersByTime(1000)
      expect(JSON.parse(store.data[KEY]!).shell).toBe('gold')
    } finally {
      vi.useRealTimers()
    }
  })

  it('can schedule again after one has landed', () => {
    vi.useFakeTimers()
    try {
      saveSoon({ ...emptySave(), shell: 'teal' })
      vi.advanceTimersByTime(1000)
      saveSoon({ ...emptySave(), shell: 'rose' })
      vi.advanceTimersByTime(1000)
      expect(JSON.parse(store.data[KEY]!).shell).toBe('rose')
    } finally {
      vi.useRealTimers()
    }
  })

  it('reports whether a write is outstanding', () => {
    expect(savePending()).toBe(false)
    saveSoon(emptySave())
    expect(savePending()).toBe(true)
    flushSave()
    expect(savePending()).toBe(false)
  })
})

describe('flushSave', () => {
  it('writes immediately instead of waiting out the second', () => {
    saveSoon({ ...emptySave(), muted: true })
    expect(store.data[KEY]).toBeUndefined()
    flushSave()
    expect(JSON.parse(store.data[KEY]!).muted).toBe(true)
  })

  it('does nothing when there is nothing pending', () => {
    flushSave()
    expect(store.data[KEY]).toBeUndefined()
  })
})

describe('cancelPendingSave', () => {
  it('drops the write instead of making it', () => {
    saveSoon({ ...emptySave(), muted: true })
    cancelPendingSave()
    flushSave()
    expect(store.data[KEY]).toBeUndefined()
  })

  it('is safe with nothing pending', () => {
    expect(() => cancelPendingSave()).not.toThrow()
  })
})

describe('wipe', () => {
  it('removes the file', () => {
    save(emptySave())
    wipe()
    expect(store.data[KEY]).toBeUndefined()
    expect(load()).toEqual(emptySave())
  })

  it('drops any pending write, so a wipe cannot be undone a second later', () => {
    saveSoon({ ...emptySave(), muted: true })
    wipe()
    flushSave()
    expect(store.data[KEY]).toBeUndefined()
  })

  it('swallows a storage failure', () => {
    setStorage(brokenStorage())
    expect(() => wipe()).not.toThrow()
  })

  it('does nothing when there is no storage', () => {
    setStorage(null)
    expect(() => wipe()).not.toThrow()
  })
})

describe('storage seam', () => {
  it('finds the browser store by default', () => {
    resetStorage()
    const fake = memoryStorage()
    const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
    try {
      Object.defineProperty(globalThis, 'localStorage', { value: fake, configurable: true })
      resetStorage()
      save(emptySave())
      expect(fake.data[KEY]).toBeDefined()
    } finally {
      if (original) Object.defineProperty(globalThis, 'localStorage', original)
      else delete (globalThis as { localStorage?: unknown }).localStorage
      resetStorage()
    }
  })

  it('copes with a host where reading localStorage itself throws', () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
    try {
      Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        get() {
          throw new Error('blocked')
        },
      })
      resetStorage()
      expect(load()).toEqual(emptySave())
    } finally {
      if (original) Object.defineProperty(globalThis, 'localStorage', original)
      else delete (globalThis as { localStorage?: unknown }).localStorage
      resetStorage()
    }
  })

  it('copes with a host that has no localStorage at all', () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
    try {
      delete (globalThis as { localStorage?: unknown }).localStorage
      resetStorage()
      expect(load()).toEqual(emptySave())
    } finally {
      if (original) Object.defineProperty(globalThis, 'localStorage', original)
      resetStorage()
    }
  })
})

describe('memoryStorage', () => {
  it('starts from what it is handed and behaves like a store', () => {
    const mem = memoryStorage({ a: '1' })
    expect(mem.getItem('a')).toBe('1')
    expect(mem.getItem('b')).toBeNull()
    mem.setItem('b', '2')
    expect(mem.getItem('b')).toBe('2')
    mem.removeItem('b')
    expect(mem.getItem('b')).toBeNull()
  })
})

describe('brokenStorage', () => {
  it('throws on everything, which is the point of it', () => {
    const store = brokenStorage()
    expect(() => store.getItem('a')).toThrow()
    expect(() => store.setItem('a', '1')).toThrow()
    expect(() => store.removeItem('a')).toThrow()
  })
})
