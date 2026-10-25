<script lang="ts">
	import { planner } from '#lib/planner/planner.svelte.ts';
	import { RoomScene } from '#lib/planner/scene3d.ts';
	import type { Point } from '#lib/planner/types.ts';
	import { selectItem } from '#lib/url.ts';
	import { onMount, untrack } from 'svelte';
	import Loader from './ui/Loader.svelte';

	interface Props {
		/** Screen position above the selected piece (px within this view) */
		onanchor?: (p: { x: number; y: number } | null) => void;
	}
	let { onanchor }: Props = $props();

	let container: HTMLDivElement;
	let scene = $state<RoomScene | null>(null);
	let failed = $state(false);
	/**
	 * Real models are in, or took too long. Only the first load shows the loader: models of
	 * Pieces dragged in later must not cover the view mid-drag
	 */
	let ready = $state(false);
	/** The loader gives up waiting for slow models after this many ms */
	const LOAD_TIMEOUT = 8000;
	/** Bumped when colors or fonts change, so everything gets rebuilt */
	let styleVersion = $state(0);

	/** Floor point (plan cm) under a screen point, or null outside the view. */
	export function planPoint(clientX: number, clientY: number): Point | null {
		return scene?.planPoint(clientX, clientY) ?? null;
	}

	onMount(() => {
		try {
			scene = new RoomScene(container, {
				onSelect: (id) => selectItem(id),
				onDrag: (id, cx, cy, snap) => planner.move(id, cx, cy, snap),
				onAnchor: (p) => onanchor?.(p),
				onSettled: () => (ready = true)
			});
		} catch {
			failed = true;
			return;
		}
		scene.fitCamera(planner.geo);
		const timer = setTimeout(() => (ready = true), LOAD_TIMEOUT);

		const dark = window.matchMedia('(prefers-color-scheme: dark)');
		const restyle = () => styleVersion++;
		dark.addEventListener('change', restyle);
		document.fonts?.ready.then(restyle);
		return () => {
			clearTimeout(timer);
			dark.removeEventListener('change', restyle);
			scene?.dispose();
		};
	});

	$effect(() => {
		void styleVersion;
		scene?.setRoom(planner.geo);
		untrack(() => scene?.setBlockedDoors(blockedDoors()));
	});

	// Full rebuild only when pieces come or go, or a size, name, color or model changes
	$effect(() => {
		void styleVersion;
		void planner.furn.map((f) => [f.id, f.w, f.d, f.h, f.name, f.color, f.model]);
		const s = scene;
		untrack(() => s?.setFurniture(planner.furn));
	});

	/**
	 * Pieces with a Conflict, as a string: `checks` is new on every move, but this only changes
	 * when a Piece starts or stops being in Conflict, e.g. while dragged across another one
	 */
	const conflicted = $derived(
		planner.furn
			.filter((f) => planner.checks[f.id]?.bad)
			.map((f) => f.id)
			.join('\n')
	);

	// Selection and Conflicts are restyled in place
	$effect(() => {
		void styleVersion;
		void conflicted;
		void planner.selectedId;
		const s = scene;
		untrack(() => s?.setMarks(planner.furn, planner.checks, planner.selectedId));
	});

	$effect(() => {
		void planner.furn.map((f) => [f.cx, f.cy, f.rot]);
		scene?.setPositions(planner.furn);
	});

	/** Doors whose swing area any piece blocks */
	const blockedDoors = () => Object.values(planner.checks).flatMap((c) => c.doors);
	$effect(() => scene?.setBlockedDoors(blockedDoors()));
</script>

<div class="relative isolate h-full w-full">
	<div bind:this={container} class="h-full w-full">
		{#if failed}
			<div class="grid h-full place-items-center p-5 text-center text-muted">
				3D is not supported by this browser. The floor plan still works.
			</div>
		{/if}
	</div>
	<Loader show={!ready && !failed} tone="scene" />
</div>
