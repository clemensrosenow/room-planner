import { describe, expect, it } from 'vitest';
import { nextPair } from './next-pair';
import { pairKey, type DuelCandidate } from './types';

/*
 * The contract of `nextPair` from docs/specs/duels.md, R2. `random` is injected, so every test
 * is deterministic. Rules that `random` decides (ties, the order) are checked over many seeds:
 * each allowed outcome has to show up, and nothing else may.
 */

/** Seeded PRNG (mulberry32): a deterministic `random` for one seed. */
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

/** A `random` that returns the queued values in order, then starts over. */
function queued(...values: number[]): () => number {
	let i = 0;
	return () => values[i++ % values.length];
}

const SEEDS = Array.from({ length: 200 }, (_, i) => i + 1);

const design = (id: string, extra: Partial<DuelCandidate> = {}): DuelCandidate => ({
	id,
	mine: false,
	duels: 0,
	strength: 1,
	...extra
});

const seenOf = (...pairs: [string, string][]) => new Set(pairs.map(([a, b]) => pairKey(a, b)));

/** Every unordered pair of these ids. */
const allPairs = (ids: string[]): [string, string][] =>
	ids.flatMap((a, i) => ids.slice(i + 1).map((b): [string, string] => [a, b]));

/** The outcomes of nextPair over all SEEDS, as "a,b" in returned order. */
function outcomes(candidates: DuelCandidate[], seen: Set<string>): Set<string> {
	return new Set(SEEDS.map((seed) => String(nextPair(candidates, seen, seeded(seed)))));
}

/** The unordered pairs nextPair returns over all SEEDS, as pair keys. */
function pairsReturned(candidates: DuelCandidate[], seen: Set<string>): Set<string> {
	return new Set(
		SEEDS.map((seed) => {
			const pair = nextPair(candidates, seen, seeded(seed));
			expect(pair, 'An allowed pair exists here, so nextPair must not return null.').not.toBeNull();
			return pairKey(...pair!);
		})
	);
}

/** Brute force: is there any pair a Device may judge? */
const anyAllowed = (candidates: DuelCandidate[], seen: Set<string>) =>
	allPairs(candidates.filter((c) => !c.mine).map((c) => c.id)).some(
		([a, b]) => !seen.has(pairKey(a, b))
	);

/** Brute force: the Designs `c` may meet (not mine, not itself, pair not seen). */
const partnersOf = (c: DuelCandidate, candidates: DuelCandidate[], seen: Set<string>) =>
	candidates.filter((p) => !p.mine && p.id !== c.id && !seen.has(pairKey(c.id, p.id)));

const lnGap = (a: DuelCandidate, b: DuelCandidate) =>
	Math.abs(Math.log(a.strength) - Math.log(b.strength));

/**
 * Brute force for the two picking rules: in one of its two orders (first, partner), `first` has
 * the fewest Duels among Designs that still have an allowed partner, and `partner` is the
 * closest in ln(strength) among first's allowed partners.
 */
function followsPickingRules(
	pair: [string, string],
	candidates: DuelCandidate[],
	seen: Set<string>
): boolean {
	const byId = new Map(candidates.map((c) => [c.id, c]));
	const open = candidates.filter((c) => !c.mine && partnersOf(c, candidates, seen).length);
	const fewest = Math.min(...open.map((c) => c.duels));
	const fits = (first: DuelCandidate, partner: DuelCandidate) => {
		const partners = partnersOf(first, candidates, seen);
		const closest = Math.min(...partners.map((p) => lnGap(first, p)));
		return (
			open.includes(first) &&
			first.duels === fewest &&
			partners.includes(partner) &&
			lnGap(first, partner) <= closest + 1e-12
		);
	};
	const [a, b] = pair.map((id) => byId.get(id)!);
	return fits(a, b) || fits(b, a);
}

