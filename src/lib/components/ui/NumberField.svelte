<script lang="ts">
	interface Props {
		label: string;
		value: number;
		unit?: string;
		onchange: (value: number) => void;
	}
	let { label, value, unit = 'cm', onchange }: Props = $props();

	let input: HTMLInputElement;
	let focused = $state(false);

	// Show the rounded value, but never overwrite what the user is typing
	$effect(() => {
		const shown = String(Math.round(value));
		if (!focused) input.value = shown;
	});
</script>

<label class="grid min-w-0 gap-[3px]">
	<span class="text-xs text-muted">{label}</span>
	<span
		class="num flex items-center rounded-[5px] border border-line-strong bg-paper pr-2 focus-within:border-accent"
	>
		<input
			bind:this={input}
			type="number"
			inputmode="numeric"
			step="1"
			class="w-full min-w-0 border-0 bg-transparent px-2 py-1.5 font-mono text-[13.5px] tabular-nums outline-none"
			onfocus={() => (focused = true)}
			onblur={() => (focused = false)}
			oninput={(e) => {
				const v = parseFloat(e.currentTarget.value);
				if (Number.isFinite(v)) onchange(v);
			}}
		/>
		<i class="font-mono text-[11.5px] text-muted not-italic">{unit}</i>
	</span>
</label>
