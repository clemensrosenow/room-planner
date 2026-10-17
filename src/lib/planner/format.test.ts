import { describe, expect, it } from 'vitest';
import { cm, hexColor, isDark, m2, newId } from './format';

describe('cm', () => {
	it('rounds to whole centimetres', () => {
		expect(cm(42)).toBe('41');
		expect(cm(42.4)).toBe('42');
		expect(cm(42.5)).toBe('43');
		expect(cm(-0.4)).toBe('0');
	});
});

describe('m2', () => {
	it('turns cm² into m² with one decimal', () => {
		expect(m2(10000)).toBe('1.0 m²');
		expect(m2(158164)).toBe('15.8 m²');
		expect(m2(0)).toBe('0.0 m²');
	});
});

describe('hexColor', () => {
	it('pads to six hex digits', () => {
		expect(hexColor(0x1c2741)).toBe('#1c2741');
		expect(hexColor(0x0000ff)).toBe('#0000ff');
		expect(hexColor(0)).toBe('#000000');
		expect(hexColor(0xffffff)).toBe('#ffffff');
	});
});

describe('isDark', () => {
	it('wants light text on dark colors', () => {
		expect(isDark(0x000000)).toBe(true);
		expect(isDark(0x1c2741)).toBe(true);
		expect(isDark(0x232324)).toBe(true);
	});

	it('wants dark text on light colors', () => {
		expect(isDark(0xffffff)).toBe(false);
		expect(isDark(0xf1efea)).toBe(false);
		expect(isDark(0xc4a07a)).toBe(false);
	});

	it('weighs green more than red and blue', () => {
		expect(isDark(0x00ff00)).toBe(false);
		expect(isDark(0xff0000)).toBe(true);
		expect(isDark(0x0000ff)).toBe(true);
	});
});

describe('newId', () => {
	it('is an f followed by base-36 time and random digits', () => {
		expect(newId()).toMatch(/^f[0-9a-z]{6,}$/);
	});
});
