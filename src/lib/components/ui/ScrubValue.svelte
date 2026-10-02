<script lang="ts">
	import { tick } from 'svelte';

	/**
	 * A number you adjust by dragging sideways (Shift: slower), with the arrow keys
	 * (Shift: ×10), or by clicking it and typing.
	 */
	interface Props {
		label: string;
		value: number;
		unit?: string;
		min?: number;
		max?: number;
		step?: number;
		onchange: (value: number) => void;
	}
	let { label, value, unit = 'cm', min, max, step = 1, onchange }: Props = $props();

	let editing = $state(false);
	let dragging = $state(false);
	let chip = $state<HTMLElement>();
	let input = $state<HTMLInputElement>();
	let drag: { lastX: number; acc: number; moved: boolean } | null = null;

	const shown = $derived(String(Math.round(value / step) * step));

	function set(v: number) {
		const r = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, Math.round(v / step) * step));
		if (r !== value) onchange(r);
	}

	function onpointerdown(e: PointerEvent) {
		if (e.button !== 0) return;
		drag = { lastX: e.clientX, acc: value, moved: false };
		(e.currentTarget as Element).setPointerCapture(e.pointerId);
	}

	function onpointermove(e: PointerEvent) {
		if (!drag) return;
		const dx = e.clientX - drag.lastX;
		if (!drag.moved && Math.abs(dx) < 4) return;
		drag.moved = dragging = true;
		drag.lastX = e.clientX;
		// One step per pixel, a fifth of that with Shift for fine-tuning
		drag.acc += dx * step * (e.shiftKey ? 0.2 : 1);
		set(drag.acc);
	}

	function onpointerup() {
		if (drag && !drag.moved) startEdit();
		drag = null;
		dragging = false;
	}

	function onkeydown(e: KeyboardEvent) {
		const k = e.shiftKey ? 10 : 1;
		if (e.key === 'ArrowUp' || e.key === 'ArrowRight') set(value + step * k);
		else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') set(value - step * k);
		else if (e.key === 'Enter' || e.key === ' ') startEdit();
		else return;
		e.preventDefault();
	}

	async function startEdit() {
		editing = true;
		await tick();
		input?.select();
	}

	async function finishEdit(commit: boolean) {
		if (!editing) return;
		const v = parseFloat(input?.value.replace(',', '.') ?? '');
		editing = false;
		if (commit && Number.isFinite(v)) set(v);
		await tick();
		chip?.focus();
	}
</script>

<div class="grid min-w-0 gap-1">
	<span class="truncate text-xs text-muted">{label}</span>
	{#if editing}
		<span class="flex items-baseline rounded-xl bg-sheet px-3 py-2 ring-2 ring-accent ring-inset">
			<input
				bind:this={input}
				class="w-full min-w-0 bg-transparent text-[15px] font-semibold outline-none"
				inputmode="decimal"
				aria-label={label}
				value={shown}
				onkeydown={(e) => {
					if (e.key === 'Enter') finishEdit(true);
					else if (e.key === 'Escape') finishEdit(false);
					else return;
					e.preventDefault();
					e.stopPropagation();
				}}
				onblur={() => finishEdit(true)}
			/>
			<span class="text-xs text-muted">{unit}</span>
		</span>
	{:else}
		<div
			bind:this={chip}
			class={[
				'flex cursor-ew-resize touch-pan-y items-baseline justify-between rounded-xl px-3 py-2 transition-colors select-none',
				dragging ? 'bg-accent-soft text-accent' : 'bg-paper hover:bg-line'
			]}
			role="spinbutton"
			tabindex="0"
			aria-label={label}
			aria-valuenow={value}
			aria-valuemin={min}
			aria-valuemax={max}
			aria-valuetext="{shown} {unit}"
			title="Drag sideways or click to type"
			{onpointerdown}
			{onpointermove}
			{onpointerup}
			onpointercancel={onpointerup}
			{onkeydown}
		>
			<span class="text-[15px] font-semibold">{shown}</span>
			<span class="text-xs text-muted">{unit}</span>
		</div>
	{/if}
</div>
