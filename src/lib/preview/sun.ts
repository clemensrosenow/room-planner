import * as THREE from 'three';

/** Location used for the sun path (central Germany). */
const LATITUDE = 51;
const LONGITUDE = 10;

/** UTC offset of German clock time (CET +1, CEST +2) on a date. */
function clockOffset(date: Date) {
	try {
		const s = date.toLocaleString('en-US', {
			timeZone: 'Europe/Berlin',
			timeZoneName: 'shortOffset'
		});
		const m = s.match(/GMT([+-]\d+)/);
		if (m) return Number(m[1]);
	} catch {
		// Old browser without time zone data
	}
	return 1;
}

/** German clock time → local solar time (hours), including the equation of time. */
export function solarTime(clockHours: number, day = dayOfYear(), date = new Date()) {
	const b = (2 * Math.PI * (day - 81)) / 364;
	const equation = 9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b);
	return clockHours - clockOffset(date) + LONGITUDE / 15 + equation / 60;
}

/**
 * Direction towards the sun in world space for a German clock time (hours) and day of the
 * year. The glass front faces east, i.e. world +z is east, +x is north.
 */
export function sunDirection(hours: number, dayOfYear: number) {
	const rad = Math.PI / 180;
	const phi = LATITUDE * rad;
	const decl = 23.44 * rad * Math.sin((2 * Math.PI * (284 + dayOfYear)) / 365);
	const hourAngle = (solarTime(hours, dayOfYear) - 12) * 15 * rad;
	const east = -Math.cos(decl) * Math.sin(hourAngle);
	const north =
		Math.sin(decl) * Math.cos(phi) - Math.cos(decl) * Math.cos(hourAngle) * Math.sin(phi);
	const up = Math.sin(decl) * Math.sin(phi) + Math.cos(decl) * Math.cos(hourAngle) * Math.cos(phi);
	return new THREE.Vector3(north, up, east).normalize();
}

export function dayOfYear(date = new Date()) {
	return Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86_400_000);
}

/** Sun color and strength by elevation: warm and weak near the horizon, off below it. */
export function sunLight(elevation: number) {
	const t = THREE.MathUtils.smoothstep(elevation, -0.02, 0.35);
	const color = new THREE.Color(1, 0.55, 0.3).lerp(new THREE.Color(1, 0.96, 0.9), t);
	const intensity = 4.5 * THREE.MathUtils.smoothstep(elevation, -0.02, 0.12);
	// Diffuse daylight from the sky, fades out through twilight (sun down to about -11°)
	const daylight = THREE.MathUtils.smoothstep(elevation, -0.2, 0.25);
	return { color, intensity, daylight };
}

export const formatTime = (hours: number) =>
	`${String(Math.floor(hours)).padStart(2, '0')}:${String(Math.round((hours % 1) * 60)).padStart(2, '0')}`;

/**
 * CSS gradient of the sky over the slider range (5:00–21:30) for today: night, twilight,
 * golden hour and day, following the real sun elevation.
 */
export function dayGradient(from = 5, to = 21.5, day = dayOfYear()) {
	const stops: [number, THREE.Color][] = [
		[-0.2, new THREE.Color('#2f3763')],
		[-0.06, new THREE.Color('#7d5a7e')],
		[0.03, new THREE.Color('#ee9f6c')],
		[0.15, new THREE.Color('#f4d5a2')],
		[0.35, new THREE.Color('#d3e4ee')]
	];
	const colorAt = (elevation: number) => {
		if (elevation <= stops[0][0]) return stops[0][1];
		for (let i = 1; i < stops.length; i++) {
			const [e1, c1] = stops[i];
			const [e0, c0] = stops[i - 1];
			if (elevation <= e1) return c0.clone().lerp(c1, (elevation - e0) / (e1 - e0));
		}
		return stops[stops.length - 1][1];
	};
	const n = 24;
	const parts = Array.from({ length: n + 1 }, (_, i) => {
		const h = from + ((to - from) * i) / n;
		return `#${colorAt(sunDirection(h, day).y).getHexString()} ${((i / n) * 100).toFixed(1)}%`;
	});
	return `linear-gradient(to right, ${parts.join(', ')})`;
}
