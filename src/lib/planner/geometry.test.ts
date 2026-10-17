import { describe, expect, it } from 'vitest';
import { computeGeometry, floorRects } from './geometry';
import { GEO, ROOM } from './room';
import type { RoomConfig } from './types';

/** The real Room with some inputs changed. */
const room = (over: Partial<RoomConfig>): RoomConfig => ({ ...ROOM, ...over });

describe('computeGeometry for the real Room', () => {
	it('needs no clamping', () => {
		expect(GEO.issues).toEqual([]);
		expect(GEO.W).toBe(ROOM.W);
		expect(GEO.L).toBe(ROOM.L);
		expect(GEO.H).toBe(ROOM.H);
	});

	it('has the hallway corner, so the room door sits in the wall beside it', () => {
		expect(GEO.hasNotch).toBe(true);
		expect(GEO.doorY).toBe(ROOM.N);
		expect(GEO.doorWallLen).toBe(ROOM.NW);
	});

	it('subtracts the hallway corner from the floor area', () => {
		expect(GEO.area).toBe(ROOM.W * ROOM.L - ROOM.NW * ROOM.N);
		expect(GEO.loggiaArea).toBe(ROOM.W * ROOM.loggia.D);
	});

	it('traces the floor clockwise around the hallway corner and the window bay', () => {
		const { W, L, NW, N } = ROOM;
		const bay = ROOM.front.bay!;
		const { gx0, gx1 } = GEO.front;
		expect(GEO.poly).toEqual([
			[NW, 0],
			[W, 0],
			[W, L - bay],
			[gx1, L - bay],
			[gx1, L],
			[gx0, L],
			[gx0, L - bay],
			[0, L - bay],
			[0, N],
			[NW, N]
		]);
	});

	it('places the glass front between the wall pieces', () => {
		expect(GEO.front.gx0).toBe(ROOM.front.wl);
		expect(GEO.front.gx1).toBe(ROOM.W - ROOM.front.wr);
		expect(GEO.front.bay).toBe(ROOM.front.bay);
	});

	it('swings both doors into the room from their hinge', () => {
		const [door, balcony] = GEO.doors;
		expect(door).toMatchObject({ key: 'door', name: 'room door', inward: true, glass: false });
		expect(door.x0).toBe(ROOM.door.off);
		expect(door.w).toBe(ROOM.door.w);
		expect(door.y).toBe(GEO.doorY);
		// Left hinge, opening towards the loggia (+y)
		expect(door.hinge).toEqual([door.x0, door.y]);
		expect(door.closed).toEqual([1, 0]);
		expect(door.open).toEqual([0, 1]);
		expect(door.openEnd).toEqual([door.x0, door.y + door.w]);

		expect(balcony).toMatchObject({ key: 'balcony', name: 'balcony door', inward: true });
		expect(balcony.glass).toBe(true);
		expect(balcony.y).toBe(ROOM.L);
		// Right hinge, opening away from the loggia (-y)
		expect(balcony.hinge).toEqual([balcony.x1, ROOM.L]);
		expect(balcony.closed).toEqual([-1, 0]);
		expect(balcony.open).toEqual([0, -1]);
	});

	it('stands the radiator against the right wall, its offset before the window bay', () => {
		const r = ROOM.radiator!;
		expect(GEO.radiator).toEqual({
			x0: ROOM.W - r.d,
			x1: ROOM.W,
			y0: ROOM.L - ROOM.front.bay! - r.off - r.w,
			y1: ROOM.L - ROOM.front.bay! - r.off,
			h: r.h
		});
	});

	it('keeps the ceiling lamp where the Room puts it', () => {
		expect(GEO.ceilingLamp).toEqual(ROOM.ceilingLamp);
	});
});

describe('computeGeometry without hallway corner or window bay', () => {
	const g = computeGeometry(room({ NW: 0, N: 0, front: { ...ROOM.front, bay: 0 } }));

	it('is a plain rectangle with the room door in the back wall', () => {
		expect(g.hasNotch).toBe(false);
		expect(g.doorY).toBe(0);
		expect(g.doorWallLen).toBe(ROOM.W);
		expect(g.poly).toEqual([
			[0, 0],
			[ROOM.W, 0],
			[ROOM.W, ROOM.L],
			[0, ROOM.L]
		]);
		expect(g.area).toBe(ROOM.W * ROOM.L);
	});

	it('has one floor rectangle', () => {
		expect(floorRects(g)).toEqual([{ x0: 0, y0: 0, x1: ROOM.W, y1: ROOM.L }]);
	});
});

