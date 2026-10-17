import { HttpFail, requireDevice } from '#lib/server/designs.ts';
import { castDuel, parseCastDuel } from '#lib/server/duels.ts';
import { respond } from '#lib/server/respond.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

/** Judge a pair: { a, b, winner } with winner = a, b or null for Skip → 201 */
export const POST: RequestHandler = ({ request }) =>
	respond(async () => {
		const hash = await requireDevice(request);
		const body = await request.json().catch(() => {
			throw new HttpFail(400, 'Invalid JSON');
		});
		const { a, b, winner } = parseCastDuel(body);
		await castDuel(hash, a, b, winner);
		return { ok: true };
	}, 201);
