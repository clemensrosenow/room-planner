import {
	deviceHash,
	HttpFail,
	listDesigns,
	parsePublish,
	publish,
	requireDevice
} from '#lib/server/designs.ts';
import { respond } from '#lib/server/respond.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

/** The whole Leaderboard: ?sort=top|new → { designs } */
export const GET: RequestHandler = ({ url, request }) =>
	respond(async () =>
		listDesigns(url.searchParams.get('sort') === 'new' ? 'new' : 'top', await deviceHash(request))
	);

/** Publish the Draft: { title, designer?, placements, remixedFromId? } → { id, slug } */
export const POST: RequestHandler = ({ request }) =>
	respond(async () => {
		const hash = await requireDevice(request);
		const body = await request.json().catch(() => {
			throw new HttpFail(400, 'Invalid JSON');
		});
		return publish(parsePublish(body), hash);
	});
