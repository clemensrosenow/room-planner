import { requireDevice, setLike } from '#lib/server/designs.ts';
import { respond } from '#lib/server/respond.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

/** Like (idempotent) → { likeCount } */
export const PUT: RequestHandler = ({ params, request }) =>
	respond(async () => ({
		likeCount: await setLike(params.id, await requireDevice(request), true)
	}));

/** Unlike (idempotent) → { likeCount } */
export const DELETE: RequestHandler = ({ params, request }) =>
	respond(async () => ({
		likeCount: await setLike(params.id, await requireDevice(request), false)
	}));
