import { and, eq, inArray } from 'drizzle-orm';
import { pickDuel, type NoPairReason } from '../duels/pick-duel';
import { pairKey, type CastDuelRequest, type DuelCandidate } from '../duels/types';
import { ROOM_ID } from '../planner/room';
import type { DesignData } from '../social/types';
import { db } from './db';
import { HttpFail, loadRoom, toData, isDesignId, pgCode } from './designs';
import { designs, duels } from './schema';

/**
 * Async so a synchronous throw from `db()` rejects the promise instead of escaping while
 * `Promise.all`'s array is built, which would leave the already-started `loadRoom` rejection
 * unhandled and kill the process.
 */
async function judgedBy(hash: string) {
	return db()
		.select({ designLo: duels.designLo, designHi: duels.designHi })
		.from(duels)
		.where(eq(duels.voterHash, hash));
}

/** The next pair this Device should judge, or why there is none (spec R3, R2 nextPair). */
export async function nextDuel(
	hash: string
): Promise<{ pair: [DesignData, DesignData] } | { pair: null; reason: NoPairReason }> {
	const [room, judged] = await Promise.all([loadRoom(ROOM_ID), judgedBy(hash)]);
	const seen = new Set(judged.map((d) => pairKey(d.designLo, d.designHi)));
	const candidates: DuelCandidate[] = room.rows.map((r) => {
		const s = room.standing.get(r.id)!;
		return {
			id: r.id,
			mine: r.publisherHash === hash,
			duels: s.wins + s.losses,
			strength: room.strength.get(r.id)!
		};
	});
	const pick = pickDuel(candidates, seen, Math.random);
	if (!pick.pair) return pick;
	const pair = pick.pair;
	const data = (id: string) =>
		toData(
			room.rows.find((r) => r.id === id)!,
			room.standing.get(id)!,
			hash
		);
	return { pair: [data(pair[0]), data(pair[1])] };
}

/** Checks the shape of a POST /api/duels body; what the ids mean is castDuel's job. */
export function parseCastDuel(body: unknown): CastDuelRequest {
	const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
	if (typeof b.a !== 'string' || typeof b.b !== 'string')
		throw new HttpFail(400, 'A Duel needs two designs');
	if (b.winner !== null && typeof b.winner !== 'string')
		throw new HttpFail(400, 'The winner must be one of the two designs, or null to skip');
	return { a: b.a, b: b.b, winner: b.winner };
}

/**
 * Stores one Device's judgement of a pair.
 */
export async function castDuel(
	voterHash: string,
	a: string,
	b: string,
	winner: string | null
): Promise<void> {
	if (a === b) throw new HttpFail(400, 'A Duel needs two different designs');
	if (!isDesignId(a) || !isDesignId(b)) throw new HttpFail(400, 'Invalid design id');

	if (winner !== null && winner !== a && winner !== b)
		throw new HttpFail(400, 'The winner must be one of the two designs, or null to skip');

	const [lo, hi] = a < b ? [a, b] : [b, a];

	const rows = await db()
		.select({ publisherHash: designs.publisherHash })
		.from(designs)
		.where(and(eq(designs.roomId, ROOM_ID), inArray(designs.id, [a, b])));

	if (rows.length < 2) throw new HttpFail(404, 'Design not found');

	if (rows.some((r) => r.publisherHash === voterHash))
		throw new HttpFail(403, "You can't judge a Duel with your own design");

	let inserted;
	try {
		inserted = await db()
			.insert(duels)
			.values({
				designLo: lo,
				designHi: hi,
				winnerId: winner,
				voterHash
			})
			.onConflictDoNothing()
			.returning({ voterHash: duels.voterHash });
	} catch (e) {
		if (pgCode(e) === '23503') throw new HttpFail(404, 'Design not found');
		throw e;
	}

	if (inserted.length === 0) {
		throw new HttpFail(409, 'You already judged this pair');
	}
}
