<script lang="ts">
	import { cm, m2 } from '#lib/planner/format.ts';
	import { planner } from '#lib/planner/planner.svelte.ts';
	import type { Hinge, Swing } from '#lib/planner/types.ts';
	import ConfirmButton from './ui/ConfirmButton.svelte';
	import NumberField from './ui/NumberField.svelte';
	import Section from './ui/Section.svelte';
	import SelectField from './ui/SelectField.svelte';

	const cfg = $derived(planner.cfg);
	const g = $derived(planner.geo);

	const hinges: { value: Hinge; label: string }[] = [
		{ value: 'left', label: 'left' },
		{ value: 'right', label: 'right' }
	];
	const swing = (outLabel: string): { value: Swing; label: string }[] => [
		{ value: 'in', label: 'into the room' },
		{ value: 'out', label: outLabel }
	];
</script>

<Section title="Room" sub={m2(g.area)} open>
	<div class="grid grid-cols-2 gap-x-2.5 gap-y-2">
		<NumberField label="Total width" value={cfg.W} onchange={(v) => (cfg.W = v)} />
		<NumberField label="Right wall length" value={cfg.L} onchange={(v) => (cfg.L = v)} />
		<NumberField label="Hallway corner width" value={cfg.NW} onchange={(v) => (cfg.NW = v)} />
		<NumberField label="Hallway corner depth" value={cfg.N} onchange={(v) => (cfg.N = v)} />
		<NumberField label="Ceiling height" value={cfg.H} onchange={(v) => (cfg.H = v)} />
	</div>
	<p class="font-mono text-xs text-muted">
		{g.hasNotch
			? `Left wall: ${cm(g.L - g.N)} cm · Wall beside the door to hallway corner: ${cm(g.N)} cm deep`
			: 'Rectangular room without hallway corner'}
	</p>
</Section>

<Section title="Room door" sub="in the hallway wall" open>
	<div class="grid grid-cols-2 gap-x-2.5 gap-y-2">
		<NumberField
			label="Offset from left wall"
			value={cfg.door.off}
			onchange={(v) => (cfg.door.off = v)}
		/>
		<NumberField
			label="Width (clear opening)"
			value={cfg.door.w}
			onchange={(v) => (cfg.door.w = v)}
		/>
		<NumberField label="Height" value={cfg.door.h} onchange={(v) => (cfg.door.h = v)} />
		<SelectField
			label="Hinge"
			value={cfg.door.hinge}
			options={hinges}
			onchange={(v) => (cfg.door.hinge = v)}
		/>
		<SelectField
			label="Opens"
			value={cfg.door.swing}
			options={swing('into the hallway')}
			onchange={(v) => (cfg.door.swing = v)}
		/>
	</div>
</Section>

<Section title="Glass front to loggia" open>
	<div class="grid grid-cols-2 gap-x-2.5 gap-y-2">
		<NumberField
			label="Wall section left"
			value={cfg.front.wl}
			onchange={(v) => (cfg.front.wl = v)}
		/>
		<NumberField
			label="Wall section right"
			value={cfg.front.wr}
			onchange={(v) => (cfg.front.wr = v)}
		/>
		<NumberField
			label="Glass front height"
			value={cfg.front.glassH}
			onchange={(v) => (cfg.front.glassH = v)}
		/>
		<NumberField
			label="Balcony door from left wall"
			value={cfg.front.door.off}
			onchange={(v) => (cfg.front.door.off = v)}
		/>
		<NumberField
			label="Balcony door width"
			value={cfg.front.door.w}
			onchange={(v) => (cfg.front.door.w = v)}
		/>
		<SelectField
			label="Hinge"
			value={cfg.front.door.hinge}
			options={hinges}
			onchange={(v) => (cfg.front.door.hinge = v)}
		/>
		<SelectField
			label="Opens"
			value={cfg.front.door.swing}
			options={swing('onto the loggia')}
			onchange={(v) => (cfg.front.door.swing = v)}
		/>
	</div>
	<p class="font-mono text-xs text-muted">
		Glass front: {cm(g.front.gx1 - g.front.gx0)} cm wide · fixed glass left {cm(
			g.front.bOff - g.front.gx0
		)} cm, right {cm(g.front.gx1 - g.front.bOff - g.front.bW)} cm
	</p>
</Section>

<Section title="Loggia" sub={g.D > 0 ? m2(g.loggiaArea) : ''}>
	<div class="grid grid-cols-2 gap-x-2.5 gap-y-2">
		<NumberField label="Depth" value={cfg.loggia.D} onchange={(v) => (cfg.loggia.D = v)} />
		<NumberField
			label="Parapet height"
			value={cfg.loggia.parapetH}
			onchange={(v) => (cfg.loggia.parapetH = v)}
		/>
	</div>
</Section>

<Section title="Walls & status">
	<div class="grid grid-cols-2 gap-x-2.5 gap-y-2">
		<NumberField label="Interior walls (display)" value={cfg.tI} onchange={(v) => (cfg.tI = v)} />
		<NumberField label="Wall to loggia" value={cfg.tE} onchange={(v) => (cfg.tE = v)} />
	</div>
	<label class="flex items-center gap-2 text-[13px]">
		<input type="checkbox" bind:checked={planner.measured} /> Dimensions have been measured
	</label>
	<div>
		<ConfirmButton
			label="Reset to plan estimate"
			confirmLabel="Really reset room dimensions? (furniture stays)"
			onconfirm={() => planner.resetRoom()}
		/>
	</div>
</Section>
