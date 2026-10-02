import type { Hinge, Point, RoomConfig, Swing } from './types';

export interface Door {
	key: 'door' | 'balcony';
	name: string;
	x0: number;
	x1: number;
	/** y of the wall's inner face */
	y: number;
	/** Wall thickness */
	t: number;
	w: number;
	h: number;
	glass: boolean;
	inward: boolean;
	/** Hinge point */
	hinge: Point;
	/** Unit vector of the closed leaf (from hinge) */
	closed: Point;
	/** Unit vector of the fully open leaf (from hinge) */
	open: Point;
	closedEnd: Point;
	openEnd: Point;
}

export interface Geometry {
	W: number;
	L: number;
	H: number;
	NW: number;
	N: number;
	tI: number;
	tE: number;
	/** Loggia depth and parapet height */
	D: number;
	PH: number;
	hasNotch: boolean;
	/** y and length of the wall holding the room door */
	doorY: number;
	doorWallLen: number;
	/** Floor outline, clockwise */
	poly: Point[];
	doors: [Door, Door];
	front: { wl: number; wr: number; gx0: number; gx1: number; gH: number; bOff: number; bW: number };
	area: number;
	loggiaArea: number;
	/** Human-readable problems with the inputs (values were clamped) */
	issues: string[];
}

/** Turns the raw inputs into clamped, consistent room geometry. */
export function computeGeometry(c: RoomConfig): Geometry {
	const issues: string[] = [];
	const clamp = (v: number, lo: number, hi: number, msg?: string) => {
		const r = Math.min(Math.max(v, lo), Math.max(lo, hi));
		if (msg && Math.abs(r - v) > 0.01 && !issues.includes(msg)) issues.push(msg);
		return r;
	};
	const W = clamp(c.W, 100, 2000, 'Total width is outside 100–2000 cm.');
	const L = clamp(c.L, 100, 2000, 'Length is outside 100–2000 cm.');
	const H = clamp(c.H, 150, 500, 'Ceiling height is outside 150–500 cm.');
	const tI = clamp(c.tI, 4, 60);
	const tE = clamp(c.tE, 4, 80);
	const NW = clamp(c.NW, 0, W - 40, 'Hallway corner is wider than the room. Reduce its width.');
	const N = clamp(c.N, 0, L - 40, 'Hallway corner is deeper than the room. Reduce its depth.');
	const hasNotch = NW > 0 && N > 0;
	const doorY = hasNotch ? N : 0;
	const doorWallLen = hasNotch ? NW : W;
	const dW = clamp(c.door.w, 40, doorWallLen, 'Room door is wider than its wall.');
	const dOff = clamp(
		c.door.off,
		0,
		doorWallLen - dW,
		'Room door extends past its wall. Check offset or width.'
	);
	const dH = clamp(c.door.h, 150, H, 'Door height is greater than the ceiling height.');
	const wl = clamp(c.front.wl, 0, W - 40, 'Left wall section is too wide.');
	const wr = clamp(
		c.front.wr,
		0,
		W - wl - 40,
		'Left and right wall sections leave no glass front.'
	);
	const gx0 = wl;
	const gx1 = W - wr;
	const gH = clamp(c.front.glassH, 100, H, 'Glass front is taller than the room.');
	const bW = clamp(c.front.door.w, 40, gx1 - gx0, 'Balcony door is wider than the glass front.');
	const bOff = clamp(
		c.front.door.off,
		gx0,
		gx1 - bW,
		'Balcony door lies outside the glass front. Check its offset from the left wall.'
	);
	const D = clamp(c.loggia.D, 0, 1000);
	const PH = clamp(c.loggia.parapetH, 0, 200);

	const poly: Point[] = hasNotch
		? [
				[NW, 0],
				[W, 0],
				[W, L],
				[0, L],
				[0, N],
				[NW, N]
			]
		: [
				[0, 0],
				[W, 0],
				[W, L],
				[0, L]
			];
	const doors: [Door, Door] = [
		makeDoor(
			'door',
			'room door',
			dOff,
			dOff + dW,
			doorY,
			tI,
			-1,
			c.door.hinge,
			c.door.swing,
			dH,
			false
		),
		makeDoor(
			'balcony',
			'balcony door',
			bOff,
			bOff + bW,
			L,
			tE,
			1,
			c.front.door.hinge,
			c.front.door.swing,
			gH,
			true
		)
	];

	return {
		W,
		L,
		H,
		NW,
		N,
		tI,
		tE,
		D,
		PH,
		hasNotch,
		doorY,
		doorWallLen,
		poly,
		doors,
		front: { wl, wr, gx0, gx1, gH, bOff, bW },
		area: W * L - (hasNotch ? NW * N : 0),
		loggiaArea: W * D,
		issues
	};
}

