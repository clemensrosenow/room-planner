import * as THREE from 'three';

const SPEED = 130; // cm per second
const TURN = 1.6; // radians per second
/** Key → [forward, sideways, turn left] */
const KEYS: Record<string, [number, number, number]> = {
	w: [1, 0, 0],
	arrowup: [1, 0, 0],
	s: [-1, 0, 0],
	arrowdown: [-1, 0, 0],
	a: [0, -1, 0],
	d: [0, 1, 0],
	arrowleft: [0, 0, 1],
	arrowright: [0, 0, -1]
};
/** Zoom range as a factor on the field of view (smaller = closer) */
const ZOOM_MIN = 0.45;
const ZOOM_MAX = 1.3;

/**
 * First-person camera at eye height: drag to look around, ↑↓ / WS to walk, ←→ to turn,
 * AD to sidestep (or the on-screen pad via press()), scroll or pinch to zoom.
 * Positions in plan units are cm; the camera uses meters.
 */
export class WalkControls {
	enabled = false;
	/** Field of view factor set by scrolling or pinching */
	zoom = 1;
	/** Called on any camera input, also while disabled (so the tour can be interrupted) */
	onInput: () => void = () => {};
	private yaw = 0;
	private pitch = 0;
	private held = new Set<string>();
	private pointers = new Map<number, { x: number; y: number }>();

	constructor(
		private camera: THREE.PerspectiveCamera,
		private dom: HTMLElement,
		private canStand: (x: number, y: number) => boolean
	) {
		dom.addEventListener('pointerdown', this.onDown);
		dom.addEventListener('wheel', this.onWheel, { passive: false });
		window.addEventListener('pointermove', this.onMove);
		window.addEventListener('pointerup', this.onUp);
		window.addEventListener('pointercancel', this.onUp);
		window.addEventListener('keydown', this.onKey);
		window.addEventListener('keyup', this.onKey);
		window.addEventListener('blur', this.onBlur);
	}

	dispose() {
		this.dom.removeEventListener('pointerdown', this.onDown);
		this.dom.removeEventListener('wheel', this.onWheel);
		window.removeEventListener('pointermove', this.onMove);
		window.removeEventListener('pointerup', this.onUp);
		window.removeEventListener('pointercancel', this.onUp);
		window.removeEventListener('keydown', this.onKey);
		window.removeEventListener('keyup', this.onKey);
		window.removeEventListener('blur', this.onBlur);
	}

	/** Continue from the current camera direction. */
	sync() {
		const e = new THREE.Euler().setFromQuaternion(this.camera.quaternion, 'YXZ');
		this.yaw = e.y;
		this.pitch = THREE.MathUtils.clamp(e.x, -1.2, 1.2);
	}

	/** Fresh start: no keys held. */
	reset() {
		this.held.clear();
		this.pointers.clear();
		this.sync();
	}

	press(key: string, down: boolean) {
		if (down) {
			this.onInput();
			if (this.enabled) this.held.add(key);
		} else this.held.delete(key);
	}

	update(dt: number) {
		let fwd = 0;
		let side = 0;
		let turn = 0;
		for (const k of this.held) {
			fwd += KEYS[k]?.[0] ?? 0;
			side += KEYS[k]?.[1] ?? 0;
			turn += KEYS[k]?.[2] ?? 0;
		}
		this.yaw += turn * TURN * dt;
		if (fwd || side) {
			const len = Math.hypot(fwd, side);
			const step = (SPEED * dt) / len;
			const sin = Math.sin(this.yaw);
			const cos = Math.cos(this.yaw);
			const dx = (-sin * fwd + cos * side) * step;
			const dy = (-cos * fwd - sin * side) * step;
			const x = this.camera.position.x * 100;
			const y = this.camera.position.z * 100;
			// Move each axis separately so we slide along walls
			if (this.canStand(x + dx, y)) this.camera.position.x += dx / 100;
			if (this.canStand(this.camera.position.x * 100, y + dy)) this.camera.position.z += dy / 100;
		}
		this.camera.position.y = 1.6;
		this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
	}

	private setZoom(z: number) {
		this.zoom = THREE.MathUtils.clamp(z, ZOOM_MIN, ZOOM_MAX);
	}

	/** Distance between the two touch points of a pinch */
	private spread() {
		const [a, b] = [...this.pointers.values()];
		return Math.hypot(a.x - b.x, a.y - b.y);
	}

	private onDown = (e: PointerEvent) => {
		if (!this.enabled) this.onInput();
		if (this.enabled) this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
	};

	private onMove = (e: PointerEvent) => {
		const p = this.pointers.get(e.pointerId);
		if (!p) return;
		if (this.pointers.size === 2) {
			const before = this.spread();
			Object.assign(p, { x: e.clientX, y: e.clientY });
			const after = this.spread();
			if (before > 0 && after > 0) this.setZoom((this.zoom * before) / after);
		} else {
			this.yaw += (e.clientX - p.x) * 0.004;
			this.pitch = THREE.MathUtils.clamp(this.pitch + (e.clientY - p.y) * 0.004, -1.2, 1.2);
			Object.assign(p, { x: e.clientX, y: e.clientY });
		}
		this.onInput();
	};

	private onUp = (e: PointerEvent) => this.pointers.delete(e.pointerId);

	private onWheel = (e: WheelEvent) => {
		if (!this.enabled) this.onInput();
		if (!this.enabled) return;
		e.preventDefault();
		this.setZoom(this.zoom * Math.exp(e.deltaY * 0.0012));
		this.onInput();
	};

	private onKey = (e: KeyboardEvent) => {
		const key = e.key.toLowerCase();
		const t = e.target as HTMLElement;
		if (!(key in KEYS) || ['INPUT', 'SELECT', 'TEXTAREA'].includes(t.tagName)) return;
		if (e.type === 'keyup') return this.held.delete(key);
		this.onInput();
		if (!this.enabled) return;
		e.preventDefault();
		this.held.add(key);
	};

	private onBlur = () => this.held.clear();
}
