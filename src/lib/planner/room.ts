import { MODELS, partSize, type Kind, type Part } from './catalog';
import { checkFurniture, keepInside, normalizeAngle } from './furniture';
import { computeGeometry } from './geometry';
import type { Furniture, RoomConfig } from './types';

/**
 * The one Room everybody furnishes, and its Inventory (ADR 0002). Designs only store where each
 * Piece stands, so changing anything here (measurements, sizes, colors, pieces) needs a new
 * ROOM_ID, which starts a fresh Leaderboard.
 */
export const ROOM_ID = 'clemens-v2';

/** Real colors (sRGB hex) as seen from above, for the blocks in Furnish and the icons */
const WHITE = 0xf1efea;
const BLACK = 0x232324;
const SILVER = 0xc7c9cc;
const NAVY = 0x1c2741;
const OAK = 0xc4a07a;
const PALE_OAK = 0xdecfb6;
const RATTAN = 0x8b5e3c;

/** Room inputs in cm. Origin is the top-left inner corner, y grows towards the loggia. */
export const ROOM: RoomConfig = {
	// Entrance part 168 + Einbuchtung 187; the window wall measures 68 + 224 + 62 = 354
	W: 355,
	L: 508,
	NW: 168,
	N: 132,
	H: 238,
	tI: 14,
	tE: 30,
	door: { off: 17, w: 86, h: 201, hinge: 'left', swing: 'in' },
	front: {
		// Wall pieces beside the window (bed side 68, desk side 63) reach 26 cm past the glass
		wl: 68,
		wr: 63,
		bay: 26,
		// Opening including its 7 cm frames
		glassH: 232,
		// Balcony door 92 wide, ending 67 cm before the right wall piece
		door: { off: 355 - 63 - 67 - 92, w: 92, hinge: 'right', swing: 'in' }
	},
	loggia: { D: 110, parapetH: 100 },
	radiator: { wall: 'right', off: 10, w: 77, h: 90, d: 14 },
	// Middle of the room's width, a bit towards the entry from the middle of its main part
	ceilingLamp: { model: 'ikea-ps2014-lamp', x: 175, y: 270 },
	// The bar starts 10 cm onto the left wall piece and ends just short of the right wall
	curtains: { color: 0x8c8e90, x0: 68 - 10, x1: 355 - 3 },
	// White table with two brown woven chairs
	loggiaSet: {
		table: { w: 80, d: 70, h: 80, color: WHITE },
		chair: { w: 45, d: 50, h: 80, color: RATTAN },
		gap: 8
	}
};

export const GEO = computeGeometry(ROOM);

/** One real piece of furniture. Its size and color are fixed; Designs only move and turn it. */
export interface Piece {
	id: string;
	name: string;
	kind: Kind;
	w: number;
	d: number;
	h: number;
	/** Real color, sRGB hex */
	color: number;
	/** Real 3D model (id in MODELS) */
	model?: string;
	/** Packet: the things it is made of */
	parts?: Part[];
	/** Height small items stand on, when lower than h */
	top?: number;
}

/** Where a Piece stands: center (cm) and rotation (degrees, clockwise in plan view). */
export interface Placement {
	cx: number;
	cy: number;
	rot: number;
}

export type Placements = Record<string, Placement>;

const fromModel = (id: string, name: string, model: string, color: number): Piece => ({
	id,
	name,
	kind: MODELS[model].kind,
	...MODELS[model].size,
	...(MODELS[model].base && { w: MODELS[model].base.w, d: MODELS[model].base.d }),
	color,
	model
});

const round = (v: number) => Math.round(v * 10) / 10;

/**
 * A Piece made of parts that always stand together. Its box is the parts' bounding box, and the
 * parts are shifted so the box is centered on the Piece.
 */
function packet(
	id: string,
	name: string,
	kind: Kind,
	color: number,
	parts: Part[],
	top?: number
): Piece {
	const xs: number[] = [];
	const zs: number[] = [];
	let h = 0;
	for (const p of parts) {
		const s = partSize(p);
		const a = ((p.rot ?? 0) * Math.PI) / 180;
		const c = Math.abs(Math.cos(a));
		const n = Math.abs(Math.sin(a));
		const hw = (s.w * c + s.d * n) / 2;
		const hd = (s.w * n + s.d * c) / 2;
		xs.push(p.at[0] - hw, p.at[0] + hw);
		zs.push(p.at[2] - hd, p.at[2] + hd);
		h = Math.max(h, p.at[1] + s.h);
	}
	const [x0, x1, z0, z1] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
	const [mx, mz] = [(x0 + x1) / 2, (z0 + z1) / 2];
	return {
		id,
		name,
		kind,
		w: round(x1 - x0),
		d: round(z1 - z0),
		h: round(h),
		color,
		parts: parts.map((p) => ({ ...p, at: [round(p.at[0] - mx), p.at[1], round(p.at[2] - mz)] })),
		...(top && { top })
	};
}

/** TROTTEN sit/stand desk, planned at sitting height */
const DESK_H = 75;
const STAND_H = MODELS['keyboard-stand'].size.h;

