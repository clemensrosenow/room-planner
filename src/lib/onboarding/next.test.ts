import { describe, expect, it } from 'vitest';
import { INVENTORY } from '../planner/room';
import {
	describeProgress,
	FRESH,
	nextOnboarding,
	parseOnboarding,
	publishProgress,
	type Onboarding,
	type Situation
} from './next';

const total = INVENTORY.length;
const welcomed: Onboarding = { welcomed: true, arrival: false, hints: {} };

const situation = (s: Partial<Situation> = {}): Situation => ({
	page: 'furnish',
	state: welcomed,
	placed: 0,
	total,
	conflicts: 0,
	selected: false,
	dragging: false,
	dialogOpen: false,
	ownDesign: false,
	...s
});

describe('nextOnboarding', () => {
	it('a new Device on Furnish gets the welcome card', () => {
		expect(nextOnboarding(situation({ state: FRESH }))).toBe('welcome');
	});

	it('a new Device opening Experience first gets the welcome card too', () => {
		expect(nextOnboarding(situation({ page: 'experience', state: FRESH }))).toBe('welcome');
	});

	it('an empty Room with the welcome card closed gets the drag-in hint', () => {
		expect(nextOnboarding(situation())).toBe('drag-in');
	});

	it('a selected Piece gets the move-turn hint once drag-in is done', () => {
		const state = { ...welcomed, hints: { 'drag-in': true as const } };
		expect(nextOnboarding(situation({ state, placed: 1, selected: true }))).toBe('move-turn');
	});

	it('a Conflict wins over every other hint', () => {
		expect(nextOnboarding(situation({ placed: 2, conflicts: 1, selected: true }))).toBe('conflict');
	});

	it('nothing shows while a Piece is being dragged', () => {
		expect(nextOnboarding(situation({ placed: 2, conflicts: 1, dragging: true }))).toBeNull();
	});

	it('nothing shows while a dialog is open', () => {
		expect(nextOnboarding(situation({ dialogOpen: true }))).toBeNull();
	});

	it('a Draft with every Piece placed and no Conflicts gets the ready hint', () => {
		expect(nextOnboarding(situation({ placed: total }))).toBe('ready');
	});

	it('a dismissed hint never comes back', () => {
		const state = { ...welcomed, hints: { 'drag-in': true as const } };
		expect(nextOnboarding(situation({ state }))).toBeNull();
	});

	it('Experience gets its own hint, and none of the Furnish ones', () => {
		expect(nextOnboarding(situation({ page: 'experience', placed: 2, conflicts: 1 }))).toBe(
			'experience'
		);
	});

	it('a new Device opening a shared Design gets the arrival card', () => {
		expect(nextOnboarding(situation({ page: 'design', state: FRESH }))).toBe('arrival');
	});

	it("a Device's own Published Design never gets the arrival card", () => {
		expect(nextOnboarding(situation({ page: 'design', state: FRESH, ownDesign: true }))).toBeNull();
	});

	it('a Device that already has Pieces in its Draft gets no arrival card', () => {
		expect(nextOnboarding(situation({ page: 'duel', state: FRESH, placed: 3 }))).toBeNull();
	});

	it('the arrival card shows only once, on whichever page comes first', () => {
		const state = { ...FRESH, arrival: true };
		expect(nextOnboarding(situation({ page: 'designs', state }))).toBeNull();
	});
});

describe('publishProgress', () => {
	it('a Draft with Pieces left counts them, with its Conflicts', () => {
		expect(publishProgress(5, total, 1)).toEqual({
			kind: 'pieces',
			placed: 5,
			total,
			conflicts: 1
		});
	});

	it('a Draft with every Piece placed but a Conflict needs that fixed', () => {
		expect(publishProgress(total, total, 2)).toEqual({ kind: 'conflicts', conflicts: 2 });
	});

	it('a Draft with every Piece placed and no Conflicts is ready to publish', () => {
		expect(publishProgress(total, total, 0)).toEqual({ kind: 'ready' });
	});

	it('says what is left in words', () => {
		expect(describeProgress(publishProgress(total - 1, total, 0))).toBe(
			'Publish: place 1 more piece first'
		);
		expect(describeProgress(publishProgress(total, total, 2))).toBe(
			'Publish: resolve 2 conflicts first'
		);
		expect(describeProgress(publishProgress(total, total, 0))).toBe('Publish');
	});
});

describe('parseOnboarding', () => {
	it('a new Device with an empty Draft starts fresh', () => {
		expect(parseOnboarding(null, true)).toEqual(FRESH);
	});

	it('a Device with Pieces placed before onboarding existed skips the first steps', () => {
		expect(parseOnboarding(null, false)).toEqual({
			welcomed: true,
			arrival: true,
			hints: { 'drag-in': true, 'move-turn': true }
		});
	});

	it('keeps known hints and drops anything else', () => {
		const raw = { welcomed: true, arrival: 'yes', hints: { ready: true, nope: true, conflict: 1 } };
		expect(parseOnboarding(raw, false)).toEqual({
			welcomed: true,
			arrival: false,
			hints: { ready: true }
		});
	});
});
