import { describe, expect, it, vi } from 'vitest';

// No database in unit tests: db() fails the way it does without DATABASE_URL, synchronously
vi.mock('./db', () => ({
	db: () => {
		throw new Error('DATABASE_URL is not set');
	}
}));

const { nextDuel } = await import('./duels');

describe('nextDuel', () => {
	// An orphaned rejection from a parallel call is reported by vitest as an unhandled error,
	// which fails the run, so this test only has to give it time to surface.
	it('rejects once when the database is down, leaving no unhandled rejection behind', async () => {
		await expect(nextDuel('device')).rejects.toThrow('DATABASE_URL is not set');
		await new Promise((resolve) => setTimeout(resolve, 0));
	});
});
