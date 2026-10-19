/** What the 3D views need to know about the screen to pick their rendering cost. */
export interface Screen {
	/** Primary input is a finger (`pointer: coarse`) */
	coarse: boolean;
	/** Shorter side of the screen in CSS px */
	shortSide: number;
}

/**
 * Phones: touch screens narrower than a small tablet. Their GPUs get cheaper settings (lower
 * resolution, fewer samples, no ambient occlusion, smaller shadow maps).
 */
export const isPhone = (s: Screen) => s.coarse && s.shortSide < 600;

/** The current screen, or a desktop one where there is no window. */
export function currentScreen(): Screen {
	if (typeof window === 'undefined') return { coarse: false, shortSide: Infinity };
	return {
		coarse: window.matchMedia('(pointer: coarse)').matches,
		shortSide: Math.min(window.screen.width, window.screen.height)
	};
}
