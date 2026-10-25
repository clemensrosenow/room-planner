import type { Hinge, Point, RoomConfig, Swing } from './types';

/** Degrees a door must be able to open: a Piece in this part of its swing blocks it. */
export const MIN_OPEN = 45;

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
	/** End of the leaf opened MIN_OPEN degrees */
	clearEnd: Point;
}

/**
 * A fixed piece of furniture on the loggia, part of the Room and never a Piece: center and box in
 * cm, rotation in degrees clockwise in plan view (0 = front towards +y)
 */
export interface LoggiaItem {
	kind: 'table' | 'chair';
	name: string;
	cx: number;
	cy: number;
	w: number;
	d: number;
	h: number;
	rot: number;
	color: number;
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
	front: {
		wl: number;
		wr: number;
		gx0: number;
		gx1: number;
		gH: number;
		bOff: number;
		bW: number;
		/** Depth of the window bay: the wall pieces beside the glass end at y = L - bay */
		bay: number;
	};
	/** Radiator footprint in plan coordinates, and its height */
	radiator: { x0: number; x1: number; y0: number; y1: number; h: number } | null;
	/** Fixed ceiling lamp: model id and plan position */
	ceilingLamp: { model: string; x: number; y: number } | null;
	curtains: { color: number; x0: number; x1: number } | null;
	/** Table and chairs on the loggia; empty without a loggia */
	loggiaSet: LoggiaItem[];
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
	const bay = clamp(c.front.bay ?? 0, 0, L - N - 40, 'Window bay is deeper than the room.');
	const D = clamp(c.loggia.D, 0, 1000);
	const PH = clamp(c.loggia.parapetH, 0, 200);
	let radiator: Geometry['radiator'] = null;
	if (c.radiator) {
		// The right wall runs the full length; the left one starts at the hallway corner
		const wallLen = (c.radiator.wall === 'right' ? L : L - (hasNotch ? N : 0)) - bay;
		const w = clamp(c.radiator.w, 10, wallLen, 'Radiator is longer than its wall.');
		const off = clamp(c.radiator.off, 0, wallLen - w, 'Radiator extends past its wall.');
		const y1 = L - bay - off;
		const d = clamp(c.radiator.d, 2, 60);
		const x0 = c.radiator.wall === 'right' ? W - d : 0;
		radiator = { x0, x1: x0 + d, y0: y1 - w, y1, h: clamp(c.radiator.h, 10, H) };
	}
	const loggiaSet: LoggiaItem[] = [];
	if (c.loggiaSet && D > 0) {
		const msg = 'Loggia table and chairs do not fit on the loggia.';
		const t = c.loggiaSet.table;
		const ch = c.loggiaSet.chair;
		const table = { ...t, d: clamp(t.d, 10, D, msg) };
		const chair = { ...ch, w: clamp(ch.w, 10, D, msg) };
		const off = clamp(table.w / 2 + c.loggiaSet.gap + chair.d / 2, 0, (W - chair.d) / 2, msg);
		const [cx, cy] = [W / 2, L + tE + D / 2];
		// The chairs' fronts face the table: the left one turned to +x, the right one to -x
		loggiaSet.push(
			{ kind: 'table', name: 'Loggia table', cx, cy, rot: 0, ...table },
			{ kind: 'chair', name: 'Loggia chair', cx: cx - off, cy, rot: 270, ...chair },
			{ kind: 'chair', name: 'Loggia chair', cx: cx + off, cy, rot: 90, ...chair }
		);
	}

	// Floor outline; with a window bay the glass front sits `bay` deeper than the wall pieces
	const front: Point[] = bay
		? [
				[W, L - bay],
				[gx1, L - bay],
				[gx1, L],
				[gx0, L],
				[gx0, L - bay],
				[0, L - bay]
			]
		: [
				[W, L],
				[0, L]
			];
	const poly: Point[] = hasNotch
		? [[NW, 0], [W, 0], ...front, [0, N], [NW, N]]
		: [[0, 0], [W, 0], ...front];
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
		front: { wl, wr, gx0, gx1, gH, bOff, bW, bay },
		radiator,
		ceilingLamp: c.ceilingLamp
			? { ...c.ceilingLamp, x: clamp(c.ceilingLamp.x, 0, W), y: clamp(c.ceilingLamp.y, 0, L) }
			: null,
		curtains: c.curtains ?? null,
		loggiaSet,
		area: W * L - (hasNotch ? NW * N : 0),
		loggiaArea: W * D,
		issues
	};
}

/**
 * The floor as rectangles (main part, the strip beside the hallway corner, the window bay). A box
 * inside the floor always lies within one of them.
 */
export function floorRects(g: Geometry) {
	const end = g.L - g.front.bay;
	const top = g.hasNotch ? g.N : 0;
	const rects = [{ x0: 0, y0: top, x1: g.W, y1: end }];
	if (g.hasNotch) rects.push({ x0: g.NW, y0: 0, x1: g.W, y1: end });
	if (g.front.bay) {
		const { gx0, gx1 } = g.front;
		rects.push({ x0: gx0, y0: top, x1: gx1, y1: g.L });
		if (g.hasNotch && gx0 < g.W && gx1 > g.NW)
			rects.push({ x0: Math.max(gx0, g.NW), y0: 0, x1: gx1, y1: g.L });
	}
	return rects;
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
	const [c, s] = [Math.cos((MIN_OPEN * Math.PI) / 180), Math.sin((MIN_OPEN * Math.PI) / 180)];
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
		openEnd: [hx, hy + open[1] * w],
		clearEnd: [hx + (closed[0] * c + open[0] * s) * w, hy + (closed[1] * c + open[1] * s) * w]
	};
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
		// Wall pieces beside a window bay are as thick as the bay plus the exterior wall
		const isPiece = g.front.bay > 0 && S[1] === g.L - g.front.bay && E[1] === S[1];
		const t = isBottom ? g.tE : isPiece ? g.tE + g.front.bay : g.tI;
		return { S, E, len, d, n: [d[1], -d[0]], t, isBottom };
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
