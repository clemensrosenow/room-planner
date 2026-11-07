// Injected before the production app. No application module is pre-imported.
(() => {
	if (new URL(location.href).searchParams.has('no-decompression'))
		window.DecompressionStream = undefined;
	const phone = new URL(location.href).searchParams.has('phone');
	if (phone) {
		const media = matchMedia.bind(window);
		window.matchMedia = (q) => {
			const m = media(q);
			if (q === '(pointer: coarse)') Object.defineProperty(m, 'matches', { value: true });
			return m;
		};
		Object.defineProperty(screen, 'width', { value: 390, configurable: true });
	}
	const ids = [
		'bed',
		'wardrobe',
		'workstation',
		'piano',
		'kallax',
		'nightstand',
		'nymo-lamp',
		'floor-lamp'
	];
	localStorage.setItem(
		'room-planner-v1',
		JSON.stringify({
			schema: 2,
			roomId: 'clemens-v3',
			placements: Object.fromEntries(
				ids.map((id, i) => [
					id,
					{ cx: 80 + (i % 3) * 140, cy: 90 + Math.floor(i / 3) * 130, rot: 0 }
				])
			)
		})
	);
	const report = (window.startupReport = {
		phone,
		contexts: [],
		links: [],
		queries: [],
		longTasks: [],
		errors: [],
		visits: []
	});
	window.addEventListener('error', (e) => report.errors.push(e.message));
	window.addEventListener('unhandledrejection', (e) => report.errors.push(String(e.reason)));
	new PerformanceObserver((list) =>
		report.longTasks.push(
			...list.getEntries().map((e) => ({ start: e.startTime, duration: e.duration }))
		)
	).observe({ type: 'longtask' });
	const getContext = HTMLCanvasElement.prototype.getContext;
	const seen = new WeakSet();
	HTMLCanvasElement.prototype.getContext = function (type, ...args) {
		if (type.startsWith('webgl') && !seen.has(this)) {
			seen.add(this);
			report.contexts.push(performance.now());
		}
		return getContext.call(this, type, ...args);
	};
	const link = WebGL2RenderingContext.prototype.linkProgram;
	WebGL2RenderingContext.prototype.linkProgram = function (...args) {
		const start = performance.now();
		const result = link.apply(this, args);
		report.links.push({ start, duration: performance.now() - start });
		return result;
	};
	for (const name of ['getProgramParameter', 'getShaderParameter']) {
		const original = WebGL2RenderingContext.prototype[name];
		WebGL2RenderingContext.prototype[name] = function (...args) {
			const start = performance.now();
			const result = original.apply(this, args);
			const duration = performance.now() - start;
			if (duration > 2) report.queries.push({ name, start, duration });
			return result;
		};
	}
	let visit = { start: 0, loader: null, ready: null };
	report.visits.push(visit);
	const loading = () =>
		[...document.querySelectorAll('[role="status"]')].some((e) =>
			e.textContent.includes('Loading room')
		);
	const observer = new MutationObserver(() => {
		if (location.pathname !== '/experience') return;
		if (loading() && visit.loader === null) visit.loader = performance.now();
		if (!loading() && visit.loader !== null && visit.ready === null)
			visit.ready = performance.now();
	});
	observer.observe(document.documentElement, { childList: true, subtree: true });
	window.startupNextVisit = () => {
		visit = { start: performance.now(), loader: null, ready: null };
		report.visits.push(visit);
	};
	window.startupResources = () =>
		performance
			.getEntriesByType('resource')
			.filter((e) => e.name.includes(location.origin))
			.map((e) => ({
				path: new URL(e.name).pathname,
				start: e.startTime,
				end: e.responseEnd,
				bytes: e.encodedBodySize,
				transfer: e.transferSize
			}));
	window.startupActions = async () => {
		const frame = () => new Promise(requestAnimationFrame),
			actions = [];
		for (const [name, change] of [
			[
				'first evening',
				() => {
					const input = document.querySelector('[aria-label="Time of day"]');
					input.value = '21.5';
					input.dispatchEvent(new Event('input', { bubbles: true }));
				}
			],
			['first lamp', () => document.querySelector('button[aria-label="Lights"]').click()],
			[
				'return daylight',
				() => {
					const input = document.querySelector('[aria-label="Time of day"]');
					input.value = '10';
					input.dispatchEvent(new Event('input', { bubbles: true }));
				}
			]
		]) {
			const start = performance.now(),
				before = report.links.length;
			change();
			await frame();
			await frame();
			const nextPaintMs = performance.now() - start;
			await new Promise((r) => setTimeout(r, 400));
			actions.push({
				name,
				nextPaintMs,
				newPrograms: report.links.length - before,
				longTasks: report.longTasks.filter((e) => e.start >= start)
			});
		}
		return (report.actions = actions);
	};
})();
