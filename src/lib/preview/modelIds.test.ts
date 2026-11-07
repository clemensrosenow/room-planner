import { describe, expect, it } from 'vitest';
import { GEO, INVENTORY } from '../planner/room';
import { previewModelIds } from './modelIds';

describe('preview model preloads', () => {
	it('an empty Draft loads only the Room Fixtures', () => {
		expect(previewModelIds(GEO, [])).toEqual(['radiator', 'ikea-ps2014-lamp']);
	});

	it('includes Packet parts and loads each required model once', () => {
		const furn = INVENTORY.map((piece) => ({ ...piece, cx: 100, cy: 100, rot: 0 }));
		expect(previewModelIds(GEO, [...furn, ...furn]).sort()).toEqual([
			'ikea-kallax',
			'ikea-markus-chair',
			'ikea-nymo-lamp',
			'ikea-ps2014-lamp',
			'ikea-skaftet-lamp',
			'keyboard-stand',
			'radiator',
			'yamaha-p45'
		]);
	});

	it('omits absent Fixtures and unknown model names', () => {
		const piece = { ...INVENTORY[0], model: '../untrusted', cx: 100, cy: 100, rot: 0 };
		expect(previewModelIds({ ...GEO, radiator: null, ceilingLamp: null }, [piece])).toEqual([]);
	});
});
