// Run in a fresh /furnish preview tab, using isolated browser storage. This harness
// instruments the real UI; importing the renderer for instrumentation warms its JS
// module, but each navigation still creates a fresh WebGL context and programs.
// Set window.coldPhone = true and resize to 390×844 for the existing phone path.
window.coldResult = null;
window.coldRun = (async () => {
	const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
	const frame = () => new Promise(requestAnimationFrame);
	if (window.coldPhone) {
		const media = window.matchMedia.bind(window);
		window.matchMedia = (query) => {
			const result = media(query);
			if (query === '(pointer: coarse)') Object.defineProperty(result, 'matches', { value: true });
			return result;
		};
		Object.defineProperty(screen, 'width', { value: 390, configurable: true });
		Object.defineProperty(screen, 'height', { value: 844, configurable: true });
	}
	const { planner } = await import('/src/lib/planner/planner.svelte.ts');
	const { INVENTORY } = await import('/src/lib/planner/room.ts');
	// Match Vite's current module identity after edits (its imports may have ?t=...).
	const previewCode = await (await fetch('/src/lib/components/Preview.svelte')).text();
	const scenePath = previewCode.match(/["']([^"']*\/preview\/PreviewScene\.ts[^"']*)["']/)?.[1];
	if (!scenePath) throw Error('Renderer import not found in compiled Preview');
	const { PreviewScene } = await import(scenePath);
	planner.furn = INVENTORY.map((p, i) => ({
		...p,
		cx: 80 + (i % 3) * 140,
		cy: 90 + Math.floor(i / 3) * 130,
		rot: 0
	}));
	document.querySelector('button[aria-label="Close"]')?.click();
	await sleep(2000);
	let scene;
	const build = PreviewScene.prototype.build;
	PreviewScene.prototype.build = function (...args) {
		scene = window.coldScene = this;
		return build.apply(this, args);
	};
	const links = [],
		contexts = [],
		tasks = [],
		gaps = [];
	const link = WebGL2RenderingContext.prototype.linkProgram;
	WebGL2RenderingContext.prototype.linkProgram = function (...args) {
		links.push(performance.now());
		return link.apply(this, args);
	};
	const getContext = HTMLCanvasElement.prototype.getContext;
	const seen = new WeakSet();
	HTMLCanvasElement.prototype.getContext = function (type, ...args) {
		if (type.startsWith('webgl') && !seen.has(this)) {
			seen.add(this);
			contexts.push(performance.now());
		}
		return getContext.call(this, type, ...args);
	};
	const observer = new PerformanceObserver((list) => {
		tasks.push(...list.getEntries().map((e) => ({ start: e.startTime, duration: e.duration })));
	});
	observer.observe({ type: 'longtask' });
	const start = performance.now();
	let stop = false,
		previous = start,
		feedback = null,
		roomFeedback = null;
	const loader = () =>
		[...document.querySelectorAll('[role="status"]')].find((e) =>
			e.textContent.includes('Loading room')
		);
	function sample(now) {
		gaps.push({ start: previous, duration: now - previous });
		previous = now;
		if (
			feedback === null &&
			document.querySelector('[aria-label="Loading page"],a[href="/experience"][aria-busy="true"]')
		)
			feedback = now;
		if (roomFeedback === null && location.pathname === '/experience' && loader())
			roomFeedback = now;
		if (!stop) requestAnimationFrame(sample);
	}
	requestAnimationFrame(sample);
	document.querySelector('a[href="/experience"]').click();
	while (!scene || location.pathname !== '/experience' || loader()) {
		if (performance.now() - start > 60000) throw Error('Preview did not become ready');
		await sleep(20);
	}
	await frame();
	await frame();
	const ready = performance.now();
	await sleep(500);
	const action = async (name, perform) => {
		const started = performance.now(),
			programsBefore = links.length;
		perform();
		await frame();
		await frame();
		const paint = performance.now() - started;
		await sleep(700);
		return {
			name,
			nextPaintMs: paint,
			newPrograms: links.length - programsBefore,
			longTasks: tasks.filter((e) => e.start >= started),
			maxFrameGapMs: Math.max(0, ...gaps.filter((e) => e.start >= started).map((e) => e.duration))
		};
	};
	const time = (hours) => {
		const input = document.querySelector('input[aria-label="Time of day"]');
		input.value = String(hours);
		input.dispatchEvent(new Event('input', { bubbles: true }));
	};
	const lamp = () => document.querySelector('button[aria-label="Lights"]').click();
	const actions = [];
	actions.push(await action('first evening', () => time(21.5)));
	actions.push(await action('first lights on', lamp));
	actions.push(await action('return daylight', () => time(10)));
	actions.push(await action('lights off', lamp));
	actions.push(await action('repeat evening', () => time(21.5)));
	actions.push(await action('repeat lights on', lamp));
	const beforeSweep = links.length;
	for (const on of [false, true]) {
		scene.setLamp(on);
		for (let hours = 5; hours <= 21.5; hours += 0.25) {
			scene.setTime(hours);
			await frame();
		}
	}
	await sleep(200);
	const extraSweepPrograms = links.length - beforeSweep;
	scene.setTime(10);
	scene.setLamp(false);
	stop = true;
	observer.disconnect();
	PreviewScene.prototype.build = build;
	WebGL2RenderingContext.prototype.linkProgram = link;
	HTMLCanvasElement.prototype.getContext = getContext;
	return (window.coldResult = {
		phone: scene.phone,
		viewport: [innerWidth, innerHeight],
		parallelCompile: !!scene.renderer.getContext().getExtension('KHR_parallel_shader_compile'),
		navigation: {
			firstFeedbackMs: feedback === null ? null : feedback - start,
			roomLoaderMs: roomFeedback === null ? null : roomFeedback - start,
			webglContextMs: contexts[0] - start,
			readyMs: ready - start,
			longTasks: tasks.filter((e) => e.start >= start && e.start < ready),
			maxFrameGapMs: Math.max(0, ...gaps.filter((e) => e.start < ready).map((e) => e.duration))
		},
		actions,
		extraSweepPrograms,
		programs: scene.renderer.info.programs.length,
		glError: scene.renderer.getContext().getError(),
		shaderFailures: scene.renderer.info.programs.filter((p) => p.diagnostics?.runnable === false)
			.length
	});
})().catch((e) => (window.coldResult = { error: String(e), stack: e.stack }));
