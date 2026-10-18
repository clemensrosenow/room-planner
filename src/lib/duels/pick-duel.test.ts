import { describe, expect, it } from 'vitest';
import { pickDuel } from './pick-duel';
import { pairKey, type DuelCandidate } from './types';

const design = (id: string, mine = false): DuelCandidate => ({ id, mine, duels: 0, strength: 1 });
const first = () => 0;

describe('pickDuel', () => {
	it('with no Published Designs from others there are too few to judge', () => {
		expect(pickDuel([design('aaaaaaaa', true)], new Set(), first)).toEqual({
			pair: null,
			reason: 'too-few'
		});
	});

	it('with one Published Design from others there are too few to judge', () => {
		const candidates = [design('aaaaaaaa', true), design('bbbbbbbb')];
		expect(pickDuel(candidates, new Set(), first)).toEqual({ pair: null, reason: 'too-few' });
	});

	it('with two Published Designs from others whose pair was judged, every pair is judged', () => {
		const candidates = [design('aaaaaaaa', true), design('bbbbbbbb'), design('cccccccc')];
		const seen = new Set([pairKey('bbbbbbbb', 'cccccccc')]);
		expect(pickDuel(candidates, seen, first)).toEqual({ pair: null, reason: 'all-judged' });
	});

	it('with two Published Designs from others not yet judged, they are the next Duel', () => {
		const candidates = [design('aaaaaaaa', true), design('bbbbbbbb'), design('cccccccc')];
		const result = pickDuel(candidates, new Set(), first);
		expect(result.pair).not.toBeNull();
		expect([...result.pair!].sort()).toEqual(['bbbbbbbb', 'cccccccc']);
	});
});
