import { describe, expect, it } from 'vitest';
import { rank } from './rank';
import type { DuelResult } from './types';

/*
 * The contract of `rank` from docs/specs/duels.md, R2. Every test checks a property the spec
 * asks for, never one algorithm's exact output, except the hand-checkable known value below.
 */

/** Seeded PRNG (mulberry32), so every "random" tournament is the same on every run. */
function seeded(seed: number): () => number {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

const ids = (n: number) => Array.from({ length: n }, (_, i) => `d${i}`);

/** `count` Duels between random pairs of `designIds`, random winner. */
function tournament(designIds: string[], count: number, seed: number): DuelResult[] {
	const random = seeded(seed);
	const pick = () => designIds[Math.floor(random() * designIds.length)];
	const duels: DuelResult[] = [];
	while (duels.length < count) {
		const [winner, loser] = [pick(), pick()];
		if (winner !== loser) duels.push({ winner, loser });
	}
	return duels;
}

/** A tournament with a clear order: the lower the index, the more likely to win. */
function skewedTournament(designIds: string[], count: number, seed: number): DuelResult[] {
	const upset = seeded(seed + 1000);
	return tournament(designIds, count, seed).map((d) =>
		designIds.indexOf(d.winner) < designIds.indexOf(d.loser) || upset() < 0.2
			? d
			: { winner: d.loser, loser: d.winner }
	);
}

const beats = (winner: string, loser: string, times = 1): DuelResult[] =>
	Array.from({ length: times }, () => ({ winner, loser }));

function shuffled<T>(items: T[], random: () => number): T[] {
	const out = [...items];
	for (let i = out.length - 1; i > 0; i--) {
		const j = Math.floor(random() * (i + 1));
		[out[i], out[j]] = [out[j], out[i]];
	}
	return out;
}

const geometricMean = (s: Map<string, number>) =>
	Math.exp([...s.values()].reduce((sum, v) => sum + Math.log(v), 0) / s.size);

const sortedEntries = (s: Map<string, number>) =>
	[...s.entries()].sort(([a], [b]) => (a < b ? -1 : 1));

/**
 * Guard for property tests: an answer of all-equal strengths would make many properties true
 * for free, so a tournament with a clear winner must actually spread the strengths.
 */
function expectSpread(s: Map<string, number>) {
	const values = [...s.values()];
	expect(
		Math.max(...values) / Math.min(...values),
		'rank gave (nearly) equal strengths to a tournament with clear winners and losers, so this test would prove nothing. Spec R2: Bradley-Terry strength, P(a beats b) = s(a) / (s(a) + s(b)).'
	).toBeGreaterThan(1.5);
}

/**
 * How far the strengths are from a Bradley-Terry fit. At the fit, every Design's actual wins
 * equal its expected wins: Σ over its Duels of s(i) / (s(i) + s(opponent)). The prior adds one
 * win and one loss against a virtual Design. Its strength is `c`: 1 before normalizing, and
 * whatever normalizing turned it into after, so `c` is solved from the first Design and then
 * has to fit every other one. Returns the largest gap, relative to the Design's game count.
 *
 * A gap here rarely means "not converged yet": a plain MM iteration gets far below the
 * tolerance within 1000 iterations. More often it is a different model, e.g. normalizing inside
 * the loop while the virtual Design stays at 1. See FIT_HINT.
 */
function fitGap(designIds: string[], duels: DuelResult[], s: Map<string, number>): number {
	const known = new Set(designIds);
	const games = new Map(designIds.map((id) => [id, { wins: 1, expected: 0, count: 2 }]));
	for (const { winner, loser } of duels) {
		if (!known.has(winner) || !known.has(loser)) continue;
		const [sw, sl] = [s.get(winner)!, s.get(loser)!];
		const w = games.get(winner)!;
		const l = games.get(loser)!;
		w.wins++;
		w.count++;
		l.count++;
		w.expected += sw / (sw + sl);
		l.expected += sl / (sw + sl);
	}
	const [first] = designIds;
	const f = games.get(first)!;
	const rest = f.wins - f.expected; // = 2·s / (s + c) for the first Design
	const c = s.get(first)! * (2 / rest - 1);
	let gap = 0;
	for (const id of designIds) {
		const g = games.get(id)!;
		const si = s.get(id)!;
		const expected = g.expected + (2 * si) / (si + c);
		gap = Math.max(gap, Math.abs(g.wins - expected) / g.count);
	}
	return gap;
}

/** What to check when fitGap is too large. */
const FIT_HINT =
	'The strengths are not a Bradley-Terry fit: each Design should win as many Duels (+1 prior win) as the strengths predict, Σ s(i)/(s(i)+s(j)) (+2 prior games against the virtual Design). Check that you normalize once, after the loop. Normalizing inside the loop while the virtual Design stays at 1 fits a different model. Spec R2.';

describe('rank: entries', () => {
	it('gives no entries for no Designs', () => {
		expect(
			rank([], []).size,
			'Spec R2: rank returns an entry for every id in designIds, and only those.'
		).toBe(0);
	});

	it('returns an entry for every Design id, and ignores Duels with ids that are not Designs', () => {
		const designIds = ['a', 'b', 'c'];
		const real = [...beats('a', 'b'), ...beats('b', 'c')];
		// Deleted or foreign Designs: they must not count, not even through their opponents
		const ghosts = [...beats('z', 'a', 5), ...beats('a', 'y'), ...beats('y', 'z')];
		const s = rank(designIds, [...ghosts, ...real]);

		expect(
			[...s.keys()].sort(),
			'Spec R2: rank returns an entry for every id in designIds, and none for ids that only appear in duels.'
		).toEqual(designIds);
		expect(
			sortedEntries(s),
			"Spec R2: Duels with ids that aren't in designIds are ignored, so the result is the same as without them."
		).toEqual(sortedEntries(rank(designIds, real)));
		expect(
			s.get('a')!,
			'a beat b and b beat c, so a must be stronger than c. Spec R2: Bradley-Terry strength.'
		).toBeGreaterThan(s.get('c')!);
	});
});

describe('rank: the prior keeps every strength finite and positive', () => {
	it('gives a 3–0 Design and a 0–3 Design finite strengths above 0, the 3–0 one strongest', () => {
		const designIds = ['a', 'b', 'c', 'd'];
		// a won all 3 of its Duels, d lost all 3 of its Duels
		const duels = [
			...beats('a', 'b'),
			...beats('a', 'c'),
			...beats('a', 'd'),
			...beats('b', 'd'),
			...beats('c', 'd'),
			...beats('b', 'c')
		];
		const s = rank(designIds, duels);
		for (const id of designIds) {
			const v = s.get(id)!;
			expect(
				Number.isFinite(v) && v > 0,
				`Strength of ${id} is ${v}. Spec R2: every strength is finite and > 0, also for a Design that won or lost every Duel (the prior: 1 extra win and 1 extra loss against a virtual Design).`
			).toBe(true);
		}
		expect(s.get('a')!, 'The 3–0 Design must be the strongest.').toBeGreaterThan(s.get('b')!);
		expect(s.get('d')!, 'The 0–3 Design must be the weakest.').toBeLessThan(s.get('c')!);
	});

	it('keeps every strength finite and > 0 in a large random tournament', () => {
		const designIds = ids(50);
		const s = rank(designIds, skewedTournament(designIds, 600, 11));
		expectSpread(s);
		for (const [id, v] of s)
			expect(
				Number.isFinite(v) && v > 0,
				`Strength of ${id} is ${v}. Spec R2: every strength is finite and > 0.`
			).toBe(true);
	});
});

describe('rank: normalization', () => {
	it('gives every Design exactly 1 when there are no Duels', () => {
		const s = rank(['a', 'b', 'c'], []);
		for (const [id, v] of s)
			expect(
				v,
				`Strength of ${id}. Spec R2: a Design without Duels gets exactly 1 when all others are balanced.`
			).toBe(1);
	});

	it('gives a Design without Duels 1 when the others are balanced', () => {
		// a and b beat each other once: balanced. c never dueled.
		const s = rank(['a', 'b', 'c'], [...beats('a', 'b'), ...beats('b', 'a')]);
		expect(
			s.get('c')!,
			'Spec R2: a Design without Duels gets exactly 1 when all others are balanced.'
		).toBeCloseTo(1, 8);
	});

	it.each([1, 2, 3])('has a geometric mean of 1 (tournament %i)', (seed) => {
		const designIds = ids(12 + seed * 5);
		const s = rank(designIds, skewedTournament(designIds, 80 * seed, seed));
		expectSpread(s);
		expect(
			Math.abs(geometricMean(s) - 1),
			'Spec R2: strengths are normalized so the geometric mean of all strengths is 1.'
		).toBeLessThan(1e-9);
	});
});

describe('rank: Bradley-Terry fit', () => {
	it('matches the hand calculation for A beating B once (documents the prior)', () => {
		/*
		 * A beat B once. With the prior, each also has 1 win and 1 loss against the virtual
		 * Design V of strength 1:
		 *   A: 2 wins (B, V) in 3 games (B, V, V)    B: 1 win (V) in 3 games (A, V, V)
		 * At the fit, actual wins = expected wins (x = s(A), y = s(B)):
		 *   A: 2 = x/(x+y) + 2·x/(x+1)
		 *   B: 1 = y/(x+y) + 2·y/(y+1)
		 * The case is symmetric (swap A and B, and s with 1/s), so y = 1/x, and then the geometric
		 * mean √(x·y) is already 1. Putting y = 1/x into B's equation:
		 *   1 = 1/(x²+1) + 2/(x+1)  →  (x²+1)(x+1) = (x+1) + 2(x²+1)  →  x³ − x² − 2 = 0
		 * Its one real root: x = s(A) ≈ 1.695621, y = s(B) ≈ 0.589754.
		 * So P(A beats B) = x²/(x²+1) ≈ 0.742: one win is evidence, not proof. Without the prior,
		 * s(A)/s(B) would be infinite.
		 */
		const s = rank(['a', 'b'], beats('a', 'b'));
		const x = s.get('a')!;
		const y = s.get('b')!;
		const msg =
			'One win of A over B, plus the prior (1 extra win and 1 extra loss against a virtual Design of strength 1, spec R2), gives s(A) = root of x³ − x² − 2 = 0 and s(B) = 1/s(A). See the comment in this test.';
		expect(x, msg).toBeCloseTo(1.695621, 5);
		expect(y, msg).toBeCloseTo(0.589754, 5);
		expect(x ** 3 - x ** 2 - 2, msg).toBeCloseTo(0, 6);
		expect(x * y, msg).toBeCloseTo(1, 8);
	});

	it.each([4, 5, 6])(
		"fits the Duels: every Design's expected wins equal its actual wins (tournament %i)",
		(seed) => {
			const designIds = ids(15);
			const duels = skewedTournament(designIds, 120, seed);
			const s = rank(designIds, duels);
			expectSpread(s);
			expect(fitGap(designIds, duels, s), FIT_HINT).toBeLessThan(1e-6);
		}
	);

	it('ranks A above B above C when A beats B three times and B beats C three times', () => {
		const s = rank(['a', 'b', 'c'], [...beats('a', 'b', 3), ...beats('b', 'c', 3)]);
		expect(s.get('a')!, 'A beat B ×3, so s(A) > s(B).').toBeGreaterThan(s.get('b')!);
		expect(s.get('b')!, 'B beat C ×3, so s(B) > s(C).').toBeGreaterThan(s.get('c')!);
	});

	it('gives two Designs that each beat the other once equal strength', () => {
		const duels = [...beats('a', 'b'), ...beats('b', 'a'), ...beats('a', 'c'), ...beats('b', 'c')];
		const s = rank(['a', 'b', 'c'], duels);
		expect(
			s.get('a')! / s.get('b')!,
			'a and b have the same record against the same opponents, so they must be equally strong.'
		).toBeCloseTo(1, 8);
		expect(s.get('a')!, 'a and b both beat c, so they are stronger than c.').toBeGreaterThan(
			s.get('c')!
		);
	});

	it('ranks a win over a strong opponent above a win over a weak one with the same record', () => {
		const duels = [
			// strong beats f1–f3 twice each, f1–f3 beat weak twice each
			...['f1', 'f2', 'f3'].flatMap((f) => [...beats('strong', f, 2), ...beats(f, 'weak', 2)]),
			// x and y are both 1–0
			...beats('x', 'strong'),
			...beats('y', 'weak')
		];
		const s = rank(['strong', 'weak', 'f1', 'f2', 'f3', 'x', 'y'], duels);
		expect(
			s.get('x')!,
			'x and y are both 1–0, but x beat a strong Design and y a weak one. Bradley-Terry weighs a win by the strength of the beaten opponent, so s(x) > s(y). A plain win rate would tie them.'
		).toBeGreaterThan(s.get('y')!);
	});
});

describe('rank: deterministic and monotone', () => {
	it('gives the same strengths for the same Duels in any order', () => {
		const designIds = ids(20);
		const duels = skewedTournament(designIds, 150, 7);
		const s = rank(designIds, duels);
		expectSpread(s);
		expect(
			sortedEntries(rank(designIds, duels)),
			'Spec R2: deterministic. The same input twice gave different strengths.'
		).toEqual(sortedEntries(s));
		const random = seeded(8);
		for (let i = 0; i < 5; i++)
			expect(
				sortedEntries(rank(designIds, shuffled(duels, random))),
				'Spec R2: independent of the order of duels, exactly. Equal strengths break ties on the Leaderboard (newer first, then id), so even rounding noise from summing in another order could reorder Designs. Remedy: count wins and games per pair as integers, then sum in designIds order, not in Duel or Map insertion order.'
			).toEqual(sortedEntries(s));
	});

	it("never lowers a Design's strength when one of its losses becomes a win", () => {
		const designIds = ids(8);
		const duels = skewedTournament(designIds, 40, 9);
		const before = rank(designIds, duels);
		let rose = 0;
		duels.forEach((d, k) => {
			const flipped = duels.map((e, i) => (i === k ? { winner: e.loser, loser: e.winner } : e));
			const was = before.get(d.loser)!;
			const now = rank(designIds, flipped).get(d.loser)!;
			expect(
				now,
				`${d.loser} lost Duel #${k} to ${d.winner}; turning that into a win moved its strength from ${was} to ${now}. Spec R2: monotone, replacing one of a Design's losses by a win never lowers its strength.`
			).toBeGreaterThanOrEqual(was * (1 - 1e-9));
			if (now > was * (1 + 1e-6)) rose++;
		});
		expect(
			rose,
			'Turning losses into wins never raised a strength: rank ignores the Duels.'
		).toBeGreaterThan(0);
	});
});

describe('rank: performance', () => {
	it('ranks 200 Designs and 5000 Duels in under 50 ms', () => {
		const designIds = ids(200);
		rank(ids(50), skewedTournament(ids(50), 500, 12)); // warm-up, so JIT compiling isn't timed
		const duels = skewedTournament(designIds, 5000, 13);
		// Best of 5 runs, so a busy machine (GC, other processes) doesn't fail the test
		let ms = Infinity;
		let s = new Map<string, number>();
		for (let run = 0; run < 5; run++) {
			const start = performance.now();
			s = rank(designIds, duels);
			ms = Math.min(ms, performance.now() - start);
		}
		expect(s.size, 'Spec R2: an entry for every Design.').toBe(200);
		expectSpread(s);
		// Plain MM needs about 1100–1270 iterations to reach a relative change of 1e-9 on this
		// tournament, so stopping at the 1000-iteration cap is accepted: by then the gap is far
		// below this tolerance.
		expect(fitGap(designIds, duels, s), FIT_HINT).toBeLessThan(1e-6);
		expect(
			ms,
			`Took ${ms.toFixed(1)} ms (best of 5 runs). Spec R2: < 50 ms for 200 Designs and 5000 Duels.`
		).toBeLessThan(50);
	});
});
