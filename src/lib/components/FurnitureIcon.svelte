<script lang="ts" module>
	import type { Kind } from '#lib/planner/catalog.ts';

	/** Top-down sketches on a 40 × 40 grid; `.f` parts take the piece's color. */
	const SHAPES: Record<Kind, string> = {
		bed: '<rect class="f" x="9" y="5" width="22" height="30" rx="2.5"/><rect x="12" y="8" width="7" height="5" rx="1.5"/><rect x="21" y="8" width="7" height="5" rx="1.5"/><path d="M9 17h22"/>',
		desk: '<rect class="f" x="5" y="11" width="30" height="16" rx="1.5"/><rect x="15" y="14" width="10" height="6" rx="1"/><path d="M18 23h4"/>',
		'standing-desk':
			'<rect class="f" x="5" y="7" width="30" height="15" rx="1.5"/><rect x="13" y="9" width="14" height="3" rx="1"/><rect class="f" x="14" y="25" width="12" height="11" rx="3"/><path d="M13 25h14"/>',
		monitor:
			'<rect class="f" x="7" y="15" width="26" height="5" rx="1.5"/><path d="M17 24h6M20 20v4"/>',
		laptop:
			'<rect class="f" x="10" y="13" width="20" height="14" rx="1.5"/><path d="M10 15.5h20M17 23h6"/>',
		stool: '<circle class="f" cx="20" cy="20" r="9"/><circle cx="20" cy="20" r="2.5"/>',
		piano:
			'<rect class="f" x="4" y="12" width="32" height="9" rx="1.5"/><path d="M8 17v4m4-4v4m4-4v4m4-4v4m4-4v4m4-4v4m4-4v4"/><circle cx="20" cy="29" r="4"/>',
		plant:
			'<path class="f" d="M20 20C16 9 7 7 6 13s7 8 14 7zm0 0c4-11 13-13 14-7s-7 8-14 7zm0 0c-3 7-11 11-8 14s8-4 8-14zm0 0c3 7 11 11 8 14s-8-4-8-14z"/><circle cx="20" cy="20" r="3"/>',
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
	import { hexColor } from '#lib/planner/format.ts';

	let {
		kind,
		color = 0xbbbbbb,
		size = 32
	}: { kind: Kind; color?: number; size?: number } = $props();
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
	style:--fill={hexColor(color)}
>
	{@html SHAPES[kind]}
</svg>

<style>
	svg :global(.f) {
		fill: var(--fill);
	}
</style>
