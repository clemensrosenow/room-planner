/**
 * The Device: a random secret id in localStorage, the only notion of identity (ADR 0001). The
 * server only stores its hash. Clearing storage makes a new Device.
 */
const DEVICE_KEY = 'room-planner-device';
const DESIGNER_KEY = 'room-planner-designer';

let fallback: string | undefined;

export function deviceId(): string {
	try {
		let id = localStorage.getItem(DEVICE_KEY);
		if (!id) {
			id = crypto.randomUUID();
			localStorage.setItem(DEVICE_KEY, id);
		}
		return id;
	} catch {
		// Storage blocked: an id for this page view only
		return (fallback ??= crypto.randomUUID());
	}
}

/** The Designer name used last, to pre-fill the next publish. */
export function lastDesigner(): string {
	try {
		return localStorage.getItem(DESIGNER_KEY) ?? '';
	} catch {
		return '';
	}
}

export function rememberDesigner(name: string) {
	try {
		localStorage.setItem(DESIGNER_KEY, name);
	} catch {
		// ignore
	}
}
