import { eq } from 'drizzle-orm';
import { nextPair } from '../duels/next-pair';
import { pairKey, type CastDuelRequest, type DuelCandidate } from '../duels/types';
import { ROOM_ID } from '../planner/room';
import type { DesignData } from '../social/types';
import { db } from './db';
import { HttpFail, loadRoom, toData } from './designs';
import { duels } from './schema';

/** The next pair this Device should judge, or null when nothing is left (spec R3, R2 nextPair). */
export async function nextDuel(hash: string): Promise<{ pair: [DesignData, DesignData] | null }> {
	const [room, judged] = await Promise.all([
		loadRoom(ROOM_ID),
		db()
			.select({ designLo: duels.designLo, designHi: duels.designHi })
			.from(duels)
			.where(eq(duels.voterHash, hash))
	]);
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
	const pair = nextPair(candidates, seen, Math.random);
	if (!pair) return { pair: null };
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
 * Stores one Device's judgement of a pair: `winner` is `a`, `b`, or null for a Skip.
 * Contract in docs/specs/duels.md, R2:
 * - 400 when `a === b`, an id isn't a valid Design id (isDesignId), or `winner` is neither `a`,
 *   `b` nor null.
 * - 404 when a Design doesn't exist, also when it is deleted between the check and the insert:
 *   the insert then fails with a foreign key violation, `23503` (pgCode in designs.ts).
 * - 403 when the voter published either Design (`publisherHash === voterHash`).
 * - 409 when this Device already judged the pair: insert with `on conflict do nothing`; 0 rows
 *   inserted means the primary key (design_lo, design_hi, voter_hash) was already there. This
 *   also holds when two requests race.
 * - Stores the pair normalized: design_lo < design_hi (string order), see `duels` in schema.ts.
 *
 * TODO(Clemens): implement.
 */
export async function castDuel(
	voterHash: string,
	a: string,
	b: string,
	winner: string | null
): Promise<void> {
	void voterHash;
	void a;
	void b;
	void winner;
	throw new HttpFail(501, 'Duels are not implemented yet');
}
