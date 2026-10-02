import * as THREE from 'three';

const SPEED = 130; // cm per second
const KEYS: Record<string, [number, number]> = {
	w: [1, 0],
	arrowup: [1, 0],
	s: [-1, 0],
	arrowdown: [-1, 0],
	a: [0, -1],
	arrowleft: [0, -1],
	d: [0, 1],
	arrowright: [0, 1]
};

/**
 * First-person camera at eye height: drag to look around, WASD / arrow keys (or the
 * on-screen pad via press()) to walk. Positions in plan units are cm; the camera uses meters.
 */
export class WalkControls {
	enabled = false;
	private yaw = 0;
	private pitch = 0;
	private held = new Set<string>();
	private drag: { x: number; y: number } | null = null;

	constructor(
		private camera: THREE.PerspectiveCamera,
		private dom: HTMLElement,
		private canStand: (x: number, y: number) => boolean
	) {
		dom.addEventListener('pointerdown', this.onDown);
		window.addEventListener('pointermove', this.onMove);
		window.addEventListener('pointerup', this.onUp);
		window.addEventListener('keydown', this.onKey);
		window.addEventListener('keyup', this.onKey);
		window.addEventListener('blur', this.onBlur);
	}

	dispose() {
		this.dom.removeEventListener('pointerdown', this.onDown);
		window.removeEventListener('pointermove', this.onMove);
		window.removeEventListener('pointerup', this.onUp);
		window.removeEventListener('keydown', this.onKey);
		window.removeEventListener('keyup', this.onKey);
		window.removeEventListener('blur', this.onBlur);
	}

	/** Stand at `pos` looking at `target` (plan [x, height, y] in cm). */
	place(pos: [number, number, number], target: [number, number, number]) {
		this.camera.position.set(pos[0], 160, pos[2]).multiplyScalar(0.01);
		this.yaw = Math.atan2(-(target[0] - pos[0]), -(target[2] - pos[2]));
		this.pitch = -0.08;
		this.apply();
	}

	/** Continue from the current camera direction. */
	start() {
		const e = new THREE.Euler().setFromQuaternion(this.camera.quaternion, 'YXZ');
		this.yaw = e.y;
		this.pitch = THREE.MathUtils.clamp(e.x, -1.2, 1.2);
		this.held.clear();
	}

	press(key: string, down: boolean) {
		if (down) this.held.add(key);
		else this.held.delete(key);
	}

	update(dt: number) {
		let fwd = 0;
		let side = 0;
		for (const k of this.held) {
			fwd += KEYS[k]?.[0] ?? 0;
			side += KEYS[k]?.[1] ?? 0;
		}
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
		this.apply();
	}

	private apply() {
		this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
	}

	private onDown = (e: PointerEvent) => {
		if (this.enabled) this.drag = { x: e.clientX, y: e.clientY };
	};

	private onMove = (e: PointerEvent) => {
		if (!this.drag) return;
		this.yaw += (e.clientX - this.drag.x) * 0.004;
		this.pitch = THREE.MathUtils.clamp(this.pitch + (e.clientY - this.drag.y) * 0.004, -1.2, 1.2);
		this.drag = { x: e.clientX, y: e.clientY };
	};

	private onUp = () => (this.drag = null);

	private onKey = (e: KeyboardEvent) => {
		const key = e.key.toLowerCase();
		const t = e.target as HTMLElement;
		if (!this.enabled || !(key in KEYS) || ['INPUT', 'SELECT', 'TEXTAREA'].includes(t.tagName))
			return;
		e.preventDefault();
		this.press(key, e.type === 'keydown');
	};

	private onBlur = () => this.held.clear();
}
