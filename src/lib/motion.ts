/** Animation length in ms, or 0 when the user prefers reduced motion. */
export function duration(ms: number) {
	if (typeof matchMedia === 'undefined') return ms;
	return matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : ms;
}
