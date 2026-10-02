import type { Furniture, RoomConfig } from './types';

/** Starting values, estimated from the floor plan. */
export const DEFAULT_CFG: RoomConfig = {
	W: 350,
	L: 500,
	NW: 150,
	N: 135,
	H: 250,
	tI: 12,
	tE: 30,
	door: { off: 25, w: 88, h: 201, hinge: 'left', swing: 'in' },
	front: { wl: 50, wr: 50, glassH: 225, door: { off: 141, w: 88, hinge: 'left', swing: 'in' } },
	loggia: { D: 110, parapetH: 100 }
};

export const DEFAULT_FURN: Furniture[] = [
	{
		id: 'f1',
		name: 'Bed (example)',
		kind: 'bed',
		w: 140,
		d: 200,
		h: 45,
		cx: 280,
		cy: 260,
		rot: 0,
		color: 0
	},
	{
		id: 'f2',
		name: 'Desk (example)',
		kind: 'desk',
		w: 140,
		d: 70,
		h: 75,
		cx: 35,
		cy: 330,
		rot: 90,
		color: 1
	}
];

/** CSS variables of the furniture colors (defined in layout.css). */
export const PALETTE = ['--f1', '--f2', '--f3', '--f4', '--f5'];
