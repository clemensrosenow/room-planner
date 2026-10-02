export const cm = (v: number) => String(Math.round(v));
export const m2 = (v: number) => (v / 10000).toFixed(1) + ' m²';
export const newId = () => 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

/** Reads a CSS custom property from :root, e.g. cssVar('--ink'). */
export const cssVar = (name: string) =>
	getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#888';
