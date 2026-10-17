import type { Kind, Part } from './catalog';

export type Hinge = 'left' | 'right';
export type Swing = 'in' | 'out';

/** Room inputs, all lengths in cm. Origin is the top-left inner corner, y grows towards the loggia. */
export interface RoomConfig {
	/** Total inner width */
	W: number;
	/** Length of the right wall */
	L: number;
	/** Hallway corner (notch, top-left) width and depth; 0 = rectangular room */
	NW: number;
	N: number;
	/** Ceiling height */
	H: number;
	/** Interior wall thickness (display only) */
	tI: number;
	/** Exterior wall thickness towards the loggia */
	tE: number;
	door: { off: number; w: number; h: number; hinge: Hinge; swing: Swing };
	front: {
		/** Solid wall pieces left/right of the glass front */
		wl: number;
		wr: number;
		/** How far the wall pieces stick into the room past the glass (window bay); 0 = flush */
		bay?: number;
		glassH: number;
		door: { off: number; w: number; hinge: Hinge; swing: Swing };
	};
	loggia: { D: number; parapetH: number };
	/** Radiator on a side wall, standing on the floor; `off` is its distance from the front wall piece */
	radiator?: { wall: 'left' | 'right'; off: number; w: number; h: number; d: number };
	/** Ceiling lamp (id in MODELS), fixed at x / y */
	ceilingLamp?: { model: string; x: number; y: number };
	/**
	 * Curtains left and right of the glass front (sRGB hex color), on a bar from x0 to x1 above it,
	 * mounted on the front wall pieces
	 */
	curtains?: { color: number; x0: number; x1: number };
	/**
	 * Table and two chairs on the loggia that never move (sRGB hex colors): the table centered on
	 * it, a chair on its left and right facing it, `gap` cm between the table and each seat's front
	 */
	loggiaSet?: {
		table: { w: number; d: number; h: number; color: number };
		chair: { w: number; d: number; h: number; color: number };
		gap: number;
	};
}

export interface Furniture {
	id: string;
	name: string;
	/** Width, depth, height */
	w: number;
	d: number;
	h: number;
	/** Center position */
	cx: number;
	cy: number;
	/** Rotation in degrees, clockwise in plan view */
	rot: number;
	/** Real color, sRGB hex */
	color: number;
	/** Type for icon and preview model; guessed from the name when missing */
	kind?: Kind;
	/** Real 3D model (id in MODELS); its size is fixed */
	model?: string;
	/** Packet: the things it is made of; w × d × h is their bounding box */
	parts?: Part[];
	/** Height small items stand on, when lower than h (e.g. a desk top behind a tall chair) */
	top?: number;
}

export type Point = [number, number];
