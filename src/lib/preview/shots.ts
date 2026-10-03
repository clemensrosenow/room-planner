import type { Geometry } from '../planner/geometry';

/** Camera position and look-at target in plan units: [x, height, y] in cm. */
export interface Shot {
	id: string;
	label: string;
	pos: [number, number, number];
	target: [number, number, number];
	/** Hide the ceiling (view from above) */
	cutaway?: boolean;
}

export const EYE = 160;

/** Viewpoints derived from the room: door, window, every convex corner, from above. */
export function makeShots(g: Geometry): Shot[] {
	const door = g.doors[0];
	const doorX = (door.x0 + door.x1) / 2;
	// Center of the main (non-notch) part of the room
	const cx = g.W / 2;
	const cy = g.hasNotch ? (g.N + g.L) / 2 : g.L / 2;
	const shots: Shot[] = [
		{
			id: 'door',
			label: 'Door',
			pos: [doorX, EYE, g.doorY + 25],
			target: [g.W / 2, 110, g.L]
		},
		{
			id: 'window',
			label: 'Window',
			pos: [g.W / 2, EYE, g.L - 25],
			target: [cx, 100, g.hasNotch ? g.N : 0]
		}
	];

	// Convex corners of the floor outline, camera pulled 40 cm into the room
	const P = g.poly;
	let n = 1;
	P.forEach((p, i) => {
		const prev = P[(i - 1 + P.length) % P.length];
		const next = P[(i + 1) % P.length];
		const a = [p[0] - prev[0], p[1] - prev[1]];
		const b = [next[0] - p[0], next[1] - p[1]];
		if (a[0] * b[1] - a[1] * b[0] <= 0) return; // reflex corner of the notch
		const ix = Math.sign(cx - p[0]) || 1;
		const iy = Math.sign(cy - p[1]) || 1;
		shots.push({
			id: 'corner' + n,
			label: 'Corner ' + n++,
			pos: [p[0] + ix * 40, EYE, p[1] + iy * 40],
			target: [cx, 80, cy]
		});
	});

	const size = Math.max(g.W, g.L);
	shots.push({
		id: 'above',
		label: 'Above',
		pos: [g.W / 2 - size * 0.25, size * 1.25, g.L / 2 + size * 0.55],
		target: [g.W / 2, 0, g.L / 2],
		cutaway: true
	});
	return shots;
}
