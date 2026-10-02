<script lang="ts">
	import { page } from '$app/state';
	import { cm } from '#lib/planner/format.ts';
	import { planner } from '#lib/planner/planner.svelte.ts';
	import type { Hinge, Swing } from '#lib/planner/types.ts';
	import { setParams } from '#lib/url.ts';
	import ConfirmButton from './ui/ConfirmButton.svelte';
	import ScrubValue from './ui/ScrubValue.svelte';
	import Segmented from './ui/Segmented.svelte';
	import Switch from './ui/Switch.svelte';

	const cfg = $derived(planner.cfg);
	const g = $derived(planner.geo);

	/** The visible part follows `?focus=` (default: walls) */
	const PARTS = [
		{ value: 'walls', label: 'Walls' },
		{ value: 'door', label: 'Door' },
		{ value: 'front', label: 'Glass' },
		{ value: 'loggia', label: 'Loggia' },
		{ value: 'more', label: 'More' }
	] as const;
	type Part = (typeof PARTS)[number]['value'];
	const focus = $derived.by<Part>(() => {
		const f = page.url.searchParams.get('focus');
		return PARTS.find((p) => p.value === f)?.value ?? 'walls';
	});

	const hinges = [
		{ value: 'left', label: 'Hinge left' },
		{ value: 'right', label: 'Hinge right' }
	] as const satisfies readonly { value: Hinge; label: string }[];
	const swing = (outLabel: string) =>
		[
			{ value: 'in', label: 'Opens inwards' },
			{ value: 'out', label: outLabel }
		] as const satisfies readonly { value: Swing; label: string }[];
</script>

<div class="grid gap-5">
	<Segmented
		label="Part of the room"
		full
		value={focus}
		options={PARTS}
		onchange={(part) => setParams({ focus: part === 'walls' ? null : part }, { replace: true })}
	/>

	{#if g.issues.length}
		<ul class="grid gap-1 rounded-2xl bg-warn-soft px-4 py-3 text-[13px] text-warn">
			{#each g.issues as issue (issue)}
				<li>{issue}</li>
			{/each}
		</ul>
	{/if}

	{#if focus === 'walls'}
		<div class="grid grid-cols-2 gap-3">
			<ScrubValue label="Width" value={cfg.W} min={100} max={2000} onchange={(v) => (cfg.W = v)} />
			<ScrubValue label="Length" value={cfg.L} min={100} max={2000} onchange={(v) => (cfg.L = v)} />
			<ScrubValue label="Corner width" value={cfg.NW} min={0} onchange={(v) => (cfg.NW = v)} />
			<ScrubValue label="Corner depth" value={cfg.N} min={0} onchange={(v) => (cfg.N = v)} />
			<ScrubValue
				label="Ceiling height"
				value={cfg.H}
				min={150}
				max={500}
				onchange={(v) => (cfg.H = v)}
			/>
		</div>
		<p class="text-[13px] text-muted">
			{g.hasNotch
				? `The hallway corner cuts ${cm(g.NW)} × ${cm(g.N)} cm out of the top left. Set its width to 0 for a rectangular room.`
				: 'Rectangular room. Give the corner a width and depth to cut out the hallway corner.'}
		</p>
	{:else if focus === 'door'}
		<div class="grid grid-cols-2 gap-3">
			<ScrubValue
				label="From left wall"
				value={cfg.door.off}
				min={0}
				onchange={(v) => (cfg.door.off = v)}
			/>
			<ScrubValue label="Width" value={cfg.door.w} min={40} onchange={(v) => (cfg.door.w = v)} />
			<ScrubValue label="Height" value={cfg.door.h} min={150} onchange={(v) => (cfg.door.h = v)} />
		</div>
		<Segmented
			label="Hinge"
			full
			value={cfg.door.hinge}
			options={hinges}
			onchange={(v) => (cfg.door.hinge = v)}
		/>
		<Segmented
			label="Opens"
			full
			value={cfg.door.swing}
			options={swing('Into hallway')}
			onchange={(v) => (cfg.door.swing = v)}
		/>
	{:else if focus === 'front'}
		<div class="grid grid-cols-2 gap-3">
			<ScrubValue
				label="Wall left"
				value={cfg.front.wl}
				min={0}
				onchange={(v) => (cfg.front.wl = v)}
			/>
			<ScrubValue
				label="Wall right"
				value={cfg.front.wr}
				min={0}
				onchange={(v) => (cfg.front.wr = v)}
			/>
			<ScrubValue
				label="Glass height"
				value={cfg.front.glassH}
				min={100}
				onchange={(v) => (cfg.front.glassH = v)}
			/>
		</div>
		<h3 class="-mb-2 text-[13px] font-semibold">Balcony door</h3>
		<div class="grid grid-cols-2 gap-3">
			<ScrubValue
				label="From left wall"
				value={cfg.front.door.off}
				min={0}
				onchange={(v) => (cfg.front.door.off = v)}
			/>
			<ScrubValue
				label="Width"
				value={cfg.front.door.w}
				min={40}
				onchange={(v) => (cfg.front.door.w = v)}
			/>
		</div>
		<Segmented
			label="Balcony door hinge"
			full
			value={cfg.front.door.hinge}
			options={hinges}
			onchange={(v) => (cfg.front.door.hinge = v)}
		/>
		<Segmented
			label="Balcony door opens"
			full
			value={cfg.front.door.swing}
			options={swing('Onto loggia')}
			onchange={(v) => (cfg.front.door.swing = v)}
		/>
	{:else if focus === 'loggia'}
		<div class="grid grid-cols-2 gap-3">
			<ScrubValue
				label="Depth"
				value={cfg.loggia.D}
				min={0}
				max={1000}
				onchange={(v) => (cfg.loggia.D = v)}
			/>
			<ScrubValue
				label="Parapet height"
				value={cfg.loggia.parapetH}
				min={0}
				max={200}
				onchange={(v) => (cfg.loggia.parapetH = v)}
			/>
		</div>
		<p class="text-[13px] text-muted">Set the depth to 0 if there is no loggia.</p>
	{:else}
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
