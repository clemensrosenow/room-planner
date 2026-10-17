import { describe, expect, it } from 'vitest';
import { duelRecord, shareDescription, winRate } from './format';

describe('winRate', () => {
	it('is "–" for a Design without decided Duels', () => {
		expect(winRate({ wins: 0, losses: 0 })).toBe('–');
	});

	it('rounds the share of Duels won', () => {
		expect(winRate({ wins: 2, losses: 1 })).toBe('67%');
		expect(winRate({ wins: 1, losses: 2 })).toBe('33%');
		expect(winRate({ wins: 3, losses: 0 })).toBe('100%');
		expect(winRate({ wins: 0, losses: 4 })).toBe('0%');
	});
});

describe('duelRecord', () => {
	it('shows wins–losses and the win rate', () => {
		expect(duelRecord({ wins: 3, losses: 1 })).toBe('3–1 · 75%');
		expect(duelRecord({ wins: 0, losses: 0 })).toBe('0–0 · –');
	});
});

describe('shareDescription', () => {
	const standing = { rank: 3, wins: 4, losses: 2, provisional: false };

	it('names the Designer and the Rank', () => {
		expect(shareDescription({ ...standing, designer: 'Mia' })).toBe('by Mia · Rank #3');
	});

	it('says New while the Rank is provisional', () => {
		expect(shareDescription({ ...standing, provisional: true, designer: 'Mia' })).toBe(
			'by Mia · New'
		);
	});

	it('falls back to Anonymous', () => {
		expect(shareDescription({ ...standing, designer: null })).toBe('by Anonymous · Rank #3');
	});
});
