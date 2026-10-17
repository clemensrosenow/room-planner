import { requireDevice } from '#lib/server/designs.ts';
import { nextDuel } from '#lib/server/duels.ts';
import { respond } from '#lib/server/respond.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

/** The next pair for this Device to judge → { pair: [DesignData, DesignData] | null } */
export const GET: RequestHandler = ({ request }) =>
	respond(async () => nextDuel(await requireDevice(request)));
