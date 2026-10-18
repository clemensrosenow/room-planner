import { type DuelResult } from './types';

/** The Duels of known Designs. A Design is its index in `designIds`. */
interface Games {
	/** Real wins per Design, without the prior */
	wins: Int32Array;
	/** Duel k: Design winners[k] beat Design losers[k]. Sorted by winner, then loser. */
	winners: Int32Array;
	losers: Int32Array;
}

/**
 * Bradley-Terry strength per Design: P(a beats b) = s(a) / (s(a) + s(b)).
 *
 * Contract in docs/specs/duels.md, R2:
 * - an entry for every id in `designIds`; Duels with unknown ids are ignored
 * - finite and > 0 for everyone: each Design counts 1 extra win and 1 extra loss against a
 *   virtual Design of strength 1
 * - geometric mean of all strengths = 1
 * - deterministic, independent of the order of `duels`
 */
export function rank(designIds: string[], duels: DuelResult[]): Map<string, number> {
	const games = countGames(designIds, duels);

	const strengths = normalize(fit(games, 1000, 1e-9));

	return new Map(designIds.map((id, i) => [id, strengths[i]]));
}

function countGames(designIds: string[], duels: DuelResult[]): Games {
	const index = new Map(designIds.map((id, i) => [id, i]));

	const wins = new Int32Array(designIds.length);
	const pairs: [number, number][] = [];

	for (const duel of duels) {
		const winnerIndex = index.get(duel.winner);
		const loserIndex = index.get(duel.loser);

		// Unknown ids or a Design against itself: ignore. Index 0 is falsy, so compare with undefined.
		if (winnerIndex === undefined || loserIndex === undefined || winnerIndex === loserIndex) {
			continue;
		}

		wins[winnerIndex]++;
		pairs.push([winnerIndex, loserIndex]);
	}

	// A fixed order, so fit sums the same way whatever the order of `duels`
	pairs.sort((a, b) => a[0] - b[0] || a[1] - b[1]);

	const winners = Int32Array.from(pairs, ([winner]) => winner);
	const losers = Int32Array.from(pairs, ([, loser]) => loser);

	return { wins, winners, losers };
}

/**
 * MM algorithm (Hunter 2004). Each iteration, per Design i:
 *   s[i] = (wins[i] + 1) / (2 / (s[i] + 1) + Σ over i's Duels of 1 / (s[i] + s[opponent]))
 * The +1 and the 2 / (s[i] + 1) are the prior's virtual win and its 2 games.
 */
function fit(games: Games, maxIterations: number, tolerance: number) {
	const { wins, winners, losers } = games;

	const n = wins.length;

	const strengths = new Float64Array(n).fill(1);
	const denominator = new Float64Array(n);

	for (let iteration = 0; iteration < maxIterations; iteration++) {
		// Prior: 2 games against a virtual Design of strength 1
		for (let i = 0; i < n; i++) {
			denominator[i] = 2 / (strengths[i] + 1);
		}

		for (let duelIndex = 0; duelIndex < winners.length; duelIndex++) {
			const winnerIndex = winners[duelIndex];
			const loserIndex = losers[duelIndex];
			const term = 1 / (strengths[winnerIndex] + strengths[loserIndex]);
			denominator[winnerIndex] += term;
			denominator[loserIndex] += term;
		}

		let maxChange = 0;
		for (let i = 0; i < n; i++) {
			const old = strengths[i];
			strengths[i] = (wins[i] + 1) / denominator[i];
			maxChange = Math.max(maxChange, Math.abs((strengths[i] - old) / old));
		}
		if (maxChange < tolerance) break;
	}

	return strengths;
}

/** Scales strengths so their geometric mean is 1. Sums logs: a product of 200 strengths can overflow. */
function normalize(strengths: Float64Array ): Float64Array {
	const logSum = strengths.reduce((sum, rawStrength) => sum + Math.log(rawStrength), 0);
	const geometricMean = Math.exp(logSum / strengths.length);
	return strengths.map((rawStrength) => rawStrength / geometricMean);
}
