import { deviceHash, getDesign, HttpFail, remove, requireDevice } from '#lib/server/designs.ts';
import { respond } from '#lib/server/respond.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

export const GET: RequestHandler = ({ params, request }) =>
	respond(async () => {
		const design = await getDesign(params.id, await deviceHash(request));
		if (!design) throw new HttpFail(404, 'Design not found');
		return design;
	});

/** Only the Device that published it */
export const DELETE: RequestHandler = ({ params, request }) =>
	respond(async () => {
		await remove(params.id, await requireDevice(request));
		return { ok: true };
	});
