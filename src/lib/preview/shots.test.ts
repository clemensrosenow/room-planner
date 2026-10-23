import { describe, expect, it } from 'vitest';
import { GEO } from '../planner/room';
import { makeShots } from './shots';

describe('makeShots for the real Room', () => {
	it('starts with the view from above, then the door, the window and the corners', () => {
		const ids = makeShots(GEO).map((s) => s.id);
		expect(ids.slice(0, 3)).toEqual(['above', 'door', 'window']);
		expect(ids.slice(3).length).toBeGreaterThan(0);
		expect(ids.slice(3).every((id) => id.startsWith('corner'))).toBe(true);
	});

	it('only cuts the ceiling away for the view from above', () => {
		expect(
			makeShots(GEO)
				.filter((s) => s.cutaway)
				.map((s) => s.id)
		).toEqual(['above']);
	});
});
