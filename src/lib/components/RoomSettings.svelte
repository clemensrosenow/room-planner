<script lang="ts">
	import { planner } from '#lib/planner/planner.svelte.ts';
	import type { RoomPart } from './RoomHandles.svelte';
	import ConfirmButton from './ui/ConfirmButton.svelte';
	import ScrubValue from './ui/ScrubValue.svelte';
	import Segmented from './ui/Segmented.svelte';
	import Switch from './ui/Switch.svelte';

	/**
	 * Side panel of the shape step. Sizes are edited on the plan; this holds the part tabs
	 * and what the plan can't show (heights, wall thickness, status).
	 */
	let { focus, onfocus }: { focus: RoomPart; onfocus: (part: RoomPart) => void } = $props();

	const cfg = $derived(planner.cfg);
	const g = $derived(planner.geo);

	const PARTS = [
		{ value: 'walls', label: 'Walls' },
		{ value: 'door', label: 'Door' },
		{ value: 'front', label: 'Glass' },
		{ value: 'loggia', label: 'Loggia' },
		{ value: 'more', label: 'More' }
	] as const;

	const HINTS: Record<RoomPart, string> = {
		walls: 'Drag the right wall, the front wall or the hallway corner on the plan.',
		door: 'Drag the door along its wall, or its ends to change the width.',
		front: 'Drag where the glass starts and ends, and move or resize the balcony door.',
		loggia: 'Drag the parapet to change the depth. Set it to 0 if there is no loggia.',
		more: ''
	};
</script>

<div class="grid gap-5">
	<Segmented label="Part of the room" full value={focus} options={PARTS} onchange={onfocus} />

	{#if g.issues.length}
		<ul class="grid gap-1 rounded-2xl bg-warn-soft px-4 py-3 text-[13px] text-warn">
			{#each g.issues as issue (issue)}
				<li>{issue}</li>
			{/each}
		</ul>
	{/if}

	{#if HINTS[focus]}
		<p class="text-[13px] text-muted">
			{HINTS[focus]} Tap a value on the plan to type it.
		</p>
	{/if}

	{#if focus === 'walls'}
		<div class="grid grid-cols-2 gap-3">
			<ScrubValue
				label="Ceiling height"
				value={cfg.H}
				min={150}
				max={500}
				onchange={(v) => (cfg.H = v)}
			/>
		</div>
	{:else if focus === 'door'}
		<div class="grid grid-cols-2 gap-3">
			<ScrubValue
				label="Door height"
				value={cfg.door.h}
				min={150}
				onchange={(v) => (cfg.door.h = v)}
			/>
		</div>
	{:else if focus === 'front'}
		<div class="grid grid-cols-2 gap-3">
			<ScrubValue
				label="Glass height"
				value={cfg.front.glassH}
				min={100}
				onchange={(v) => (cfg.front.glassH = v)}
			/>
		</div>
	{:else if focus === 'more'}
		<div class="grid grid-cols-2 gap-3">
			<ScrubValue
				label="Inner walls"
				value={cfg.tI}
				min={4}
				max={60}
				onchange={(v) => (cfg.tI = v)}
			/>
			<ScrubValue
				label="Outer wall"
				value={cfg.tE}
				min={4}
				max={80}
				onchange={(v) => (cfg.tE = v)}
			/>
		</div>
		<Switch label="Dimensions have been measured" bind:checked={planner.measured} />
		<div>
			<ConfirmButton
				label="Reset to plan estimate"
				confirmLabel="Really reset? Furniture stays"
				onconfirm={() => planner.resetRoom()}
			/>
		</div>
	{/if}
</div>
