import type { DietAxis, Stats } from '../game/types'

export interface Food {
  id: string
  name: string
  /** Which branching axis this meal counts toward. Medicine counts toward none. */
  axis: DietAxis | null
  /** Stat deltas applied on eating. */
  effect: Partial<Stats>
  /** Palette for the food's voxel and its eating particles. */
  color: string
  /** Shown under the icon on the feed menu. */
  note: string
}

export const FOODS: Food[] = [
  {
    id: 'berry',
    name: 'Berry',
    axis: 'sweet',
    effect: { hunger: 18, happiness: 10 },
    color: '#ff6fae',
    note: 'Sweet. Cheerful.',
  },
  {
    id: 'meat',
    name: 'Drumstick',
    axis: 'protein',
    effect: { hunger: 30, energy: 6 },
    color: '#e08a5a',
    note: 'Filling. Builds bulk.',
  },
  {
    id: 'salad',
    name: 'Greens',
    axis: 'veg',
    effect: { hunger: 14, health: 8 },
    color: '#8fe36a',
    note: 'Wholesome. Not exciting.',
  },
  {
    id: 'fries',
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
