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
		/** `pill`: compact, label inline, for chips floating on the drawing */
		variant?: 'field' | 'pill';
		onchange: (value: number) => void;
	}
	let {
		label,
		value,
		unit = 'cm',
		min,
		max,
		step = 1,
		variant = 'field',
		onchange
	}: Props = $props();
	const pill = $derived(variant === 'pill');

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

<div class={pill ? 'flex' : 'grid min-w-0 gap-1'}>
	{#if !pill}<span class="truncate text-xs text-muted">{label}</span>{/if}
	{#if editing}
		<span
			class={[
				'flex items-baseline rounded-xl bg-sheet ring-2 ring-accent ring-inset',
				pill ? 'gap-1.5 px-2.5 py-1.5' : 'px-3 py-2'
			]}
		>
			{#if pill}<span class="text-xs whitespace-nowrap text-muted">{label}</span>{/if}
			<input
				bind:this={input}
				class={[
					'min-w-0 bg-transparent font-semibold outline-none',
					pill ? 'w-12 text-[14px]' : 'w-full text-[15px]'
				]}
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
				'flex cursor-ew-resize touch-pan-y items-baseline rounded-xl transition-colors select-none',
				pill ? 'gap-1.5 px-2.5 py-1.5' : 'justify-between px-3 py-2',
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
			{#if pill}<span class="text-xs whitespace-nowrap text-muted">{label}</span>{/if}
			<span class={['font-semibold', pill ? 'text-[14px]' : 'text-[15px]']}>{shown}</span>
			<span class="text-xs text-muted">{unit}</span>
		</div>
	{/if}
</div>
