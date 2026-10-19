/**
 * What onboarding shows when (docs/specs/onboarding.md). Plain logic, no DOM or storage: the pages
 * describe the situation, this decides.
 */

export type HintId = 'drag-in' | 'move-turn' | 'conflict' | 'ready' | 'experience';

/** What this Device has seen of the onboarding, kept in `localStorage`. */
export interface Onboarding {
	/** The welcome card was closed in any way */
	welcomed: boolean;
	/** The link-arrival card was closed in any way */
	arrival: boolean;
	/** Hints closed or completed; they never come back */
	hints: Partial<Record<HintId, true>>;
}

export type Page = 'furnish' | 'experience' | 'design' | 'duel' | 'designs';

export interface Situation {
	page: Page;
	state: Onboarding;
	/** Pieces in the Room */
	placed: number;
	/** Pieces in the Inventory */
	total: number;
	conflicts: number;
	/** A Piece is selected and its toolbar is visible */
	selected: boolean;
	/** A pointer is held down (a Piece is being dragged, the camera turned) */
	dragging: boolean;
	/** A modal dialog is open */
	dialogOpen: boolean;
	/** On a Design page, the Design was published by this Device */
	ownDesign: boolean;
}

export type Shown = 'welcome' | 'arrival' | HintId | null;

const HINT_IDS: HintId[] = ['drag-in', 'move-turn', 'conflict', 'ready', 'experience'];

export const FRESH: Onboarding = { welcomed: false, arrival: false, hints: {} };

/**
 * Reads the stored onboarding state. Nothing stored yet but a Draft with Pieces in it means the
 * Device used the app before onboarding existed: it skips the welcome and the first steps.
 */
export function parseOnboarding(raw: unknown, draftEmpty: boolean): Onboarding {
	if (raw && typeof raw === 'object') {
		const o = raw as Partial<Record<keyof Onboarding, unknown>>;
		const hints: Onboarding['hints'] = {};
		if (o.hints && typeof o.hints === 'object')
			for (const id of HINT_IDS)
				if ((o.hints as Record<string, unknown>)[id] === true) hints[id] = true;
		return { welcomed: o.welcomed === true, arrival: o.arrival === true, hints };
	}
	if (draftEmpty) return { ...FRESH, hints: {} };
	return { welcomed: true, arrival: true, hints: { 'drag-in': true, 'move-turn': true } };
}

const onStep = (p: Page) => p === 'furnish' || p === 'experience';

/** The one thing to show now: the welcome card, the arrival card, one hint, or nothing. */
export function nextOnboarding(s: Situation): Shown {
	const { state, page } = s;
	if (onStep(page) && !state.welcomed) return 'welcome';
	if (!onStep(page) && !state.arrival && !state.welcomed && s.placed === 0 && !s.ownDesign)
		return 'arrival';
	if (s.dialogOpen || s.dragging) return null;

	const open = (id: HintId) => !state.hints[id];
	if (page === 'furnish') {
		if (open('conflict') && s.conflicts > 0) return 'conflict';
		if (open('ready') && publishProgress(s.placed, s.total, s.conflicts).kind === 'ready')
			return 'ready';
		if (open('drag-in') && s.placed === 0) return 'drag-in';
		if (open('move-turn') && s.selected) return 'move-turn';
	}
	if (page === 'experience' && open('experience')) return 'experience';
	return null;
}

export type PublishProgress =
	| { kind: 'pieces'; placed: number; total: number; conflicts: number }
	| { kind: 'conflicts'; conflicts: number }
	| { kind: 'ready' };

/** Where the Draft stands on the way to publishing: Pieces left, then Conflicts, then ready. */
export function publishProgress(placed: number, total: number, conflicts: number): PublishProgress {
	if (placed < total) return { kind: 'pieces', placed, total, conflicts };
	if (conflicts > 0) return { kind: 'conflicts', conflicts };
	return { kind: 'ready' };
}

/** The Publish button's state in words, for screen readers and tooltips. */
export function describeProgress(p: PublishProgress): string {
	const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
	if (p.kind === 'pieces')
		return `Publish: place ${plural(p.total - p.placed, 'more piece')} first`;
	if (p.kind === 'conflicts') return `Publish: resolve ${plural(p.conflicts, 'conflict')} first`;
	return 'Publish';
}
