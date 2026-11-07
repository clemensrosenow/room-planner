import { MODELS } from '../planner/catalog';
import type { Geometry } from '../planner/geometry';
import type { Furniture } from '../planner/types';

/** Model downloads can start before the renderer module loads or builds stand-ins. */
export function previewModelIds(g: Geometry, furn: Furniture[]): string[] {
	const ids = new Set<string>();
	const add = (id: string | undefined) => {
		if (id && Object.hasOwn(MODELS, id)) ids.add(id);
	};
	if (g.radiator) add('radiator');
	add(g.ceilingLamp?.model);
	for (const piece of furn) {
		if (piece.parts) for (const part of piece.parts) add(part.model);
		else add(piece.model);
	}
	return [...ids];
}
