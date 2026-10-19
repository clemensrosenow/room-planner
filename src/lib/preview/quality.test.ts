import { describe, expect, it } from 'vitest';
import { isPhone } from './quality';

describe('isPhone', () => {
	it('a small touch screen is a phone', () => {
		expect(isPhone({ coarse: true, shortSide: 390 })).toBe(true);
	});

	it('a tablet is not a phone', () => {
		expect(isPhone({ coarse: true, shortSide: 768 })).toBe(false);
	});

	it('a laptop with a mouse is not a phone, even in a narrow window', () => {
		expect(isPhone({ coarse: false, shortSide: 390 })).toBe(false);
	});
});
