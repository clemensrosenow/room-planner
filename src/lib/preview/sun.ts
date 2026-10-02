import * as THREE from 'three';

/** Latitude used for the sun path (central Germany). */
const LATITUDE = 51;

/**
 * Direction towards the sun in world space for a time of day (hours, local solar time)
 * and day of the year. The glass front faces east, i.e. world +z is east, +x is north.
 */
export function sunDirection(hours: number, dayOfYear: number) {
	const rad = Math.PI / 180;
	const phi = LATITUDE * rad;
	const decl = 23.44 * rad * Math.sin((2 * Math.PI * (284 + dayOfYear)) / 365);
	const hourAngle = (hours - 12) * 15 * rad;
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
	// Diffuse daylight from the sky, fades out after sunset
	const daylight = THREE.MathUtils.smoothstep(elevation, -0.15, 0.25);
	return { color, intensity, daylight };
}

export const formatTime = (hours: number) =>
	`${String(Math.floor(hours)).padStart(2, '0')}:${String(Math.round((hours % 1) * 60)).padStart(2, '0')}`;
