/** Movement in px after which a gesture on a dock tile is decided */
export const DRAG_THRESHOLD = 6;

/**
 * Decides what a gesture that started on a dock tile does, from its movement so far: nothing yet
 * (`pending`, under 6 px), scroll the dock (mostly sideways) or drag the Piece out (anything else).
 */
export function dragAxis(dx: number, dy: number): 'pending' | 'scroll' | 'drag' {
	if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return 'pending';
	return Math.abs(dx) > Math.abs(dy) ? 'scroll' : 'drag';
}
