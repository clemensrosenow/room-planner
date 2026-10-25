import { describe, expect, it } from 'vitest';
import {
	bbox,
	checkFurniture,
	describeCheck,
	elevation,
	footprint,
	insideRoom,
	keepInside,
	supportOf
} from './furniture';
import { computeGeometry, floorRects, type Door } from './geometry';
import { conflictIds, designFurniture, GEO, INVENTORY, ROOM } from './room';
import type { Furniture } from './types';

/** A Piece of the real Inventory, standing at (cx, cy) and turned by rot degrees. */
function piece(id: string, cx: number, cy: number, rot = 0): Furniture {
	const [f] = designFurniture({ [id]: { cx, cy, rot } });
	if (!f) throw new Error(`No Piece ${id} in the Inventory`);
	return f;
}

const check = (f: Furniture, all: Furniture[] = [f], g = GEO) => checkFurniture(f, all, g);

const nightstand = INVENTORY.find((p) => p.id === 'nightstand')!;
const radiator = GEO.radiator!;
const [roomDoor, balconyDoor] = GEO.doors;
// The middle of the main part of the floor, well away from doors, walls and the radiator
const main = floorRects(GEO)[0];
const mid = { x: (main.x0 + main.x1) / 2, y: (main.y0 + main.y1) / 2 };

describe('checkFurniture: a Piece with room around it', () => {
	it('has no Conflict', () => {
		const f = piece('nightstand', mid.x, mid.y);
		expect(check(f)).toEqual({ doors: [], overlap: [], outside: false, bad: false });
	});
});

describe('checkFurniture: sticking out of the Room is a Conflict', () => {
	it('in the hallway corner', () => {
		const f = piece('nightstand', ROOM.NW / 2, ROOM.N / 2);
		expect(check(f)).toMatchObject({ outside: true, bad: true });
	});

	it('through a side wall', () => {
		const f = piece('nightstand', ROOM.W, mid.y);
		expect(check(f)).toMatchObject({ outside: true, bad: true });
	});

	it('depends on how the Piece is turned', () => {
		// Long side along x pokes through the right wall; turned 90°, it stands flush against it
		const wardrobe = INVENTORY.find((p) => p.id === 'wardrobe')!;
		const cx = ROOM.W - wardrobe.d / 2;
		expect(check(piece('wardrobe', cx, mid.y, 0)).outside).toBe(true);
		expect(check(piece('wardrobe', cx, mid.y, 90)).outside).toBe(false);
	});

	it('not when standing flush against the wall', () => {
		const f = piece('nightstand', ROOM.W - nightstand.w / 2, mid.y);
		expect(insideRoom(f, GEO)).toBe(true);
		expect(check(f).bad).toBe(false);
	});
});

describe('checkFurniture: overlapping another Piece is a Conflict', () => {
	it('for both Pieces, naming the other', () => {
		const wardrobe = piece('wardrobe', mid.x, mid.y);
		const stand = piece('nightstand', mid.x + 50, mid.y);
		const all = [wardrobe, stand];
		expect(check(wardrobe, all)).toMatchObject({ overlap: ['Nightstand'], bad: true });
		expect(check(stand, all)).toMatchObject({ overlap: ['Wardrobe'], bad: true });
	});

	it('not when the Pieces only touch', () => {
		const stand = piece('nightstand', mid.x, mid.y);
		const kallax = INVENTORY.find((p) => p.id === 'kallax')!;
		const beside = piece('kallax', mid.x - nightstand.w / 2 - kallax.w / 2, mid.y);
		const all = [stand, beside];
		expect(check(stand, all).overlap).toEqual([]);
		expect(check(beside, all).overlap).toEqual([]);
	});

	it('also for a Packet, by the box around its parts', () => {
		const workstation = INVENTORY.find((p) => p.id === 'workstation')!;
		const packet = piece('workstation', mid.x, mid.y);
		// Just inside the corner of the Packet's box, where the box is but maybe no part is
		const stand = piece(
			'nightstand',
			mid.x + workstation.w / 2 + nightstand.w / 2 - 2,
			mid.y + workstation.d / 2 + nightstand.d / 2 - 2
		);
		expect(check(stand, [packet, stand]).overlap).toEqual(['Workstation']);
	});
});

describe('checkFurniture: overlapping the radiator is a Conflict', () => {
	it('for a Piece standing against the wall in front of it', () => {
		const f = piece('nightstand', ROOM.W - nightstand.w / 2, (radiator.y0 + radiator.y1) / 2);
		expect(check(f)).toMatchObject({ outside: false, overlap: ['Radiator'], bad: true });
	});

	it('not for a Piece standing next to it', () => {
		const f = piece('nightstand', radiator.x0 - nightstand.w / 2, (radiator.y0 + radiator.y1) / 2);
		expect(check(f).overlap).toEqual([]);
	});
});

