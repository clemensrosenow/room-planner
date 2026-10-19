import { planner } from '#lib/planner/planner.svelte.ts';
import { FRESH, parseOnboarding, type HintId, type Onboarding } from './next';

const KEY = 'room-planner-onboarding';

/**
 * What this Device has seen of the onboarding, saved in `localStorage` on every change. Without
 * storage it lasts for the session, like the Draft.
 */
class OnboardingState {
	welcomed = $state(false);
	arrival = $state(false);
	hints = $state<Onboarding['hints']>({});

	constructor() {
		if (typeof localStorage === 'undefined') return;
		let raw: unknown = null;
		try {
			raw = JSON.parse(localStorage.getItem(KEY) ?? 'null');
		} catch {
			// Storage blocked or corrupt: treat as nothing stored
		}
		this.set(parseOnboarding(raw, planner.isEmpty));
		if (!raw) this.save();
	}

	get snapshot(): Onboarding {
		return { welcomed: this.welcomed, arrival: this.arrival, hints: { ...this.hints } };
	}

	closeWelcome() {
		if (this.welcomed) return;
		this.welcomed = true;
		this.save();
	}

	closeArrival() {
		if (this.arrival) return;
		this.arrival = true;
		this.save();
	}

	/** A hint was closed or completed: it never comes back on this Device. */
	done(id: HintId) {
		if (this.hints[id]) return;
		this.hints[id] = true;
		this.save();
	}

	/** "Show intro again": everything shows again. The Draft stays as it is. */
	reset() {
		this.set(FRESH);
		this.save();
	}

	private set(o: Onboarding) {
		this.welcomed = o.welcomed;
		this.arrival = o.arrival;
		this.hints = { ...o.hints };
	}

	private save() {
		try {
			localStorage.setItem(KEY, JSON.stringify(this.snapshot));
		} catch {
			// Storage blocked or full: keep it for this session
		}
	}
}

export const onboarding = new OnboardingState();
