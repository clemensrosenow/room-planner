import { pairKey, type DuelCandidate } from './types';

/**
 * The next pair for a Device to judge, or null when nothing is left.
 * Contract in docs/specs/duels.md, R2:
 * - never a Design with `mine`, never a pair in `seen` (keys from `pairKey`), never one id twice
 * - first Design: fewest `duels` among those with an allowed partner, picked with `random`
 * - second: the allowed partner with the closest strength (|ln s(a) − ln s(b)|), ties by `random`
 * - the returned order is shuffled with `random`
 */
export function nextPair(
	candidates: DuelCandidate[],
	seen: Set<string>,
	random: () => number
): [string, string] | null {
	// Sorted by id, so the same random values give the same pair whatever order the DB returns
	const others = candidates.filter((candidate) => !candidate.mine).sort(byId);

	const partnersOf = (design: DuelCandidate) =>
		others.filter(
			(partner) => partner.id !== design.id && !seen.has(pairKey(design.id, partner.id))
		);

	const withPartner = others.filter((design) => partnersOf(design).length > 0);
	if (withPartner.length === 0) return null;

	const leastDueled = allWithMin(withPartner, (design) => design.duels);
	const first = pick(leastDueled, random);

	const closest = allWithMin(partnersOf(first), (partner) => lnGap(first, partner));
	const second = pick(closest, random);

	return random() < 0.5 ? [first.id, second.id] : [second.id, first.id];
}

function lnGap(first: DuelCandidate, second: DuelCandidate): number {
	return Math.abs(Math.log(first.strength) - Math.log(second.strength));
}

function byId(a: DuelCandidate, b: DuelCandidate): number {
	return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function allWithMin<T>(items: T[], key: (item: T) => number): T[] {
	const min = Math.min(...items.map(key));
	return items.filter((item) => key(item) - min <= 1e-9);
}

function pick<T>(items: T[], random: () => number): T {
	return items[Math.floor(random() * items.length)];
}
