<script lang="ts">
	import { duration } from '#lib/motion.ts';
	import { planner } from '#lib/planner/planner.svelte.ts';
	import { INVENTORY, type Piece } from '#lib/planner/room.ts';
	import type { Point } from '#lib/planner/types.ts';
	import { ui } from '#lib/ui.svelte.ts';
	import { selectItem } from '#lib/url.ts';
	import { dragAxis } from './dragAxis.ts';
	import FurnitureIcon from './FurnitureIcon.svelte';

	/**
	 * The Pieces not placed yet, along the bottom. Click a tile to place the Piece in the middle of
	 * the room, or drag it into the room: the Piece appears under the pointer and follows it.
	 * A sideways swipe scrolls the dock instead.
	 */
	interface Props {
		planPoint: (clientX: number, clientY: number) => Point | null;
		/** True while a Piece is being dragged out of the dock */
		dragging?: boolean;
	}
	let { planPoint, dragging = $bindable(false) }: Props = $props();

	let dock = $state<HTMLElement>();
	/** The gesture on a tile, from pointerdown until it ends */
	let drag: {
		piece: Piece;
		x: number;
		y: number;
		scrollLeft: number;
		axis: ReturnType<typeof dragAxis>;
		placed: boolean;
	} | null = null;
	/**
	 * The Piece being dragged out. Its tile stays mounted, dimmed, until the drag ends, even once
	 * the Piece is placed: the tile holds the pointer capture.
	 */
	let held = $state<string | null>(null);
	/** The Pieces not placed yet, plus the one being dragged out */
	let tiles = $derived(INVENTORY.filter((p) => p.id === held || planner.unplaced.includes(p)));
	/** Icon following the pointer until the Piece enters the room */
	let ghost = $state<{ piece: Piece; x: number; y: number } | null>(null);

	// A soft ring draws attention to the dock when asked (Publish with Pieces left)
	$effect(() => {
		const ms = duration(600);
		if (!dock || !ms || Date.now() - ui.dockPulse > 1500) return;
		dock.animate(
			[
				{ boxShadow: '0 0 0 0 color-mix(in srgb, var(--accent) 60%, transparent)' },
				{ boxShadow: '0 0 0 14px color-mix(in srgb, var(--accent) 0%, transparent)' }
			],
			{ duration: ms, easing: 'ease-out' }
		);
	});

	/** Room point under the pointer, ignoring the dock itself */
	function roomPoint(e: PointerEvent) {
		const r = dock?.getBoundingClientRect();
		if (r && e.clientY > r.top - 4) return null;
		return planPoint(e.clientX, e.clientY);
	}

	function onpointerdown(e: PointerEvent, piece: Piece) {
		if (e.button !== 0) return;
		const scrollLeft = dock?.scrollLeft ?? 0;
		drag = { piece, x: e.clientX, y: e.clientY, scrollLeft, axis: 'pending', placed: false };
		(e.currentTarget as Element).setPointerCapture(e.pointerId);
	}

	function onpointermove(e: PointerEvent) {
		if (!drag) return;
		const dx = e.clientX - drag.x;
		if (drag.axis === 'pending') {
			drag.axis = dragAxis(dx, e.clientY - drag.y);
			if (drag.axis === 'drag') {
				held = drag.piece.id;
				dragging = true;
			}
		}
		if (drag.axis === 'pending') return;
		if (drag.axis === 'scroll') {
			// Touch scrolls the dock itself (touch-pan-x), a mouse or pen scrolls it here
			if (e.pointerType !== 'touch' && dock) dock.scrollLeft = drag.scrollLeft - dx;
			return;
		}
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

	/** A click drops the Piece in the middle; a release over the dock or outside the room puts it back */
	function onpointerup(e: PointerEvent) {
		if (drag?.axis === 'pending') selectItem(planner.place(drag.piece).id);
		else if (drag?.placed && !roomPoint(e)) {
			planner.unplace(drag.piece.id);
			selectItem(null);
		}
		end();
	}

	/** The system took the gesture: the Piece stays where it last was */
	function end() {
		drag = null;
		held = null;
		dragging = false;
		ghost = null;
	}
</script>

{#if tiles.length}
	<div
		bind:this={dock}
		class="pointer-events-auto flex max-w-full gap-1 overflow-x-auto rounded-3xl bg-sheet/90 p-1.5 shadow-float ring-1 ring-line/70 backdrop-blur-md"
		role="toolbar"
		aria-label="Pieces to place"
	>
		{#each tiles as piece, i (piece.id)}
			<button
				data-hint={i === 0 ? 'dock' : undefined}
				class={[
					'flex w-[76px] flex-none cursor-grab flex-col items-center gap-1 rounded-2xl px-1 pt-2 pb-1.5 text-ink transition-[background-color,opacity] select-none hover:bg-paper active:cursor-grabbing',
					held === piece.id ? 'touch-none opacity-40' : 'touch-pan-x'
				]}
				title="Drag into the room or click to place · {piece.w} × {piece.d} cm"
				onpointerdown={(e) => onpointerdown(e, piece)}
				{onpointermove}
				{onpointerup}
				onpointercancel={end}
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
