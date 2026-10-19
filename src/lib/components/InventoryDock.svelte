<script lang="ts">
	import { planner } from '#lib/planner/planner.svelte.ts';
	import type { Piece } from '#lib/planner/room.ts';
	import type { Point } from '#lib/planner/types.ts';
	import { selectItem } from '#lib/url.ts';
	import FurnitureIcon from './FurnitureIcon.svelte';

	/**
	 * The Pieces not placed yet, along the bottom. Click a tile to place the Piece in the middle of
	 * the room, or drag it into the room: the Piece appears under the pointer and follows it.
	 */
	interface Props {
		planPoint: (clientX: number, clientY: number) => Point | null;
		/** True while a Piece is being dragged out of the dock */
		dragging?: boolean;
	}
	let { planPoint, dragging = $bindable(false) }: Props = $props();

	let dock = $state<HTMLElement>();
	let drag: { piece: Piece; x: number; y: number; moved: boolean; placed: boolean } | null = null;
	/** Icon following the pointer until the Piece enters the room */
	let ghost = $state<{ piece: Piece; x: number; y: number } | null>(null);

	/** Room point under the pointer, ignoring the dock itself */
	function roomPoint(e: PointerEvent) {
		const r = dock?.getBoundingClientRect();
		if (r && e.clientY > r.top - 4) return null;
		return planPoint(e.clientX, e.clientY);
	}

	function onpointerdown(e: PointerEvent, piece: Piece) {
		if (e.button !== 0) return;
		drag = { piece, x: e.clientX, y: e.clientY, moved: false, placed: false };
		dragging = true;
		(e.currentTarget as Element).setPointerCapture(e.pointerId);
	}

	function onpointermove(e: PointerEvent) {
		if (!drag) return;
		if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 6) return;
		drag.moved = true;
		const p = roomPoint(e);
		if (p && !drag.placed) {
			planner.place(drag.piece, p);
			drag.placed = true;
			selectItem(drag.piece.id);
		} else if (p && drag.placed) {
			planner.move(drag.piece.id, p[0], p[1], !e.altKey);
		}
		ghost = drag.placed ? null : { piece: drag.piece, x: e.clientX, y: e.clientY };
	}

	function onpointerup() {
		if (drag && !drag.moved) selectItem(planner.place(drag.piece).id);
		drag = null;
		dragging = false;
		ghost = null;
	}
</script>

{#if planner.unplaced.length}
	<div
		bind:this={dock}
		class="pointer-events-auto flex max-w-full gap-1 overflow-x-auto rounded-3xl bg-sheet/90 p-1.5 shadow-float ring-1 ring-line/70 backdrop-blur-md"
		role="toolbar"
		aria-label="Pieces to place"
	>
		{#each planner.unplaced as piece (piece.id)}
			<button
				class="flex w-[76px] flex-none cursor-grab touch-pan-x flex-col items-center gap-1 rounded-2xl px-1 pt-2 pb-1.5 text-ink transition-colors select-none hover:bg-paper active:cursor-grabbing"
				title="Drag into the room or click to place · {piece.w} × {piece.d} cm"
				onpointerdown={(e) => onpointerdown(e, piece)}
				{onpointermove}
				{onpointerup}
				onpointercancel={onpointerup}
			>
				<FurnitureIcon kind={piece.kind} color={piece.color} size={34} />
				<span class="text-[11.5px] leading-tight font-semibold">{piece.name}</span>
			</button>
		{/each}
	</div>
{/if}

{#if ghost}
	<div
		class="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-sheet/90 p-2 text-ink shadow-float"
		style:left="{ghost.x}px"
		style:top="{ghost.y}px"
	>
		<FurnitureIcon kind={ghost.piece.kind} color={ghost.piece.color} size={40} />
	</div>
{/if}
