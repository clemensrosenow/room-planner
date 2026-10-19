import { modelInfo } from './catalog';
import { floorRects, type Geometry } from './geometry';
import type { Furniture, Point } from './types';

export interface FurnitureCheck {
	/** Names of doors whose swing area the piece blocks */
	doors: string[];
	/** Names of overlapping pieces */
	overlap: string[];
	/** Sticks out of the room */
	outside: boolean;
	bad: boolean;
}

/** Maps a local point (relative to the center, unrotated) to plan coordinates. */
function toPlan(f: Furniture, px: number, py: number): Point {
	const a = (f.rot * Math.PI) / 180;
	const c = Math.cos(a);
	const s = Math.sin(a);
	return [f.cx + px * c - py * s, f.cy + px * s + py * c];
}

export function corners(f: Furniture): Point[] {
	return [
		[-1, -1],
		[1, -1],
		[1, 1],
		[-1, 1]
	].map(([sx, sy]) => toPlan(f, (sx * f.w) / 2, (sy * f.d) / 2));
}

export function bbox(f: Furniture) {
	const cs = corners(f);
	const xs = cs.map((p) => p[0]);
	const ys = cs.map((p) => p[1]);
	return {
		minX: Math.min(...xs),
		maxX: Math.max(...xs),
		minY: Math.min(...ys),
		maxY: Math.max(...ys)
	};
}

/** Grid of points covering the footprint, spaced at most `step` cm apart. */
function samplePoints(f: Furniture, step: number): Point[] {
	const nx = Math.max(1, Math.ceil(f.w / step));
	const ny = Math.max(1, Math.ceil(f.d / step));
	const pts: Point[] = [];
	for (let i = 0; i <= nx; i++)
		for (let j = 0; j <= ny; j++)
			pts.push(toPlan(f, -f.w / 2 + (f.w * i) / nx, -f.d / 2 + (f.d * j) / ny));
	return pts;
}

/** Whether a plan point lies on the piece's footprint. */
function covers(f: Furniture, x: number, y: number) {
	const a = (f.rot * Math.PI) / 180;
	const dx = x - f.cx;
	const dy = y - f.cy;
	const lx = dx * Math.cos(a) + dy * Math.sin(a);
	const ly = -dx * Math.sin(a) + dy * Math.cos(a);
	return Math.abs(lx) <= f.w / 2 && Math.abs(ly) <= f.d / 2;
}

/**
 * The piece a small item (e.g. a table lamp) stands on: the highest floor piece under its
 * center. Null for everything else, which stands on the floor or hangs from the ceiling.
 */
export function supportOf(f: Furniture, all: Furniture[]): Furniture | null {
	if (!modelInfo(f)?.onTop) return null;
	let best: Furniture | null = null;
	for (const o of all) {
		const m = modelInfo(o);
		if (o === f || m?.onTop || m?.mount === 'ceiling' || !covers(o, f.cx, f.cy)) continue;
		if (!best || surface(o) > surface(best)) best = o;
	}
	return best;
}

/** Height small items stand on. */
const surface = (f: Furniture) => f.top ?? f.h;

/** Height (cm) the piece's bottom stands at: 0 on the floor, the support's top otherwise. */
export function elevation(f: Furniture, all: Furniture[]) {
	const support = supportOf(f, all);
	return support ? surface(support) : 0;
}

/** Separating axis test; touching (< 0.5 cm overlap) does not count. */
function overlaps(a: Furniture, b: Furniture) {
	const A = corners(a);
	const B = corners(b);
	for (const poly of [A, B])
		for (let i = 0; i < 2; i++) {
			const p = poly[i];
			const q = poly[i + 1];
			const axis = [q[1] - p[1], p[0] - q[0]];
			const proj = (P: Point[]) => P.map((v) => v[0] * axis[0] + v[1] * axis[1]);
			const pa = proj(A);
			const pb = proj(B);
			const overlap =
				Math.min(Math.max(...pa), Math.max(...pb)) - Math.max(Math.min(...pa), Math.min(...pb));
			if (overlap / Math.hypot(axis[0], axis[1]) < 0.5) return false;
		}
	return true;
}

/** The radiator as a box, for overlap tests. */
function radiatorBox(g: Geometry): Furniture | null {
	const r = g.radiator;
	if (!r) return null;
	return {
		id: 'radiator',
		name: 'Radiator',
		w: r.x1 - r.x0,
		d: r.y1 - r.y0,
		h: r.h,
		cx: (r.x0 + r.x1) / 2,
		cy: (r.y0 + r.y1) / 2,
		rot: 0,
		color: 0
	};
}

/**
 * Doors blocked and pieces (or the radiator) overlapped. Ceiling lamps hang above everything,
 * and a piece standing on another doesn't overlap it.
 */