export const INVENTORY: Piece[] = [
	{ id: 'bed', name: 'Boxspring bed', kind: 'bed', w: 140, d: 210, h: 50, color: NAVY },
	{ id: 'wardrobe', name: 'Wardrobe', kind: 'wardrobe', w: 150, d: 70, h: 218, color: PALE_OAK },
	{ id: 'desk', name: 'Desk', kind: 'desk', w: 125, d: 50, h: 78, color: OAK },
	{ id: 'chair', name: 'Office chair', kind: 'chair', w: 62, d: 62, h: 105, color: BLACK },
	packet(
		'workstation',
		'Workstation',
		'standing-desk',
		WHITE,
		[
			{
				name: 'Trotten desk',
				kind: 'standing-desk',
				size: { w: 160, d: 80, h: DESK_H },
				at: [0, 0, 0],
				color: WHITE
			},
			// 32" monitor at the back with an upright 24" one to its right, turned towards the
			// chair; the laptop in front
			{
				name: '32" monitor',
				kind: 'monitor',
				size: { w: 71.5, d: 22, h: 54 },
				at: [-8, DESK_H, -27],
				color: BLACK
			},
			{
				name: '24" monitor',
				kind: 'monitor',
				size: { w: 33, d: 20, h: 66 },
				at: [50, DESK_H, -24],
				rot: 20,
				color: BLACK
			},
			{
				name: 'Laptop',
				kind: 'laptop',
				size: { w: 31.5, d: 24, h: 21 },
				at: [-8, DESK_H, 4],
				color: SILVER
			},
			// Pushed in until the armrests reach the desk's edge
			{
				name: 'Markus chair',
				kind: 'chair',
				model: 'ikea-markus-chair',
				at: [0, 0, 52],
				rot: 180,
				color: BLACK
			}
		],
		DESK_H
	),
	packet('piano', 'E-piano', 'piano', BLACK, [
		{ name: 'Z-stand', kind: 'piano', model: 'keyboard-stand', at: [0, 0, 0], color: BLACK },
		{ name: 'Yamaha P-45', kind: 'piano', model: 'yamaha-p45', at: [0, STAND_H, 0], color: BLACK },
		{
			name: 'Piano stool',
			kind: 'stool',
			size: { w: 40, d: 30, h: 50 },
			at: [0, 0, 45],
			color: BLACK
		}
	]),
	fromModel('flipchart', 'Flipchart', 'flipchart', WHITE),
	fromModel('kallax', 'Kallax', 'ikea-kallax', WHITE),
	{ id: 'nightstand', name: 'Nightstand', kind: 'nightstand', w: 38, d: 43, h: 63, color: WHITE },
	fromModel('nymo-lamp', 'Nymo lamp', 'ikea-nymo-lamp', BLACK),
	fromModel('floor-lamp', 'Floor lamp', 'ikea-skaftet-lamp', BLACK)
];

export const PIECE_IDS = INVENTORY.map((p) => p.id);

/**
 * The Pieces of a Design that are placed, at their placements. A Draft starts empty and gets its
 * Pieces dragged in one by one; a Published Design always has all of them.
 */
export function designFurniture(placements: Placements): Furniture[] {
	return INVENTORY.flatMap((p) => {
		const at = placements[p.id];
		return at ? [{ ...p, cx: at.cx, cy: at.cy, rot: at.rot }] : [];
	});
}

export function placementsOf(furn: Furniture[]): Placements {
	return Object.fromEntries(furn.map((f) => [f.id, { cx: f.cx, cy: f.cy, rot: f.rot }]));
}

/**
 * Placements from untrusted input (old storage, a request body): known Pieces only, finite
 * numbers, rotation in [0, 360). With `partial` (a Draft), missing or invalid Pieces are left
 * unplaced and the rest is pushed inside the walls; without it (a Published Design), every Piece
 * must be there and valid, else null.
 */
export function parsePlacements(src: unknown, partial: true): Placements;
export function parsePlacements(src: unknown, partial?: false): Placements | null;
export function parsePlacements(src: unknown, partial = false): Placements | null {
	const obj = src && typeof src === 'object' && !Array.isArray(src) ? src : {};
	const raw = obj as Record<string, unknown>;
	if (!partial && Object.keys(raw).sort().join() !== [...PIECE_IDS].sort().join()) return null;
	const out: Placements = {};
	for (const id of PIECE_IDS) {
		const v = raw[id] as Record<string, unknown> | undefined;
		const ok = v && [v.cx, v.cy, v.rot].every((n) => typeof n === 'number' && Number.isFinite(n));
		if (ok)
			out[id] = { cx: v.cx as number, cy: v.cy as number, rot: normalizeAngle(v.rot as number) };
		else if (!partial) return null;
	}
	if (partial) {
		const furn = designFurniture(out);
		for (const f of furn) keepInside(f, GEO);
		return placementsOf(furn);
	}
	return out;
}

/** Ids of the Pieces with a Conflict, in Inventory order. Same check on client and server. */
export function conflictIds(furn: Furniture[]): string[] {
	return furn.filter((f) => checkFurniture(f, furn, GEO).bad).map((f) => f.id);
}
