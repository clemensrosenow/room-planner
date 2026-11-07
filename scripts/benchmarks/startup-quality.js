import { PreviewScene } from './PreviewScene.ts';
import { PreviewScene as Baseline } from './PreviewScene.startup-baseline.ts';
import { GEO, INVENTORY } from '../planner/room.ts';
import { MODELS } from '../planner/catalog.ts';
import { loadModel } from './modelLoader.ts';
import { makeShots } from './shots.ts';
// Reuse the existing image metric without importing its baseline/runtime harness.
import { compare } from './startup-compare.js';
const media = window.matchMedia.bind(window);
window.matchMedia = (q) => {
	const m = media(q);
	if (q === '(pointer: coarse)')
		Object.defineProperty(m, 'matches', { value: window.startupPhone ?? true });
	return m;
};
Object.defineProperty(screen, 'width', { value: 390, configurable: true });
await Promise.all(Object.keys(MODELS).map(loadModel));
const furn = INVENTORY.map((p, i) => ({
	...p,
	cx: 80 + (i % 3) * 140,
	cy: 90 + Math.floor(i / 3) * 130,
	rot: 0
}));
window.showStartup = async (baseline = false, phone = true) => {
	window.startupScene?.dispose();
	window.startupPhone = phone;
	const el = document.getElementById('bench');
	el.style.width = phone ? '390px' : '1280px';
	el.style.height = phone ? '844px' : '800px';
	const s = (window.startupScene = new (baseline ? Baseline : PreviewScene)(el));
	cancelAnimationFrame(s.frame);
	s.resizeObserver.disconnect();
	s.build(GEO, furn);
	s.goTo(makeShots(GEO)[0], true);
	s.update(1);
	await s.prepare();
	s.sky.material.uniforms.time.value = 0;
	return {
		programs: s.renderer.info.programs.length,
		size: [s.renderer.domElement.width, s.renderer.domElement.height],
		glError: s.renderer.getContext().getError()
	};
};
window.captureStartup = (hours = 10, lamp = false, shot = 'above') => {
	const s = startupScene;
	s.goTo(
		makeShots(GEO).find((x) => x.id === shot),
		true
	);
	s.update(1);
	s.setTime(hours);
	s.setLamp(lamp);
	s.sky.material.uniforms.time.value = 0;
	s.updateEnvironment(performance.now());
	s.composer.render();
	const c = document.createElement('canvas');
	c.width = 390;
	c.height = 844;
	c.getContext('2d').drawImage(s.renderer.domElement, 0, 0, 390, 844);
	return c.getContext('2d').getImageData(0, 0, 390, 844).data;
};
window.startupSweep = async () => {
	const s = startupScene,
		before = s.renderer.info.programs.length;
	for (const lamp of [false, true])
		for (let hours = 5; hours <= 21.5; hours += 0.25) {
			s.setLamp(lamp);
			s.setTime(hours);
			s.composer.render();
			await new Promise(requestAnimationFrame);
		}
	for (const shot of makeShots(GEO)) {
		s.goTo(shot, true);
		s.update(1);
		s.composer.render();
	}
	return {
		newPrograms: s.renderer.info.programs.length - before,
		glError: s.renderer.getContext().getError(),
		shaderFailures: s.renderer.info.programs.filter((p) => p.diagnostics?.runnable === false).length
	};
};
window.compareStartup = compare;
window.startupQualityReady = true;
