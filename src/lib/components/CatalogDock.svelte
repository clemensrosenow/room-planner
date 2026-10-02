<script lang="ts">
	import { CATALOG, type Preset } from '#lib/planner/catalog.ts';
	import { planner } from '#lib/planner/planner.svelte.ts';
	import type { Point } from '#lib/planner/types.ts';
	import { selectItem } from '#lib/url.ts';
	import FurnitureIcon from './FurnitureIcon.svelte';

	/**
	 * Furniture catalog along the bottom. Click a tile to place the piece in the middle of the
	 * room, or drag it into the room: the piece appears under the pointer and follows it.
	 */
	let { planPoint }: { planPoint: (clientX: number, clientY: number) => Point | null } = $props();

	let dock = $state<HTMLElement>();
	let drag: { preset: Preset; x: number; y: number; moved: boolean; id: string | null } | null =
		null;
	/** Icon following the pointer until the piece enters the room */
	let ghost = $state<{ preset: Preset; x: number; y: number } | null>(null);

	/** Room point under the pointer, ignoring the dock itself */
	function roomPoint(e: PointerEvent) {
		const r = dock?.getBoundingClientRect();
		if (r && e.clientY > r.top - 4) return null;
		return planPoint(e.clientX, e.clientY);
	}

	function onpointerdown(e: PointerEvent, preset: Preset) {
		if (e.button !== 0) return;
		drag = { preset, x: e.clientX, y: e.clientY, moved: false, id: null };
		(e.currentTarget as Element).setPointerCapture(e.pointerId);
	}

	function onpointermove(e: PointerEvent) {
		if (!drag) return;
		if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 6) return;
		drag.moved = true;
		const p = roomPoint(e);
		if (p && !drag.id) {
			const f = planner.add(drag.preset, p);
			drag.id = f.id;
			selectItem(f.id);
		} else if (p && drag.id) {
			planner.move(drag.id, p[0], p[1], !e.altKey);
		}
		ghost = drag.id ? null : { preset: drag.preset, x: e.clientX, y: e.clientY };
	}

	function onpointerup() {
		if (drag && !drag.moved) selectItem(planner.add(drag.preset).id);
		drag = null;
		ghost = null;
	}
</script>

<div
	bind:this={dock}
	class="pointer-events-auto flex max-w-full gap-1 overflow-x-auto rounded-3xl bg-sheet/90 p-1.5 shadow-float ring-1 ring-line/70 backdrop-blur-md"
	role="toolbar"
	aria-label="Add furniture"
>
	{#each CATALOG as preset (preset.name)}
		<button
			class="flex w-[72px] flex-none cursor-grab touch-pan-x flex-col items-center gap-1 rounded-2xl px-1 pt-2 pb-1.5 text-ink transition-colors select-none hover:bg-paper active:cursor-grabbing"
			title="Drag into the room or click to add · {preset.w} × {preset.d} cm"
			onpointerdown={(e) => onpointerdown(e, preset)}
			{onpointermove}
			{onpointerup}
			onpointercancel={onpointerup}
		>
			<FurnitureIcon kind={preset.kind} color={preset.color} size={34} />
			<span class="text-[11.5px] leading-tight font-semibold">{preset.name}</span>
		</button>
	{/each}
</div>

{#if ghost}
	<div
		class="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-sheet/90 p-2 text-ink shadow-float"
		style:left="{ghost.x}px"
		style:top="{ghost.y}px"
	>
		<FurnitureIcon kind={ghost.preset.kind} color={ghost.preset.color} size={40} />
	</div>
{/if}
