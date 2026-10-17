import type { DuelResult } from './types';

/**
 * Bradley-Terry strength per Design: P(a beats b) = s(a) / (s(a) + s(b)).
 *
 * TODO(Clemens): implement. Contract in docs/specs/duels.md, R2:
 * - an entry for every id in `designIds`; Duels with unknown ids are ignored
 * - finite and > 0 for everyone: each Design counts 1 extra win and 1 extra loss against a
 *   virtual Design of strength 1
 * - geometric mean of all strengths = 1
 * - deterministic, independent of the order of `duels`
 *
 * Stub: everyone is equally strong, so the app keeps working until then.
 */
export function rank(designIds: string[], duels: DuelResult[]): Map<string, number> {
	void duels;
	return new Map(designIds.map((id) => [id, 1]));
}
