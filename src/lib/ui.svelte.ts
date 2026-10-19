/** UI state shared by components that aren't parent and child. */
class Ui {
	/** Modal dialogs open right now; hints wait until there are none */
	modals = $state(0);
	/** The Publish dialog (opened from the header button or the "ready" hint) */
	publishOpen = $state(false);
	/** When the dock of Pieces to place was last asked to draw attention (ms timestamp) */
	dockPulse = $state(0);

	/** Pulses the dock, also when it only appears after navigating to Furnish */
	pulseDock() {
		this.dockPulse = Date.now();
	}
}

export const ui = new Ui();
