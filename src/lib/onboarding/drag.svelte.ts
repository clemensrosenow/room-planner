/**
 * Whether a drag is in progress: a pointer held down and moved a few px (a Piece dragged, the
 * camera turned). Hints wait for it to end. Plain clicks don't count, so selecting a Piece doesn't
 * make a hint flicker, and presses inside a hint are ignored.
 */
export class DragWatch {
	active = $state(false);
	#press: { x: number; y: number } | null = null;

	down = (e: PointerEvent) => {
		if ((e.target as Element | null)?.closest?.('[data-onboarding]')) return;
		this.#press = { x: e.clientX, y: e.clientY };
	};

	move = (e: PointerEvent) => {
		const p = this.#press;
		if (p && !this.active && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 4) this.active = true;
	};

	up = () => {
		this.#press = null;
		this.active = false;
	};
}