/** outSign: direction (in y) that points out of the room through this wall. */
function makeDoor(
	key: Door['key'],
	name: string,
	x0: number,
	x1: number,
	y: number,
	t: number,
	outSign: number,
	hinge: Hinge,
	swing: Swing,
	h: number,
	glass: boolean
): Door {
	const w = x1 - x0;
	const left = hinge !== 'right';
	const inward = swing !== 'out';
	const hx = left ? x0 : x1;
	const hy = inward ? y : y + outSign * t;
	const closed: Point = left ? [1, 0] : [-1, 0];
	const open: Point = inward ? [0, -outSign] : [0, outSign];
	return {
		key,
		name,
		x0,
		x1,
		y,
		t,
		w,
		h,
		glass,
		inward,
		hinge: [hx, hy],
		closed,
		open,
		closedEnd: [hx + closed[0] * w, hy],
		openEnd: [hx, hy + open[1] * w]
	};
}

export function inRoom(g: Geometry, x: number, y: number, eps = 0.5) {
	const { W, L, NW, N, hasNotch } = g;
	if (!hasNotch) return x >= -eps && x <= W + eps && y >= -eps && y <= L + eps;
	return (
		(x >= -eps && x <= W + eps && y >= N - eps && y <= L + eps) ||
		(x >= NW - eps && x <= W + eps && y >= -eps && y <= N + eps)
	);
}

export interface WallEdge {
	S: Point;
	E: Point;
	len: number;
	/** Unit direction and outward normal */
	d: Point;
	n: Point;
	t: number;
	isBottom: boolean;
}

/** A wall piece along an edge, from u0 to u1 (along the edge) and h0 to h1 (height). */
export interface WallSegment {
	e: WallEdge;
	u0: number;
	u1: number;
	h0: number;
	h1: number;
}

/** Walls as segments along the room edges (lying outside the floor), with door/glass openings cut out. */
export function buildWalls(g: Geometry, wallH: number) {
	const P = g.poly;
	const m = P.length;
	const edges: WallEdge[] = P.map((S, i) => {
		const E = P[(i + 1) % m];
		const len = Math.hypot(E[0] - S[0], E[1] - S[1]);
		const d: Point = [(E[0] - S[0]) / len, (E[1] - S[1]) / len];
		const isBottom = S[1] === g.L && E[1] === g.L;
		return { S, E, len, d, n: [d[1], -d[0]], t: isBottom ? g.tE : g.tI, isBottom };
	});
	// Convex corners need the walls extended so they meet
	const convex = P.map((_, i) => {
		const a = edges[(i - 1 + m) % m].d;
		const b = edges[i].d;
		return a[0] * b[1] - a[1] * b[0] > 0;
	});
	const segs: WallSegment[] = [];
	edges.forEach((e, i) => {
		const extS = convex[i] ? edges[(i - 1 + m) % m].t : 0;
		const extE = convex[(i + 1) % m] ? edges[(i + 1) % m].t : 0;
		const toU = (x: number) => (x - e.S[0]) * e.d[0];
		const openings: { u0: number; u1: number; top: number }[] = [];
		const isDoorWall =
			!e.isBottom &&
			e.d[1] === 0 &&
			e.S[1] === g.doorY &&
			Math.min(e.S[0], e.E[0]) === 0 &&
			Math.max(e.S[0], e.E[0]) === g.doorWallLen;
		const addOpening = (x0: number, x1: number, top: number) => {
			const a = toU(x0);
			const b = toU(x1);
			openings.push({ u0: Math.min(a, b), u1: Math.max(a, b), top });
		};
		if (isDoorWall) addOpening(g.doors[0].x0, g.doors[0].x1, g.doors[0].h);
		if (e.isBottom) addOpening(g.front.gx0, g.front.gx1, g.front.gH);
		openings.sort((a, b) => a.u0 - b.u0);
		let cur = -extS;
		for (const o of openings) {
			if (o.u0 > cur + 0.01) segs.push({ e, u0: cur, u1: o.u0, h0: 0, h1: wallH });
			if (o.top < wallH - 0.01) segs.push({ e, u0: o.u0, u1: o.u1, h0: o.top, h1: wallH });
			cur = o.u1;
		}
		if (e.len + extE > cur + 0.01) segs.push({ e, u0: cur, u1: e.len + extE, h0: 0, h1: wallH });
	});
	return { edges, segs };
}

/** Footprint of a wall segment as a polygon in plan coordinates. */
export function segmentPolygon(s: WallSegment): Point[] {
	const { S, d, n, t } = s.e;
	const A: Point = [S[0] + d[0] * s.u0, S[1] + d[1] * s.u0];
	const B: Point = [S[0] + d[0] * s.u1, S[1] + d[1] * s.u1];
	return [A, B, [B[0] + n[0] * t, B[1] + n[1] * t], [A[0] + n[0] * t, A[1] + n[1] * t]];
}
