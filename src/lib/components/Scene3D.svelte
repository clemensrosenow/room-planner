<script lang="ts">
	import { planner } from '#lib/planner/planner.svelte.ts';
	import { RoomScene } from '#lib/planner/scene3d.ts';
	import { onMount, untrack } from 'svelte';

	let { lowWalls }: { lowWalls: boolean } = $props();

	let container: HTMLDivElement;
	let scene = $state<RoomScene | null>(null);
	let failed = $state(false);
	/** Bumped when colors or fonts change, so everything gets rebuilt */
	let styleVersion = $state(0);

	export function resetCamera() {
		scene?.fitCamera(planner.geo);
	}

	onMount(() => {
		try {
			scene = new RoomScene(container, {
				onSelect: (id) => planner.select(id),
				onDrag: (id, cx, cy, snap) => planner.move(id, cx, cy, snap)
			});
		} catch {
			failed = true;
			return;
		}
		scene.fitCamera(planner.geo);

		const dark = window.matchMedia('(prefers-color-scheme: dark)');
		const restyle = () => styleVersion++;
		dark.addEventListener('change', restyle);
		document.fonts?.ready.then(restyle);
		return () => {
			dark.removeEventListener('change', restyle);
			scene?.dispose();
		};
	});

	$effect(() => {
		void styleVersion;
		scene?.setRoom(planner.geo, lowWalls);
	});

	// Full rebuild only when something other than the position changes
	$effect(() => {
		void styleVersion;
		void planner.furn.map((f) => [f.w, f.d, f.h, f.name, f.color, planner.checks[f.id]?.bad]);
		void planner.selectedId;
		const s = scene;
		untrack(() => s?.setFurniture(planner.furn, planner.checks, planner.selectedId));
	});

	$effect(() => {
		void planner.furn.map((f) => [f.cx, f.cy, f.rot]);
		scene?.setPositions(planner.furn);
	});
</script>

<div bind:this={container} class="h-full w-full">
	{#if failed}
		<div class="grid h-full place-items-center p-5 text-center text-muted">
			3D is not supported by this browser. The floor plan still works.
		</div>
	{/if}
</div>
