import { nextPair } from './next-pair';
import type { DuelCandidate } from './types';

/**
 * Why a Device gets no pair (docs/specs/duels.md, R3):
 * - `too-few`: fewer than two Published Designs it didn't publish, so there is nothing to judge yet.
 * - `all-judged`: it has judged or skipped every pair it may get.
 */
export type NoPairReason = 'too-few' | 'all-judged';

export type DuelPick = { pair: [string, string] } | { pair: null; reason: NoPairReason };

/** The next pair for a Device from `nextPair`, or why there is none. */
export function pickDuel(
	candidates: DuelCandidate[],
	seen: Set<string>,
	random: () => number
): DuelPick {
	const pair = nextPair(candidates, seen, random);
	if (pair) return { pair };
	const others = candidates.filter((c) => !c.mine).length;
	return { pair: null, reason: others < 2 ? 'too-few' : 'all-judged' };
}