describe('computeGeometry clamps impossible inputs and says why', () => {
	it('clamps the room size to 100–2000 cm', () => {
		const g = computeGeometry(room({ W: 50, L: 5000, H: 100 }));
		expect(g.W).toBe(100);
		expect(g.L).toBe(2000);
		expect(g.H).toBe(150);
		expect(g.issues).toContain('Total width is outside 100–2000 cm.');
		expect(g.issues).toContain('Length is outside 100–2000 cm.');
		expect(g.issues).toContain('Ceiling height is outside 150–500 cm.');
	});

	it('leaves at least 40 cm beside the hallway corner', () => {
		const g = computeGeometry(room({ NW: ROOM.W, N: ROOM.L }));
		expect(g.NW).toBe(ROOM.W - 40);
		expect(g.N).toBe(ROOM.L - 40);
		expect(g.issues).toContain('Hallway corner is wider than the room. Reduce its width.');
		expect(g.issues).toContain('Hallway corner is deeper than the room. Reduce its depth.');
	});

	it('keeps the room door within its wall', () => {
		const wide = computeGeometry(room({ door: { ...ROOM.door, w: 1000 } }));
		expect(wide.doors[0].w).toBe(ROOM.NW);
		expect(wide.doors[0].x0).toBe(0);
		expect(wide.issues).toContain('Room door is wider than its wall.');

		const past = computeGeometry(room({ door: { ...ROOM.door, off: 1000 } }));
		expect(past.doors[0].x1).toBe(ROOM.NW);
		expect(past.issues).toContain('Room door extends past its wall. Check offset or width.');
	});

	it('keeps the balcony door within the glass front', () => {
		const g = computeGeometry(
			room({ front: { ...ROOM.front, door: { ...ROOM.front.door, off: 0 } } })
		);
		expect(g.front.bOff).toBe(g.front.gx0);
		expect(g.issues).toContain(
			'Balcony door lies outside the glass front. Check its offset from the left wall.'
		);
	});

	it('shortens a radiator longer than its wall', () => {
		const g = computeGeometry(room({ radiator: { ...ROOM.radiator!, w: 5000 } }));
		const wallLen = ROOM.L - ROOM.front.bay!;
		expect(g.radiator!.y1 - g.radiator!.y0).toBe(wallLen);
		expect(g.radiator!.y0).toBe(0);
		expect(g.issues).toContain('Radiator is longer than its wall.');
	});

	it('pulls a radiator back onto its wall', () => {
		const g = computeGeometry(room({ radiator: { ...ROOM.radiator!, off: 5000 } }));
		expect(g.radiator!.y0).toBe(0);
		expect(g.issues).toContain('Radiator extends past its wall.');
	});

	it('measures a radiator on the left wall from the hallway corner', () => {
		const r = { ...ROOM.radiator!, wall: 'left' as const, w: 5000 };
		const g = computeGeometry(room({ radiator: r }));
		expect(g.radiator!.x0).toBe(0);
		expect(g.radiator!.x1).toBe(r.d);
		expect(g.radiator!.y0).toBe(ROOM.N);
		expect(g.radiator!.y1).toBe(ROOM.L - ROOM.front.bay!);
	});

	it('has no radiator when the Room has none', () => {
		expect(computeGeometry(room({ radiator: undefined })).radiator).toBeNull();
	});

	it('moves the ceiling lamp inside the room', () => {
		const g = computeGeometry(room({ ceilingLamp: { model: 'x', x: -50, y: 9999 } }));
		expect(g.ceilingLamp).toEqual({ model: 'x', x: 0, y: g.L });
	});

	it('reports each problem once', () => {
		const g = computeGeometry(room({ W: 10 }));
		expect(g.issues.filter((m) => m.startsWith('Total width'))).toHaveLength(1);
	});
});

describe('floorRects', () => {
	it('covers the main part, the strip beside the hallway corner and the window bay', () => {
		const end = ROOM.L - ROOM.front.bay!;
		const { gx0, gx1 } = GEO.front;
		expect(floorRects(GEO)).toEqual([
			{ x0: 0, y0: ROOM.N, x1: ROOM.W, y1: end },
			{ x0: ROOM.NW, y0: 0, x1: ROOM.W, y1: end },
			{ x0: gx0, y0: ROOM.N, x1: gx1, y1: ROOM.L },
			{ x0: Math.max(gx0, ROOM.NW), y0: 0, x1: gx1, y1: ROOM.L }
		]);
	});
});
