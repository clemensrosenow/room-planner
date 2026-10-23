import { describe, expect, it } from 'vitest';
import { dragAxis } from './dragAxis';

describe('dragAxis', () => {
	it('waits until a gesture on a dock tile has moved 6 px', () => {
		expect(dragAxis(0, 0)).toBe('pending');
		expect(dragAxis(5, 0)).toBe('pending');
		expect(dragAxis(-3, -4)).toBe('pending');
	});

	it('scrolls the dock on a sideways swipe', () => {
		expect(dragAxis(6, 0)).toBe('scroll');
		expect(dragAxis(-20, 5)).toBe('scroll');
	});

	it('drags the Piece into the room on an upward or diagonal movement', () => {
		expect(dragAxis(0, -6)).toBe('drag');
		expect(dragAxis(10, -10)).toBe('drag');
		expect(dragAxis(-4, -30)).toBe('drag');
		expect(dragAxis(0, 8)).toBe('drag');
	});
});
