import { inRoom, type Geometry } from './geometry';
import type { Furniture, Point } from './types';

export interface FurnitureCheck {
	out: boolean;
	/** Names of doors whose swing area the piece blocks */
	doors: string[];
	/** Names of overlapping pieces */
	overlap: string[];
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

export function checkFurniture(f: Furniture, all: Furniture[], g: Geometry): FurnitureCheck {
	const pts = samplePoints(f, 5);
	const out = pts.some((p) => !inRoom(g, p[0], p[1]));
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
	const overlap = all.filter((o) => o !== f && overlaps(f, o)).map((o) => o.name || 'Box');
	return { out, doors, overlap, bad: out || doors.length > 0 || overlap.length > 0 };
}

/* ---------- Edits (mutate the piece in place) ---------- */

export const normalizeAngle = (deg: number) => ((deg % 360) + 360) % 360;

/** Changes width/depth/height while keeping the left and top edge in place. */
export function setSize(f: Furniture, key: 'w' | 'd' | 'h', value: number) {
	const before = bbox(f);
	f[key] = Math.max(1, value);
	const after = bbox(f);
	f.cx += before.minX - after.minX;
	f.cy += before.minY - after.minY;
}

/** Moves the piece so its bounding box starts at x / y. */
export function setPosition(f: Furniture, axis: 'x' | 'y', value: number) {
	const b = bbox(f);
	if (axis === 'x') f.cx += value - b.minX;
	else f.cy += value - b.minY;
}

/** Snap distance in cm while dragging. */
const SNAP = 5;

/**
 * Moves the piece's center to (cx, cy). With `snap`, edges within a few cm of a wall
 * or another piece's edge are pulled flush to it.
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
	if (!snap) return;
	const b = bbox(f);
	const rest = others.filter((o) => o !== f).map(bbox);
	const xs = [0, g.W, ...(g.hasNotch ? [g.NW] : []), ...rest.flatMap((o) => [o.minX, o.maxX])];
	const ys = [0, g.L, ...(g.hasNotch ? [g.N] : []), ...rest.flatMap((o) => [o.minY, o.maxY])];
	f.cx += nearestOffset([b.minX, b.maxX], xs);
	f.cy += nearestOffset([b.minY, b.maxY], ys);
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
