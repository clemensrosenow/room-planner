<script lang="ts">
	/** Button that needs a second click within a few seconds to run its action. */
	interface Props {
		label: string;
		confirmLabel: string;
		onconfirm: () => void;
	}
	let { label, confirmLabel, onconfirm }: Props = $props();

	let armed = $state(false);
	let timer: ReturnType<typeof setTimeout>;

	function click() {
		clearTimeout(timer);
		if (armed) {
			armed = false;
			onconfirm();
			return;
		}
		armed = true;
		timer = setTimeout(() => (armed = false), 3500);
	}

	$effect(() => () => clearTimeout(timer));
</script>

<button class={['btn btn-danger', armed && 'btn-confirm']} onclick={click}>
	{armed ? confirmLabel : label}
</button>
