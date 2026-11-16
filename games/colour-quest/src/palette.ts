// The colours the Grey stole. Vivid on purpose: they're the only colour in the world.
export type ColourId = 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple';
export const COLOUR_IDS: ColourId[] = ['red', 'orange', 'yellow', 'green', 'blue', 'purple'];
export const HEX: Record<ColourId, string> = {
  red: '#ff2e4d',
  orange: '#ff8a00',
  yellow: '#ffd400',
  green: '#1fd65f',
  blue: '#2a7dff',
  purple: '#a23bff',
};
export const NAME: Record<ColourId, string> = { red: 'Red', orange: 'Orange', yellow: 'Yellow', green: 'Green', blue: 'Blue', purple: 'Purple' };
export const PAPER = '#f4f1ea';
export const INK = '#151515';
export type Needs = Partial<Record<ColourId, number>>;