describe('checkFurniture: blocking a door is a Conflict', () => {
	/** Plan point `r` cm from the door's hinge, `deg` degrees open from its closed leaf */
	const inSwing = (dr: Door, deg: number, r: number): [number, number] => {
		const a = (deg * Math.PI) / 180;
		return [
			dr.hinge[0] + (dr.closed[0] * Math.cos(a) + dr.open[0] * Math.sin(a)) * r,
			dr.hinge[1] + (dr.closed[1] * Math.cos(a) + dr.open[1] * Math.sin(a)) * r
		];
	};
	// The 25 cm Table lamp fits well inside either half of a door's swing
	const lamp = (at: [number, number]) => piece('nymo-lamp', ...at);

	it('a Piece in the first 45° of the room door swing blocks it', () => {
		const f = lamp(inSwing(roomDoor, 22.5, roomDoor.w * 0.6));
		expect(check(f)).toMatchObject({ doors: ['room door'], outside: false, bad: true });
	});

	it('a Piece in the first 45° of the balcony door swing blocks it', () => {
		const f = lamp(inSwing(balconyDoor, 22.5, balconyDoor.w * 0.6));
		expect(check(f)).toMatchObject({ doors: ['balcony door'], outside: false, bad: true });
	});

	it('a Piece in the 45°–90° part of the swing is not a Conflict', () => {
		for (const dr of [roomDoor, balconyDoor]) {
			const f = lamp(inSwing(dr, 67.5, dr.w * 0.6));
			expect(check(f)).toEqual({ doors: [], overlap: [], outside: false, bad: false });
		}
	});

	it('a Piece reaching across the 45° line blocks the door', () => {
		const f = piece('nightstand', ...inSwing(roomDoor, 45, roomDoor.w * 0.6));
		expect(check(f).doors).toEqual(['room door']);
	});

	it('not beyond the reach of the leaf', () => {
		const out = roomDoor.w + nightstand.d;
		const f = piece('nightstand', roomDoor.hinge[0] + nightstand.w, roomDoor.hinge[1] + out);
		expect(check(f).doors).toEqual([]);
	});

	it('not when the door opens outwards, even within its swing', () => {
		const g = computeGeometry({ ...ROOM, door: { ...ROOM.door, swing: 'out' } });
		const out = g.doors[0];
		expect(out.inward).toBe(false);
		// The leaf sweeps the hallway; whatever stands there is outside the Room, not in the door's way
		const reach = out.w / 2;
		const f = piece(
			'nightstand',
			out.hinge[0] + out.open[0] * reach * 0.7 + out.closed[0] * reach * 0.7,
			out.hinge[1] + out.open[1] * reach * 0.7 + out.closed[1] * reach * 0.7
		);
		expect(check(f, [f], g)).toMatchObject({ doors: [], outside: true });
	});
});

describe('checkFurniture: a small Piece standing on another', () => {
	const stand = piece('nightstand', mid.x, mid.y);

	it('is supported by the Piece under its center and stands on its top', () => {
		const lamp = piece('nymo-lamp', mid.x, mid.y);
		const all = [stand, lamp];
		expect(supportOf(lamp, all)).toBe(stand);
		expect(elevation(lamp, all)).toBe(nightstand.h);
		expect(elevation(stand, all)).toBe(0);
	});

	it('does not overlap the Piece it stands on, nor the other way round', () => {
		const lamp = piece('nymo-lamp', mid.x, mid.y);
		const all = [stand, lamp];
		expect(check(lamp, all)).toMatchObject({ overlap: [], bad: false });
		expect(check(stand, all)).toMatchObject({ overlap: [], bad: false });
	});

	it('stands on the floor and overlaps when its center is off the other Piece', () => {
		const lamp = piece('nymo-lamp', mid.x + nightstand.w / 2 + 5, mid.y);
		const all = [stand, lamp];
		expect(supportOf(lamp, all)).toBeNull();
		expect(check(lamp, all).overlap).toEqual(['Nightstand']);
		expect(check(stand, all).overlap).toEqual(['Table lamp']);
	});

	it('does not overlap the radiator, but the Piece under it does', () => {
		const y = (radiator.y0 + radiator.y1) / 2;
		const low = piece('nightstand', ROOM.W - nightstand.w / 2, y);
		const lamp = piece('nymo-lamp', ROOM.W - nightstand.w / 2, y);
		const all = [low, lamp];
		expect(check(lamp, all).overlap).toEqual([]);
		expect(check(low, all).overlap).toEqual(['Radiator']);
	});

	it('is supported only if it is small enough', () => {
		const wardrobe = piece('wardrobe', mid.x, mid.y);
		expect(supportOf(stand, [wardrobe, stand])).toBeNull();
	});
});

describe('checkFurniture: a ceiling lamp', () => {
	const lamp: Furniture = {
		id: 'ceiling',
		name: 'Ceiling lamp',
		w: 36,
		d: 36,
		h: 85,
		cx: mid.x,
		cy: mid.y,
		rot: 0,
		color: 0,
		model: 'ikea-ps2014-lamp'
	};

	it('hangs above everything, so nothing overlaps it', () => {
		const stand = piece('nightstand', mid.x, mid.y);
		const all = [stand, lamp];
		expect(check(lamp, all)).toEqual({ doors: [], overlap: [], outside: false, bad: false });
		expect(check(stand, all).overlap).toEqual([]);
	});

	it('still must not stick out of the Room', () => {
		const out = { ...lamp, cx: ROOM.NW / 2, cy: ROOM.N / 2 };
		expect(check(out, [out])).toMatchObject({ outside: true, bad: true });
	});
});

