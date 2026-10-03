import { MODELS, type Kind } from './catalog';
import { checkFurniture, keepInside, normalizeAngle } from './furniture';
import { computeGeometry } from './geometry';
import type { Furniture, RoomConfig } from './types';

/**
 * The one Room everybody furnishes, and its Inventory (ADR 0002). Designs only store where each
 * Piece stands, so changing anything here (measurements, sizes, colors, pieces) needs a new
 * ROOM_ID, which starts a fresh Leaderboard.
 */
export const ROOM_ID = 'clemens-v1';

/** Room inputs in cm. Origin is the top-left inner corner, y grows towards the loggia. */
export const ROOM: RoomConfig = {
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

export const GEO = computeGeometry(ROOM);

/** One real piece of furniture. Its size and color are fixed; Designs only move and turn it. */
export interface Piece {
	id: string;
	name: string;
	kind: Kind;
	w: number;
	d: number;
	h: number;
	/** Index into the furniture palette */
	color: number;
	/** Real 3D model (id in MODELS) */
	model?: string;
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
	color,
	model
});

export const INVENTORY: Piece[] = [
	{ id: 'bed', name: 'Boxspring bed', kind: 'bed', w: 140, d: 210, h: 50, color: 0 },
	{ id: 'wardrobe', name: 'Wardrobe', kind: 'wardrobe', w: 150, d: 70, h: 218, color: 4 },
	{ id: 'desk', name: 'Desk', kind: 'desk', w: 125, d: 50, h: 78, color: 1 },
	{ id: 'chair', name: 'Chair', kind: 'chair', w: 50, d: 50, h: 90, color: 3 },
	fromModel('kallax', 'Kallax', 'ikea-kallax', 0),
	{ id: 'nightstand', name: 'Nightstand', kind: 'nightstand', w: 38, d: 43, h: 63, color: 4 },
	fromModel('nymo-lamp', 'Nymo lamp', 'ikea-nymo-lamp', 2),
	fromModel('floor-lamp', 'Floor lamp', 'ikea-skaftet-lamp', 2),
	fromModel('ceiling-lamp', 'Ceiling lamp', 'ikea-ps2014-lamp', 2)
];

export const PIECE_IDS = INVENTORY.map((p) => p.id);

/** A starting arrangement without Conflicts, so a new Draft can be published right away. */
const DEFAULT_PLACEMENTS: Placements = {
	bed: { cx: 280, cy: 240, rot: 0 },
	wardrobe: { cx: 35, cy: 300, rot: 90 },
	desk: { cx: 62.5, cy: 475, rot: 0 },
	chair: { cx: 75, cy: 420, rot: 0 },
	kallax: { cx: 15.5, cy: 414.5, rot: 90 },
	nightstand: { cx: 189, cy: 157.5, rot: 0 },
	'nymo-lamp': { cx: 189, cy: 157.5, rot: 0 },
	'floor-lamp': { cx: 288.95, cy: 63.65, rot: 0 },
	'ceiling-lamp': { cx: 175, cy: 300, rot: 0 }
};

export const defaultPlacements = (): Placements => structuredClone(DEFAULT_PLACEMENTS);

/** The full furniture of a Design: every Piece of the Inventory at its placement. */
export function designFurniture(placements: Placements): Furniture[] {
	return INVENTORY.map((p) => {
		const at = placements[p.id] ?? DEFAULT_PLACEMENTS[p.id];
		return { ...p, cx: at.cx, cy: at.cy, rot: at.rot };
	});
}

export function placementsOf(furn: Furniture[]): Placements {
	return Object.fromEntries(furn.map((f) => [f.id, { cx: f.cx, cy: f.cy, rot: f.rot }]));
}

/**
 * Placements from untrusted input (old storage, a request body): known Pieces only, finite
 * numbers, rotation in [0, 360). With `fill`, missing Pieces get their default placement and
 * everything is pushed inside the walls; without it, anything missing or invalid returns null.
 */
export function parsePlacements(src: unknown, fill: true): Placements;
export function parsePlacements(src: unknown, fill?: false): Placements | null;
export function parsePlacements(src: unknown, fill = false): Placements | null {
	const obj = src && typeof src === 'object' && !Array.isArray(src) ? src : {};
	const raw = obj as Record<string, unknown>;
	if (!fill && Object.keys(raw).sort().join() !== [...PIECE_IDS].sort().join()) return null;
	const out: Placements = {};
	for (const id of PIECE_IDS) {
		const v = raw[id] as Record<string, unknown> | undefined;
		const ok = v && [v.cx, v.cy, v.rot].every((n) => typeof n === 'number' && Number.isFinite(n));
		if (ok) out[id] = { cx: v.cx as number, cy: v.cy as number, rot: normalizeAngle(v.rot as number) };
		else if (fill) out[id] = { ...DEFAULT_PLACEMENTS[id] };
		else return null;
	}
	if (fill) {
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

/** Whether two sets of placements put every Piece in the same spot (within 0.5 cm / 0.5°). */
export function samePlacements(a: Placements, b: Placements) {
	return PIECE_IDS.every((id) => {
		const p = a[id];
		const q = b[id];
		if (!p || !q) return p === q;
		const dRot = Math.abs(normalizeAngle(p.rot - q.rot + 180) - 180);
		return Math.abs(p.cx - q.cx) < 0.5 && Math.abs(p.cy - q.cy) < 0.5 && dRot < 0.5;
	});
}
