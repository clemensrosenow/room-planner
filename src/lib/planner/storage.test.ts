import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadDraft } from './storage';

const KEY = 'room-planner-v1';

/** The Draft as an older version of the app saved it. */
function saved(roomId: string, placements: Record<string, unknown>) {
	localStorage.setItem(KEY, JSON.stringify({ schema: 2, roomId, placements }));
}

beforeEach(() => {
	const store = new Map<string, string>();
	vi.stubGlobal('localStorage', {
		getItem: (k: string) => store.get(k) ?? null,
		setItem: (k: string, v: string) => void store.set(k, v)
	});
});
afterEach(() => vi.unstubAllGlobals());

describe('loadDraft', () => {
	it('a Draft of clemens-v2 keeps the Pieces still in the Inventory', () => {
		saved('clemens-v2', {
			bed: { cx: 100, cy: 300, rot: 0 },
			desk: { cx: 200, cy: 300, rot: 0 },
			flipchart: { cx: 250, cy: 250, rot: 0 }
		});
		expect(loadDraft().placements).toEqual({ bed: { cx: 100, cy: 300, rot: 0 } });
	});

	it('a Draft of another Room starts over empty', () => {
		saved('clemens-v1', { bed: { cx: 100, cy: 300, rot: 0 } });
		expect(loadDraft().placements).toEqual({});
	});
});
