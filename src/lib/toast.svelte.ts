/** Short messages at the bottom of the screen ("Link copied"), shown one at a time. */
class Toast {
	message = $state('');
	private timer: ReturnType<typeof setTimeout> | undefined;

	show(message: string) {
		clearTimeout(this.timer);
		this.message = message;
		this.timer = setTimeout(() => (this.message = ''), 3200);
	}
}

export const toast = new Toast();
