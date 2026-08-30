import type { DietAxis, Stats } from '../game/types'

export interface Food {
  id: string
  name: string
  /** Which branching axis this meal counts toward. Medicine counts toward none. */
  axis: DietAxis | null
  /** Stat deltas applied on eating. */
  effect: Partial<Stats>
  /**
   * Whether it is a hot dish or a cold one, which decides the weather it
   * suits. Stated rather than inferred: reading it off the energy the food
   * happens to give made Fries summery and Cake warming, and gave Medicine a
   * seasonal bonus for being a meal it is not.
   */
  served?: 'hot' | 'cold'
  /** Palette for the food's voxel and its eating particles. */
  color: string
  /** Shown under the icon on the feed menu. */
  note: string
  /**
   * Foraged rather than conjured. A gathered food is free and counts toward the
   * diet like any other, but there is only ever as much of it as the pet has
   * carried home -- so it appears on the menu when there is some and not
   * otherwise.
   */
  gathered?: boolean
}

export const FOODS: Food[] = [
  {
    id: 'berry',
    served: 'cold',
    name: 'Berry',
    axis: 'sweet',
    effect: { hunger: 18, happiness: 10 },
    color: '#ff6fae',
    note: 'Sweet. Cheerful.',
  },
  {
    id: 'meat',
    served: 'hot',
    name: 'Drumstick',
    axis: 'protein',
    effect: { hunger: 30, energy: 6 },
    color: '#e08a5a',
    note: 'Filling. Builds bulk.',
  },
  {
    id: 'salad',
    served: 'cold',
    name: 'Greens',
    axis: 'veg',
    effect: { hunger: 14, health: 8 },
    color: '#8fe36a',
    note: 'Wholesome. Not exciting.',
  },
  {
    id: 'fries',
    served: 'hot',
    name: 'Fries',
    axis: 'junk',
    effect: { hunger: 26, happiness: 16, health: -7 },
    color: '#ffd93d',
    note: 'Delicious. Regrettable.',
  },
  {
    id: 'cake',
    name: 'Cake',
    axis: 'sweet',
    effect: { hunger: 20, happiness: 28, health: -3, energy: 8 },
    color: '#ffb3d9',
    note: 'A proper treat.',
  },
  {
    id: 'berries',
    gathered: true,
    served: 'cold',
    name: 'Bramble Berries',
    axis: 'sweet',
    effect: { hunger: 16, happiness: 9 },
    color: '#7a2f5e',
    note: 'Brought home. Tart.',
  },
  {
    id: 'roots',
    gathered: true,
    served: 'hot',
    name: 'Wild Roots',
    axis: 'veg',
    effect: { hunger: 22, health: 7 },
    color: '#c08a4a',
    note: 'Brought home. Earthy.',
  },
  {
    id: 'honeycomb',
    gathered: true,
    name: 'Honeycomb',
    axis: 'sweet',
    effect: { hunger: 18, happiness: 22, energy: 6 },
    color: '#ffc94d',
    note: 'Brought home. Worth it.',
  },
  {
    id: 'medicine',
    name: 'Medicine',
    axis: null,
    effect: { health: 34, happiness: -12 },
    color: '#7fd6ff',
    note: 'For when it is poorly.',
  },
]

export const foodById = (id: string): Food => {
  const found = FOODS.find((f) => f.id === id)
  if (!found) throw new Error(`Unknown food: ${id}`)
  return found
}
