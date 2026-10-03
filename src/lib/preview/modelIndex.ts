/**
 * One entry of `static/models/index.json`, written by `npm run models` (scripts/convert-models.ts).
 * Facts measured from each converted model, in the app's units.
 */
export interface ConvertedModel {
	id: string;
	/** URL of the GLB, e.g. '/models/ikea-kallax.glb' */
	file: string;
	/** cm, from the model's bounding box */
	size: { w: number; d: number; h: number };
	/** Floor pieces have their origin at the floor center, ceiling pieces at the top center */
	mount: 'floor' | 'ceiling';
	/** Triangles drawn, after simplification */
	triangles: number;
	/** Triangles drawn before simplification */
	trianglesBefore: number;
	bytes: number;
}

export const MODEL_INDEX_URL = '/models/index.json';

export async function loadModelIndex(): Promise<ConvertedModel[]> {
	const res = await fetch(MODEL_INDEX_URL);
	if (!res.ok) throw new Error(`${MODEL_INDEX_URL}: ${res.status}`);
	return res.json();
}
