import { PROVISIONAL_BELOW, type DuelResult, type Standing } from '../duels/types';

/** A stored Duel as the database has it: a normalized pair, winner null = Skip. */
export interface StoredDuel {
	designLo: string;
	designHi: string;
	winnerId: string | null;
}

/** Decided Duels as `rank` reads them. Skips drop out. */
export const decided = (duels: StoredDuel[]): DuelResult[] =>
	duels.flatMap((d) =>
		d.winnerId === null
			? []
			: [{ winner: d.winnerId, loser: d.winnerId === d.designLo ? d.designHi : d.designLo }]
	);

/**
 * Stronger first. `rank` converges to a relative change < 1e-9, so strengths closer than that are
 * equal: two identical records must not be ordered by floating-point noise.
 */
const STRENGTH_TOLERANCE = 1e-9;
const byStrength = (sa: number, sb: number) =>
	Math.abs(Math.log(sa) - Math.log(sb)) < STRENGTH_TOLERANCE ? 0 : sb - sa;

/**
 * Where every Design stands (docs/specs/duels.md, R3), given the strengths from `rank`.
 * Wins and losses count only real decided Duels between known Designs; the prior never counts.
 * Rank is 1-based by strength; equal strength → newer first, then id.
 */
export function standings(
	designs: { id: string; createdAt: Date }[],
	results: DuelResult[],
	strength: Map<string, number>
): Map<string, Standing> {
	const record = new Map(designs.map((d) => [d.id, { wins: 0, losses: 0 }]));
	for (const { winner, loser } of results) {
		const w = record.get(winner);
		const l = record.get(loser);
		if (!w || !l || winner === loser) continue;
		w.wins++;
		l.losses++;
	}
	const s = (id: string) => strength.get(id) ?? 1;
	const order = [...designs].sort(
		(a, b) =>
			byStrength(s(a.id), s(b.id)) ||
			b.createdAt.getTime() - a.createdAt.getTime() ||
			(a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
	);
	return new Map(
		order.map((d, i) => {
			const { wins, losses } = record.get(d.id)!;
			return [d.id, { rank: i + 1, wins, losses, provisional: wins + losses < PROVISIONAL_BELOW }];
		})
	);
}
