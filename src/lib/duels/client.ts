import { ApiError } from '../social/api';
import { deviceId } from '../social/device';
import type { DesignData } from '../social/types';
import type { NoPairReason } from './pick-duel';
import type { CastDuelRequest } from './types';

/** JSON request to the Duel endpoints, identified by this Device (same style as social/api.ts). */
async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
	let res: Response;
	try {
		res = await fetch(path, {
			method,
			headers: {
				accept: 'application/json',
				'x-device-id': deviceId(),
				...(body !== undefined && { 'content-type': 'application/json' })
			},
			body: body === undefined ? undefined : JSON.stringify(body)
		});
	} catch {
		throw new ApiError(0, 'No connection. Check your internet and try again.');
	}
	const data = await res.json().catch(() => ({}));
	if (!res.ok)
		throw new ApiError(res.status, data.message || `Something went wrong (${res.status})`, data);
	return data as T;
}

/** GET /api/duel: the next two Designs this Device should judge, or why there are none. */
export type DuelResponse =
	{ pair: [DesignData, DesignData] } | { pair: null; reason: NoPairReason };

/** The next pair for this Device, or the reason it has none. */
export const getPair = () => request<DuelResponse>('GET', '/api/duel');

/** Casts a Duel between `a` and `b`; `winner` is `a`, `b`, or null for Skip. */
export const vote = (a: string, b: string, winner: string | null) =>
	request<unknown>('POST', '/api/duels', { a, b, winner } satisfies CastDuelRequest).then(
		() => undefined
	);
