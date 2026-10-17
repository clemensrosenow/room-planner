import type { DuelCandidate } from './types';

/**
 * The next pair for a Device to judge, or null when nothing is left.
 *
 * TODO(Clemens): implement. Contract in docs/specs/duels.md, R2:
 * - never a Design with `mine`, never a pair in `seen` (keys from `pairKey`), never one id twice
 * - first Design: fewest `duels` among those with an allowed partner, picked with `random`
 * - second: the allowed partner with the closest strength (|ln s(a) − ln s(b)|), ties by `random`
 * - the returned order is shuffled with `random`
 *
 * Stub: nothing to judge, so /duel shows its empty state until then.
 */
export function nextPair(
	candidates: DuelCandidate[],
	seen: Set<string>,
	random: () => number
): [string, string] | null {
	void candidates;
	void seen;
	void random;
	return null;
}
