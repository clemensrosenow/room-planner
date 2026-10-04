export const cm = (v: number) => String(Math.round(v));
export const m2 = (v: number) => (v / 10000).toFixed(1) + ' m²';
export const newId = () => 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

/** sRGB hex number as a CSS color, e.g. 0x1c2741 → '#1c2741'. */
export const hexColor = (n: number) => '#' + n.toString(16).padStart(6, '0');

/** Whether text on this color should be light. */
export function isDark(n: number) {
	const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255];
	return 0.299 * r + 0.587 * g + 0.114 * b < 140;
}

/** Reads a CSS custom property from :root, e.g. cssVar('--ink'). */
export const cssVar = (name: string) =>
	getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#888';