describe('nextPair: what may never be returned', () => {
	it('never returns its own Design, a seen pair or the same Design twice, and follows the picking rules (random setups)', () => {
		let pairs = 0;
		for (const seed of SEEDS) {
			const random = seeded(seed * 7919);
			const n = 2 + Math.floor(random() * 9);
			const candidates = Array.from({ length: n }, (_, i) =>
				design(`d${i}`, {
					mine: random() < 0.25,
					duels: Math.floor(random() * 6),
					strength: Math.exp(random() * 4 - 2)
				})
			);
			const seen = new Set(
				allPairs(candidates.map((c) => c.id))
					.filter(() => random() < 0.6)
					.map(([a, b]) => pairKey(a, b))
			);
			const pair = nextPair(candidates, seen, seeded(seed));
			const setup = JSON.stringify({ candidates, seen: [...seen] });

			if (!anyAllowed(candidates, seen)) {
				expect(
					pair,
					`No allowed pair exists, so the answer is null. Spec R2. Setup: ${setup}`
				).toBeNull();
				continue;
			}
			expect(
				pair,
				`An allowed pair exists, so nextPair must find one. Setup: ${setup}`
			).not.toBeNull();
			pairs++;
			const [a, b] = pair!;
			const byId = new Map(candidates.map((c) => [c.id, c]));
			expect(byId.has(a) && byId.has(b), `${pair} must be candidate ids. Setup: ${setup}`).toBe(
				true
			);
			expect(a, `Spec R2: never the same id twice. Setup: ${setup}`).not.toBe(b);
			expect(
				byId.get(a)!.mine || byId.get(b)!.mine,
				`Spec R2: never a Design with \`mine\`; got ${pair}. Setup: ${setup}`
			).toBe(false);
			expect(
				seen.has(pairKey(a, b)),
				`Spec R2: never a pair in \`seen\`; got ${pair}. Setup: ${setup}`
			).toBe(false);
			expect(
				followsPickingRules(pair!, candidates, seen),
				`Spec R2: one Design of ${pair} must have the fewest \`duels\` among Designs that still have an allowed partner, and the other must be its allowed partner with the closest strength (smallest |ln s(a) − ln s(b)|). Setup: ${setup}`
			).toBe(true);
		}
		expect(pairs, 'The random setups should contain some judgeable pairs.').toBeGreaterThan(50);
	});

	it.each([
		['no candidates', [], seenOf()],
		['one candidate', [design('a')], seenOf()],
		['two candidates, one of them mine', [design('a'), design('b', { mine: true })], seenOf()],
		['only own Designs', [design('a', { mine: true }), design('b', { mine: true })], seenOf()],
		['the only pair seen', [design('a'), design('b')], seenOf(['b', 'a'])],
		[
			'every pair seen',
			[design('a'), design('b'), design('c', { duels: 3 }), design('m', { mine: true })],
			seenOf(['a', 'b'], ['a', 'c'], ['b', 'c'])
		]
	])('returns null with %s', (_, candidates, seen) => {
		expect(
			nextPair(candidates, seen, seeded(1)),
			'Spec R2: null when no allowed pair exists (not mine, not seen, two different Designs).'
		).toBeNull();
	});

	it('does not pick a partner that is mine or already seen, even when it is the closest', () => {
		const candidates = [
			design('first', { duels: 0, strength: 1 }),
			design('mine', { duels: 5, strength: 1, mine: true }),
			design('judged', { duels: 5, strength: 1.1 }),
			design('allowed', { duels: 5, strength: 3 })
		];
		const seen = seenOf(['first', 'judged'], ['judged', 'allowed']);
		expect(
			pairsReturned(candidates, seen),
			"Spec R2: the second Design comes from the first one's *allowed* partners: not mine, pair not seen."
		).toEqual(new Set([pairKey('first', 'allowed')]));
	});
});

describe('nextPair: the first Design has the fewest Duels', () => {
	it('always includes the Design with the fewest Duels', () => {
		const candidates = [
			design('busy1', { duels: 5, strength: 1 }),
			design('fresh', { duels: 0, strength: 1 }),
			design('busy2', { duels: 5, strength: 1.2 }),
			design('busy3', { duels: 7, strength: 0.9 })
		];
		for (const key of pairsReturned(candidates, seenOf()))
			expect(
				key.split(':'),
				'Spec R2: the first Design is one with the fewest `duels`, so `fresh` (0 Duels) must be in every pair.'
			).toContain('fresh');
	});

	it('skips the least-dueled Design when it has no allowed partner left', () => {
		const candidates = [
			design('done', { duels: 0 }),
			design('next', { duels: 1, strength: 1 }),
			design('busy1', { duels: 3, strength: 4 }),
			design('busy2', { duels: 3, strength: 1.5 })
		];
		const seen = seenOf(['done', 'next'], ['done', 'busy1'], ['done', 'busy2']);
		expect(
			pairsReturned(candidates, seen),
			'Spec R2: the first Design is chosen among Designs that *still have an allowed partner*. `done` has none, so `next` (1 Duel) goes first and meets its closest partner `busy2`.'
		).toEqual(new Set([pairKey('next', 'busy2')]));
	});

	it('picks among Designs tied for the fewest Duels with random', () => {
		// tie1 and tie2 both have 0 Duels and may not meet each other, so each pair shows which
		// one went first
		const candidates = [
			design('tie1', { duels: 0, strength: 1 }),
			design('tie2', { duels: 0, strength: 8 }),
			design('near1', { duels: 4, strength: 1.1 }),
			design('near2', { duels: 4, strength: 7 })
		];
		const seen = seenOf(['tie1', 'tie2']);
		expect(
			pairsReturned(candidates, seen),
			'Spec R2: one of the Designs with the fewest Duels is picked with `random`. Over 200 seeds both tie1 and tie2 must go first (each with its closest partner), and nothing else.'
		).toEqual(new Set([pairKey('tie1', 'near1'), pairKey('tie2', 'near2')]));
	});
});

