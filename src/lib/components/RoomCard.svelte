<script lang="ts">
	import { planner } from '#lib/planner/planner.svelte.ts';
	import type { Hinge, Swing } from '#lib/planner/types.ts';
	import type { PlanApi } from './PlanView.svelte';
	import type { RoomPart } from './RoomHandles.svelte';
	import ScrubValue from './ui/ScrubValue.svelte';

	/**
	 * The measurements of the focused part, floating right next to it on the plan.
	 * Drag a value sideways, use the arrow keys or click it to type.
	 */
	let { api, focus }: { api: PlanApi; focus: RoomPart } = $props();

	const g = $derived(planner.geo);
	const cfg = $derived(planner.cfg);
	const door = $derived(g.doors[0]);

	/**
	 * Card position (px): beside the room at the height of the part, so it never covers
	 * the drawing or its grips. The door's card sits left, everything else right.
	 */
	let cardW = $state(300);
	const place = $derived.by(() => {
		const right = (y: number) => {
			const p = api.toScreen([g.W + g.tI, y]);
			return { x: Math.min(p.x + 28, api.width - cardW - 16), y: p.y };
		};
		if (focus === 'walls') return right(g.L / 2);
		if (focus === 'front') return right(g.L + g.tE / 2);
		if (focus === 'loggia') return right(g.L + g.tE + g.D / 2);
		if (focus === 'door') {
			// Left of the room if there is space, otherwise right
			const p = api.toScreen([-g.tI, door.y - g.tI / 2]);
			const x = p.x - 28 - cardW;
			return x >= 16 ? { x, y: p.y } : right(door.y);
		}
		return null;
	});

	const flip = (v: Hinge): Hinge => (v === 'left' ? 'right' : 'left');
	const turn = (v: Swing): Swing => (v === 'in' ? 'out' : 'in');
	const toggle =
		'cursor-pointer rounded-xl bg-paper px-2.5 py-1.5 text-[13px] font-semibold whitespace-nowrap transition-colors hover:bg-line';
</script>

{#if place}
	<div
		bind:clientWidth={cardW}
		class="absolute z-10 flex max-w-[min(250px,calc(100%-2rem))] -translate-y-1/2 flex-wrap gap-1.5 rounded-2xl bg-sheet/95 p-2 shadow-float ring-1 ring-line/70 backdrop-blur-md"
		style:left="{Math.max(16, place.x)}px"
		style:top="{Math.min(Math.max(place.y, 110), api.height - 70)}px"
		role="group"
		aria-label="Measurements"
	>
		{#if focus === 'walls'}
			<ScrubValue
				variant="pill"
				label="Width"
				value={cfg.W}
				min={100}
				max={2000}
				onchange={(v) => (cfg.W = v)}
			/>
			<ScrubValue
				variant="pill"
				label="Length"
				value={cfg.L}
				min={100}
				max={2000}
				onchange={(v) => (cfg.L = v)}
			/>
			<ScrubValue
				variant="pill"
				label="Corner width"
				value={cfg.NW}
				min={0}
				onchange={(v) => (cfg.NW = v)}
			/>
			<ScrubValue
				variant="pill"
				label="Corner depth"
				value={cfg.N}
				min={0}
				onchange={(v) => (cfg.N = v)}
			/>
		{:else if focus === 'door'}
			<ScrubValue
				variant="pill"
				label="From left"
				value={cfg.door.off}
				min={0}
				onchange={(v) => (cfg.door.off = v)}
			/>
			<ScrubValue
				variant="pill"
				label="Width"
				value={cfg.door.w}
				min={40}
				onchange={(v) => (cfg.door.w = v)}
			/>
			<button class={toggle} onclick={() => (cfg.door.hinge = flip(cfg.door.hinge))}>
				Hinge {cfg.door.hinge}
			</button>
			<button class={toggle} onclick={() => (cfg.door.swing = turn(cfg.door.swing))}>
				Opens {cfg.door.swing === 'in' ? 'inwards' : 'outwards'}
			</button>
		{:else if focus === 'front'}
			<ScrubValue
				variant="pill"
				label="Wall left"
				value={cfg.front.wl}
				min={0}
				onchange={(v) => (cfg.front.wl = v)}
			/>
			<ScrubValue
				variant="pill"
				label="Wall right"
				value={cfg.front.wr}
				min={0}
				onchange={(v) => (cfg.front.wr = v)}
			/>
			<ScrubValue
				variant="pill"
				label="Door from left"
				value={cfg.front.door.off}
				min={0}
				onchange={(v) => (cfg.front.door.off = v)}
			/>
			<ScrubValue
				variant="pill"
				label="Door width"
				value={cfg.front.door.w}
				min={40}
				onchange={(v) => (cfg.front.door.w = v)}
			/>
			<button class={toggle} onclick={() => (cfg.front.door.hinge = flip(cfg.front.door.hinge))}>
				Hinge {cfg.front.door.hinge}
			</button>
			<button class={toggle} onclick={() => (cfg.front.door.swing = turn(cfg.front.door.swing))}>
				Opens {cfg.front.door.swing === 'in' ? 'inwards' : 'outwards'}
			</button>
		{:else if focus === 'loggia'}
			<ScrubValue
				variant="pill"
				label="Depth"
				value={cfg.loggia.D}
				min={0}
				max={1000}
				onchange={(v) => (cfg.loggia.D = v)}
			/>
			<ScrubValue
				variant="pill"
				label="Parapet"
				value={cfg.loggia.parapetH}
				min={0}
				max={200}
				onchange={(v) => (cfg.loggia.parapetH = v)}
			/>
		{/if}
	</div>
{/if}
