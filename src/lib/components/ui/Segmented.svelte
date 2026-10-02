<script lang="ts" generics="T extends string">
	import Icon, { type IconName } from './Icon.svelte';

	interface Props {
		/** Accessible name of the group */
		label: string;
		value: T;
		options: readonly { value: T; label: string; icon?: IconName }[];
		onchange: (value: T) => void;
		/** Stretch the options over the full width */
		full?: boolean;
	}
	let { label, value, options, onchange, full = false }: Props = $props();
</script>

<div
	class={['flex gap-0.5 rounded-full bg-paper p-0.5', full ? 'w-full' : 'w-fit']}
	role="group"
	aria-label={label}
>
	{#each options as o (o.value)}
		<button
			class={[
				'flex cursor-pointer items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold whitespace-nowrap transition-[color,background-color,box-shadow]',
				full && 'flex-1 px-2',
				value === o.value ? 'bg-sheet text-ink shadow-sm' : 'text-muted hover:text-ink'
			]}
			aria-pressed={value === o.value}
			onclick={() => onchange(o.value)}
		>
			{#if o.icon}<Icon name={o.icon} size={16} />{/if}
			{o.label}
		</button>
	{/each}
</div>
