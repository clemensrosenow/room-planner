<script lang="ts">
	import { page } from '$app/state';
	import Segmented from '#lib/components/ui/Segmented.svelte';
	import Switch from '#lib/components/ui/Switch.svelte';
	import { loadModelIndex, type ConvertedModel } from '#lib/preview/modelIndex.ts';
	import { ModelViewer, type ShownModel, type ViewerView } from '#lib/preview/ModelViewer.ts';
	import { setParams } from '#lib/url.ts';
	import { onMount } from 'svelte';

	const VIEWS = [
		{ value: 'persp', label: '3D' },
		{ value: 'front', label: 'Front' },
		{ value: 'side', label: 'Side' },
		{ value: 'top', label: 'Top' }
	] as const satisfies readonly { value: ViewerView; label: string }[];

	/** Selection and view live in the URL (`?m=<id>&v=front`), so a reload keeps them. */
	const selected = $derived(page.url.searchParams.get('m') ?? 'all');
	const view = $derived(
		VIEWS.find((v) => v.value === page.url.searchParams.get('v'))?.value ?? 'persp'
	);

	let container: HTMLDivElement;
	let viewer = $state<ModelViewer | null>(null);
	let models = $state<ConvertedModel[]>([]);
	let shown = $state<ShownModel[]>([]);
	let error = $state('');
	let loading = $state(false);
	let guides = $state(true);
	let wireframe = $state(false);

	const visible = $derived(selected === 'all' ? models : models.filter((m) => m.id === selected));

	onMount(() => {
		try {
			viewer = new ModelViewer(container);
		} catch {
			error = 'WebGL is not available.';
			return;
		}
		loadModelIndex()
			.then((list) => (models = list))
			.catch(() => (error = 'No models yet. Run `npm run models` first.'));
		return () => viewer?.dispose();
	});

	$effect(() => {
		const v = viewer;
		const list = visible;
		if (!v || !list.length) return;
		loading = true;
		v.show(list)
			.then((s) => {
				if (s.length) shown = s;
			})
			.catch((e) => (error = `Could not load: ${e.message ?? e}`))
			.finally(() => (loading = false));
	});

	$effect(() => viewer?.setView(view));
	$effect(() => viewer?.setGuides(guides));
	$effect(() => viewer?.setWireframe(wireframe));

	const kb = (bytes: number) => `${Math.round(bytes / 1024)} KB`;
	const k = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)}k` : String(n));
	const dims = (s: { w: number; d: number; h: number }) => `${s.w} × ${s.d} × ${s.h}`;
	/** The size measured in the browser matches the index within 1 cm (R1). */
	const matches = (m: ConvertedModel, s: ShownModel) =>
		(['w', 'd', 'h'] as const).every((key) => Math.abs(m.size[key] - s.size[key]) <= 1);
</script>

<svelte:head>
	<title>Models · Room Planner</title>
</svelte:head>

<div class="relative h-full" bind:this={container}>
	<aside
		class="absolute top-20 left-4 z-10 flex max-h-[calc(100%-6rem)] w-72 flex-col overflow-y-auto rounded-2xl bg-sheet/90 p-2 shadow-float ring-1 ring-line/70 backdrop-blur-md"
	>
		<h1 class="px-2 pt-1 pb-2 text-[13px] font-bold">3D models</h1>
		<button
			class={[
				'rounded-xl px-3 py-2 text-left text-[13.5px] font-semibold transition-colors',
				selected === 'all' ? 'bg-accent-soft text-ink' : 'text-muted hover:text-ink'
			]}
			aria-pressed={selected === 'all'}
			onclick={() => setParams({ m: null }, { replace: true })}
		>
			All side by side
		</button>
		{#each models as m (m.id)}
			<button
				class={[
					'rounded-xl px-3 py-2 text-left transition-colors',
					selected === m.id ? 'bg-accent-soft' : 'hover:bg-paper'
				]}
				aria-pressed={selected === m.id}
				onclick={() => setParams({ m: m.id }, { replace: true })}
			>
				<span class="flex items-center gap-2 text-[13.5px] font-semibold">
					{m.id}
					{#if m.mount === 'ceiling'}
						<span class="rounded-full bg-paper px-1.5 text-[11px] font-semibold text-muted">
							ceiling
						</span>
					{/if}
				</span>
				<span class="block text-[12px] text-muted tabular-nums">
					{dims(m.size)} cm · {k(m.triangles)} tris · {kb(m.bytes)}
				</span>
			</button>
		{/each}
	</aside>

	{#if shown.length}
		<section
			class="absolute top-20 right-4 z-10 w-64 rounded-2xl bg-sheet/90 p-3 text-[12.5px] shadow-float ring-1 ring-line/70 backdrop-blur-md"
			aria-label="Measured in the browser"
		>
			<h2 class="pb-1.5 text-[13px] font-bold">Measured here</h2>
			{#each shown as s (s.id)}
				{@const m = models.find((x) => x.id === s.id)}
				<div class="border-t border-line py-1.5 first-of-type:border-0">
					{#if shown.length > 1}<div class="font-semibold">{s.id}</div>{/if}
					<div class="flex justify-between tabular-nums">
						<span class="text-muted">Size cm</span>
						<span>
							{dims(s.size)}
							{#if m}
								<span
									class={matches(m, s) ? 'text-ok' : 'text-warn'}
									title={matches(m, s) ? 'Matches the index' : `Index says ${dims(m.size)}`}
								>
									{matches(m, s) ? '✓' : '≠'}
								</span>
							{/if}
						</span>
					</div>
					<div class="flex justify-between tabular-nums">
						<span class="text-muted">Triangles</span>
						<span>{s.triangles.toLocaleString()}</span>
					</div>
					{#if s.loadMs}
						<div class="flex justify-between tabular-nums">
							<span class="text-muted">Load</span><span>{s.loadMs} ms</span>
						</div>
					{/if}
				</div>
			{/each}
		</section>
	{/if}

	<div
		class="pointer-events-none absolute inset-x-0 bottom-5 z-10 flex justify-center max-sm:bottom-3"
	>
		<div
			class="pointer-events-auto flex items-center gap-4 rounded-full bg-sheet/90 py-1 pr-4 pl-1 shadow-float ring-1 ring-line/70 backdrop-blur-md"
		>
			<Segmented
				label="Camera"
				value={view}
				options={VIEWS}
				onchange={(v) => setParams({ v: v === 'persp' ? null : v }, { replace: true })}
			/>
			<Switch label="Dimensions" bind:checked={guides} />
			<Switch label="Wireframe" bind:checked={wireframe} />
		</div>
	</div>

	{#if error || loading}
		<p
			class="absolute bottom-20 left-1/2 z-10 -translate-x-1/2 rounded-full bg-sheet/90 px-3 py-1 text-[13px] shadow-float"
			class:text-warn={error}
		>
			{error || 'Loading…'}
		</p>
	{/if}
</div>
