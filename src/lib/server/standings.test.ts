import { describe, expect, it } from 'vitest';
import { decided, standings, type StoredDuel } from './standings';

const at = (minute: number) => new Date(Date.UTC(2026, 9, 17, 12, minute));

/** Three Published Designs, `cccccccc` the newest */
const designs = [
	{ id: 'aaaaaaaa', createdAt: at(0) },
	{ id: 'bbbbbbbb', createdAt: at(1) },
	{ id: 'cccccccc', createdAt: at(2) }
];
const even = new Map(designs.map((d) => [d.id, 1]));

const duel = (designLo: string, designHi: string, winnerId: string | null): StoredDuel => ({
	designLo,
	designHi,
	winnerId
});

describe('decided', () => {
	it('turns a won Duel into winner and loser, whichever side of the pair won', () => {
		expect(
			decided([duel('aaaaaaaa', 'bbbbbbbb', 'aaaaaaaa'), duel('aaaaaaaa', 'bbbbbbbb', 'bbbbbbbb')])
		).toEqual([
			{ winner: 'aaaaaaaa', loser: 'bbbbbbbb' },
			{ winner: 'bbbbbbbb', loser: 'aaaaaaaa' }
		]);
	});

	it('drops Skips', () => {
		expect(decided([duel('aaaaaaaa', 'bbbbbbbb', null)])).toEqual([]);
	});
});

describe('standings', () => {
	it('counts wins and losses from decided Duels', () => {
		const s = standings(
			designs,
			decided([
				duel('aaaaaaaa', 'bbbbbbbb', 'aaaaaaaa'),
				duel('aaaaaaaa', 'cccccccc', 'aaaaaaaa'),
				duel('bbbbbbbb', 'cccccccc', 'cccccccc')
			]),
			even
		);
		expect(s.get('aaaaaaaa')).toMatchObject({ wins: 2, losses: 0 });
		expect(s.get('bbbbbbbb')).toMatchObject({ wins: 0, losses: 2 });
		expect(s.get('cccccccc')).toMatchObject({ wins: 1, losses: 1 });
	});

	it('a Skip counts as neither a win nor a loss', () => {
		const s = standings(designs, decided([duel('aaaaaaaa', 'bbbbbbbb', null)]), even);
		expect(s.get('aaaaaaaa')).toMatchObject({ wins: 0, losses: 0 });
		expect(s.get('bbbbbbbb')).toMatchObject({ wins: 0, losses: 0 });
	});

	it('a Design without Duels has no wins or losses, whatever its strength from the prior', () => {
		const s = standings(designs, [], new Map([['aaaaaaaa', 2.5]]));
		expect(s.get('aaaaaaaa')).toMatchObject({ wins: 0, losses: 0, provisional: true });
	});

	it('ignores Duels with a Design that is not on the Leaderboard', () => {
		const s = standings(designs, [{ winner: 'aaaaaaaa', loser: 'zzzzzzzz' }], even);
		expect(s.get('aaaaaaaa')).toMatchObject({ wins: 0, losses: 0 });
		expect(s.has('zzzzzzzz')).toBe(false);
	});

	it('a Design is provisional below 5 decided Duels, not at 5', () => {
		const wins = (n: number) =>
			Array.from({ length: n }, () => ({ winner: 'aaaaaaaa', loser: 'bbbbbbbb' }));
		expect(standings(designs, wins(4), even).get('aaaaaaaa')!.provisional).toBe(true);
		expect(standings(designs, wins(5), even).get('aaaaaaaa')!.provisional).toBe(false);
		expect(standings(designs, wins(5), even).get('cccccccc')!.provisional).toBe(true);
	});

	it('ranks by strength, the strongest first', () => {
		const strength = new Map([
			['aaaaaaaa', 0.5],
			['bbbbbbbb', 2],
			['cccccccc', 1]
		]);
		const s = standings(designs, [], strength);
		expect([s.get('bbbbbbbb')!.rank, s.get('cccccccc')!.rank, s.get('aaaaaaaa')!.rank]).toEqual([
			1, 2, 3
		]);
	});

	it('equal strength puts the newer Design first', () => {
		const s = standings(designs, [], even);
		expect(s.get('cccccccc')!.rank).toBe(1);
		expect(s.get('bbbbbbbb')!.rank).toBe(2);
		expect(s.get('aaaaaaaa')!.rank).toBe(3);
	});

	it('strengths that differ only by noise count as equal: newer first', () => {
		const s = standings(
			designs,
			[],
			new Map([
				['aaaaaaaa', 1.3 * (1 + 1e-12)],
				['bbbbbbbb', 1.3],
				['cccccccc', 1.3 * (1 - 1e-12)]
			])
		);
		expect(s.get('cccccccc')!.rank).toBe(1);
		expect(s.get('bbbbbbbb')!.rank).toBe(2);
		expect(s.get('aaaaaaaa')!.rank).toBe(3);
	});

	it('equal strength and publish time falls back to the id', () => {
		const twins = [
			{ id: 'yyyyyyyy', createdAt: at(5) },
			{ id: 'xxxxxxxx', createdAt: at(5) }
		];
		const s = standings(twins, [], new Map());
		expect(s.get('xxxxxxxx')!.rank).toBe(1);
		expect(s.get('yyyyyyyy')!.rank).toBe(2);
	});

	it('gives every Design a distinct rank from 1', () => {
		const s = standings(designs, [], even);
		expect([...s.values()].map((x) => x.rank).sort()).toEqual([1, 2, 3]);
	});
});
