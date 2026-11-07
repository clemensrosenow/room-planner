/** Production builds include losslessly compressed sidecars; dev keeps the original URLs. */
export function modelUrl(id: string) {
	const compressed = import.meta.env.PROD && typeof DecompressionStream === 'function';
	return `/models/${encodeURIComponent(id)}.glb${compressed ? '.gz' : ''}`;
}