describe('nextPair: the second Design has the closest strength', () => {
	it('picks the partner by strength, not by how few Duels it has', () => {
		const candidates = [
			design('first', { duels: 0, strength: 1 }),
			design('close', { duels: 9, strength: 1.05 }),
			design('idle', { duels: 1, strength: 5 })
		];
		expect(
			pairsReturned(candidates, seenOf()),
			'Spec R2: only the *first* Design is chosen by fewest `duels`. Its partner is the closest in strength (`close`, ×1.05), even though `idle` has fewer Duels.'
		).toEqual(new Set([pairKey('first', 'close')]));
	});

	it('picks the partner closest in ln(strength), not in plain strength', () => {
		const candidates = [
			design('first', { duels: 0, strength: 1 }),
			// |1.8 − 1| = 0.8 but |ln 1.8| ≈ 0.588
			design('ratio-close', { duels: 3, strength: 1.8 }),
			// |0.5 − 1| = 0.5 but |ln 0.5| ≈ 0.693
			design('diff-close', { duels: 3, strength: 0.5 }),
			design('far', { duels: 3, strength: 20 })
		];
		expect(
			pairsReturned(candidates, seenOf()),
			'Spec R2: the second Design has the smallest |ln s(a) − ln s(b)|. 1.8 is closer to 1 than 0.5 on that scale (×1.8 vs ×2), even though 0.5 is closer in plain difference.'
		).toEqual(new Set([pairKey('first', 'ratio-close')]));
	});

	it('picks among equally close partners with random', () => {
		const candidates = [
			design('first', { duels: 0, strength: 1 }),
			design('twin1', { duels: 3, strength: 2 }),
			design('twin2', { duels: 3, strength: 2 }),
			design('far', { duels: 3, strength: 9 })
		];
		expect(
			pairsReturned(candidates, seenOf()),
			'Spec R2: ties for the closest strength are picked with `random`. Over 200 seeds both twins must show up, and never `far`.'
		).toEqual(new Set([pairKey('first', 'twin1'), pairKey('first', 'twin2')]));
	});
});

describe('nextPair: order and randomness', () => {
	it('shuffles the returned order, so the first Design is not always on the left', () => {
		const candidates = [
			design('first', { duels: 0, strength: 1 }),
			design('partner', { duels: 2, strength: 1.2 }),
			design('other', { duels: 2, strength: 5 })
		];
		expect(
			outcomes(candidates, seenOf()),
			'Spec R2: the returned order is shuffled with `random`. Over 200 seeds the pair must come both ways round.'
		).toEqual(new Set(['first,partner', 'partner,first']));
	});

	it('only uses the injected random: same random values, same answer', () => {
		const candidates = Array.from({ length: 12 }, (_, i) =>
			design(`d${i}`, { duels: i % 3, strength: 1 + (i % 4) / 10 })
		);
		for (const values of [[0], [0.999], [0.5, 0.1, 0.9], [0.25, 0.75]]) {
			const first = nextPair(candidates, seenOf(), queued(...values));
			for (let i = 0; i < 20; i++)
				expect(
					nextPair(candidates, seenOf(), queued(...values)),
					`random returned ${values} again, so the answer must be the same. Spec R2: \`random\` is injected so the result is deterministic; don't call Math.random.`
				).toEqual(first);
		}
	});
});

describe('nextPair: scale', () => {
	it('finds the last unseen pair among 30 Designs', () => {
		const candidates = Array.from({ length: 30 }, (_, i) =>
			design(`d${String(i).padStart(2, '0')}`, { duels: i, strength: Math.exp((i % 7) - 3) })
		);
		// The last pair is between the two most-dueled Designs, so the least-dueled ones all
		// have no partner left
		const last = pairKey('d28', 'd29');
		const seen = new Set(
			allPairs(candidates.map((c) => c.id))
				.map(([a, b]) => pairKey(a, b))
				.filter((key) => key !== last)
		);
		expect(
			pairsReturned(candidates, seen),
			'All but one of the 435 pairs are seen; nextPair must find the one left (spec R2: null only when no allowed pair exists).'
		).toEqual(new Set([last]));
	});
});