describe('describeCheck', () => {
	it('puts every Conflict in plain words', () => {
		expect(
			describeCheck({
				outside: true,
				doors: ['room door'],
				overlap: ['Desk', 'Radiator'],
				bad: true
			})
		).toEqual([
			'Sticks out of the room',
			'Blocks the room door',
			'Overlaps Desk',
			'Overlaps Radiator'
		]);
	});

	it('says nothing without a check', () => {
		expect(describeCheck(undefined)).toEqual([]);
	});
});

describe('keepInside', () => {
	it('pushes a Piece the shortest way back inside the walls', () => {
		const f = piece('nightstand', ROOM.W + 10, mid.y);
		expect(keepInside(f, GEO)).toBe(true);
		expect(bbox(f).maxX).toBeCloseTo(ROOM.W);
		expect(f.cy).toBe(mid.y);
		expect(insideRoom(f, GEO)).toBe(true);
	});

	it('leaves a Piece alone that is already inside', () => {
		const f = piece('nightstand', mid.x, mid.y);
		expect(keepInside(f, GEO)).toBe(false);
		expect([f.cx, f.cy]).toEqual([mid.x, mid.y]);
	});

	// The strip where the hallway part meets the bay is narrower than the Workstation, so
	// centering it there would leave it half in a wall
	it('pushes a Workstation dropped in the hallway corner inside the Room', () => {
		const f = piece('workstation', 225, 100);
		keepInside(f, GEO);
		expect(insideRoom(f, GEO)).toBe(true);
	});

	it('pushes a Workstation dropped in the bay inside the Room', () => {
		const f = piece('workstation', 232, ROOM.L - 38);
		keepInside(f, GEO);
		expect(insideRoom(f, GEO)).toBe(true);
	});

	it('centers a Piece too big for the Room in its largest part', () => {
		const f: Furniture = { ...piece('nightstand', 0, 0), w: ROOM.W + 40, d: 50 };
		expect(keepInside(f, GEO)).toBe(true);
		expect(f.cx).toBeCloseTo(ROOM.W / 2);
	});
});

describe('conflictIds', () => {
	it('lists the Pieces with a Conflict in Inventory order', () => {
		const furn = designFurniture({
			nightstand: { cx: mid.x, cy: mid.y, rot: 0 },
			wardrobe: { cx: mid.x, cy: mid.y, rot: 0 },
			kallax: { cx: ROOM.NW / 2, cy: ROOM.N / 2, rot: 0 }
		});
		expect(conflictIds(furn)).toEqual(['wardrobe', 'kallax', 'nightstand']);
		expect(conflictIds([piece('nightstand', mid.x, mid.y)])).toEqual([]);
	});
});

describe('checkFurniture: a Piece with a Footprint of several boxes', () => {
	// Floor lamp at rot 0: a 48 cm foot up to 150 cm, the head from 150 cm reaching far right
	// (+x) and back (-y) of the foot
	const lamp = (cx: number, cy: number) => piece('floor-lamp', cx, cy);

	it('a floor lamp whose head reaches over the bed has no Conflict', () => {
		const f = lamp(mid.x, mid.y);
		const bed = piece('bed', mid.x + 25 + 70, mid.y - 50);
		expect(check(f, [f, bed])).toMatchObject({ overlap: [], bad: false });
		expect(check(bed, [f, bed]).bad).toBe(false);
	});

	it('a floor lamp whose head reaches into the wardrobe is a Conflict', () => {
		const f = lamp(mid.x, mid.y);
		const wardrobe = piece('wardrobe', mid.x + 25 + 75, mid.y - 50);
		expect(check(f, [f, wardrobe]).overlap).toEqual(['Wardrobe']);
	});

	it('a floor lamp whose head reaches through a wall sticks out of the Room', () => {
		const f = lamp(ROOM.W - 30, mid.y);
		expect(check(f)).toMatchObject({ outside: true, bad: true });
	});

	it('a floor lamp whose head hangs into the room door swing blocks it', () => {
		const [dx, dy] = [roomDoor.closed[0] + roomDoor.open[0], roomDoor.closed[1] + roomDoor.open[1]];
		const r = (0.45 * roomDoor.w) / Math.hypot(dx, dy);
		const head = footprint(lamp(0, 0))[1];
		const f = lamp(roomDoor.hinge[0] + dx * r - head.x, roomDoor.hinge[1] + dy * r - head.y);
		expect(check(f).doors).toContain(roomDoor.name);
	});

	it('keepInside pulls a floor lamp in until its head is inside the walls', () => {
		const f = lamp(ROOM.W - 30, mid.y);
		expect(keepInside(f, GEO)).toBe(true);
		expect(insideRoom(f, GEO)).toBe(true);
		expect(bbox(f).maxX).toBeCloseTo(ROOM.W);
	});
});
