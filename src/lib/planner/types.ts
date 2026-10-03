import type { Kind } from './catalog';

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
		glassH: number;
		door: { off: number; w: number; hinge: Hinge; swing: Swing };
	};
	loggia: { D: number; parapetH: number };
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
	/** Index into the furniture palette */
	color: number;
	/** Type for icon and preview model; guessed from the name when missing */
	kind?: Kind;
	/** Real 3D model (id in MODELS); its size is fixed */
	model?: string;
}

export interface PlannerData {
	cfg: RoomConfig;
	furn: Furniture[];
	measured: boolean;
}

export type Point = [number, number];