export function checkFurniture(f: Furniture, all: Furniture[], g: Geometry): FurnitureCheck {
	const outside = !insideRoom(f, g);
	if (modelInfo(f)?.mount === 'ceiling') return { doors: [], overlap: [], outside, bad: outside };
	const pts = samplePoints(f, 5);
	const support = supportOf(f, all);
	const doors = g.doors
		.filter(
			(dr) =>
				dr.inward &&
				pts.some((p) => {
					const v = [p[0] - dr.hinge[0], p[1] - dr.hinge[1]];
					return (
						Math.hypot(v[0], v[1]) < dr.w - 0.5 &&
						v[0] * dr.closed[0] + v[1] * dr.closed[1] > 0.5 &&
						v[0] * dr.open[0] + v[1] * dr.open[1] > 0.5
					);
				})
		)
		.map((dr) => dr.name);
	const overlap = all
		.filter(
			(o) =>
				o !== f &&
				o !== support &&
				supportOf(o, all) !== f &&
				modelInfo(o)?.mount !== 'ceiling' &&
				overlaps(f, o)
		)
		.map((o) => o.name || 'Box');
	const radiator = radiatorBox(g);
	if (radiator && !support && overlaps(f, radiator)) overlap.push(radiator.name);
	return { doors, overlap, outside, bad: outside || doors.length > 0 || overlap.length > 0 };
}

/** Problems in plain words, e.g. ["Blocks the room door", "Overlaps Desk"]. */
export function describeCheck(c: FurnitureCheck | undefined): string[] {
	if (!c) return [];
	return [
		...(c.outside ? ['Sticks out of the room'] : []),
		...c.doors.map((d) => `Blocks the ${d}`),
		...c.overlap.map((n) => `Overlaps ${n}`)
	];
}

/* ---------- Edits (mutate the piece in place) ---------- */

export const normalizeAngle = (deg: number) => ((deg % 360) + 360) % 360;

/** Moves the piece so its bounding box starts at x / y. */
export function setPosition(f: Furniture, axis: 'x' | 'y', value: number, g: Geometry) {
	const b = bbox(f);
	if (axis === 'x') f.cx += value - b.minX;
	else f.cy += value - b.minY;
	keepInside(f, g);
}

/** Whether the piece's bounding box lies within the walls (0.5 cm tolerance). */
export function insideRoom(f: Furniture, g: Geometry) {
	const b = bbox(f);
	return floorRects(g).some(
		(r) => b.minX > r.x0 - 0.5 && b.maxX < r.x1 + 0.5 && b.minY > r.y0 - 0.5 && b.maxY < r.y1 + 0.5
	);
}

/**
 * Shifts the piece the shortest way so its bounding box lies within the walls. Only parts of the
 * floor the piece fits into count; a piece too big for all of them is centered in the largest.
 * Returns whether the piece moved.
 */
export function keepInside(f: Furniture, g: Geometry): boolean {
	const b = bbox(f);
	/** Shift along one axis that moves [lo, hi] into [r0, r1], centered if it doesn't fit */
	const shift = (lo: number, hi: number, r0: number, r1: number) =>
		hi - lo > r1 - r0 ? (r0 + r1 - lo - hi) / 2 : Math.max(0, r0 - lo) + Math.min(0, r1 - hi);
	const rects = floorRects(g);
	const fits = rects.filter(
		(r) => b.maxX - b.minX <= r.x1 - r.x0 && b.maxY - b.minY <= r.y1 - r.y0
	);
	const area = (r: (typeof rects)[number]) => (r.x1 - r.x0) * (r.y1 - r.y0);
	const largest = rects.reduce((a, r) => (area(r) > area(a) ? r : a));
	let best: { dx: number; dy: number } | null = null;
	for (const r of fits.length ? fits : [largest]) {
		const dx = shift(b.minX, b.maxX, r.x0, r.x1);
		const dy = shift(b.minY, b.maxY, r.y0, r.y1);
		if (!best || Math.hypot(dx, dy) < Math.hypot(best.dx, best.dy)) best = { dx, dy };
	}
	if (!best || (Math.abs(best.dx) < 0.01 && Math.abs(best.dy) < 0.01)) return false;
	f.cx += best.dx;
	f.cy += best.dy;
	return true;
}

/** Snap distance in cm while dragging. */
const SNAP = 5;

/**
 * Moves the piece's center to (cx, cy), but never through a wall. With `snap`, edges within a
 * few cm of a wall or another piece's edge are pulled flush to it.
 */
export function moveTo(
	f: Furniture,
	cx: number,
	cy: number,
	others: Furniture[],
	g: Geometry,
	snap: boolean
) {
	f.cx = Math.round(cx);
	f.cy = Math.round(cy);
	if (snap) {
		const b = bbox(f);
		const radiator = radiatorBox(g);
		const rest = [...others.filter((o) => o !== f), ...(radiator ? [radiator] : [])].map(bbox);
		const bay = g.front.bay ? [g.front.gx0, g.front.gx1] : [];
		const xs = [
			0,
			g.W,
			...(g.hasNotch ? [g.NW] : []),
			...bay,
			...rest.flatMap((o) => [o.minX, o.maxX])
		];
		const ys = [
			0,
			g.L,
			...(g.hasNotch ? [g.N] : []),
			...(g.front.bay ? [g.L - g.front.bay] : []),
			...rest.flatMap((o) => [o.minY, o.maxY])
		];
		f.cx += nearestOffset([b.minX, b.maxX], xs);
		f.cy += nearestOffset([b.minY, b.maxY], ys);
	}
	keepInside(f, g);
}

/** Smallest shift (within SNAP) that puts one of `edges` onto one of `lines`, else 0. */
function nearestOffset(edges: number[], lines: number[]) {
	let best = 0;
	for (const e of edges)
		for (const l of lines) {
			const d = l - e;
			if (Math.abs(d) <= SNAP && (best === 0 || Math.abs(d) < Math.abs(best))) best = d;
		}
	return best;
}
