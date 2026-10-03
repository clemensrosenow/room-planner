<script lang="ts" module>
	import type { Kind } from '#lib/planner/catalog.ts';

	/** Top-down sketches on a 40 × 40 grid; `.f` parts take the piece's color. */
	const SHAPES: Record<Kind, string> = {
		bed: '<rect class="f" x="9" y="5" width="22" height="30" rx="2.5"/><rect x="12" y="8" width="7" height="5" rx="1.5"/><rect x="21" y="8" width="7" height="5" rx="1.5"/><path d="M9 17h22"/>',
		desk: '<rect class="f" x="5" y="11" width="30" height="16" rx="1.5"/><rect x="15" y="14" width="10" height="6" rx="1"/><path d="M18 23h4"/>',
		chair:
			'<rect class="f" x="12" y="13" width="16" height="16" rx="3"/><rect x="11" y="9" width="18" height="4" rx="1.5"/>',
		wardrobe:
			'<rect class="f" x="6" y="12" width="28" height="16" rx="1.5"/><path d="M20 12v16M17 24h-2m10 0h-2"/>',
		shelf:
			'<rect class="f" x="5" y="15" width="30" height="10" rx="1"/><path d="M15 15v10m10-10v10M8 18v4m2.5-4v4m7.5-4v4m3-4v4"/>',
		nightstand:
			'<rect class="f" x="11" y="11" width="18" height="18" rx="2.5"/><circle cx="20" cy="20" r="4.5"/>',
		lamp: '<circle class="f" cx="20" cy="20" r="11"/><circle cx="20" cy="20" r="3.5"/><path d="M20 5v3m0 24v3M5 20h3m24 0h3"/>',
		box: '<rect class="f" x="9" y="9" width="22" height="22" rx="3"/><path d="M9 15h22" opacity=".5"/>'
	};
</script>

<script lang="ts">
	import { PALETTE } from '#lib/planner/defaults.ts';

	let { kind, color = 0, size = 32 }: { kind: Kind; color?: number; size?: number } = $props();
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 40 40"
	fill="none"
	stroke="currentColor"
	stroke-width="1.5"
	stroke-linejoin="round"
	stroke-linecap="round"
	aria-hidden="true"
	class="flex-none"
	style:--fill="var({PALETTE[color % PALETTE.length]})"
>
	{@html SHAPES[kind]}
</svg>

<style>
	svg :global(.f) {
		fill: var(--fill);
	}
</style>
