import {
	HalfFloatType,
	WebGLRenderTarget,
	type WebGLRenderer,
	type Scene,
	type Camera
} from 'three';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';

/** Multisample geometry once, rather than every fullscreen postprocessing pass. */
export class AntialiasedRenderPass extends RenderPass {
	private target: WebGLRenderTarget;

	constructor(scene: Scene, camera: Camera, samples = 4) {
		super(scene, camera);
		this.target = new WebGLRenderTarget(1, 1, { type: HalfFloatType, samples });
	}
	get texture() {
		return this.target.texture;
	}

	override setSize(width: number, height: number) {
		this.target.setSize(width, height);
	}

	override render(renderer: WebGLRenderer, writeBuffer: WebGLRenderTarget) {
		super.render(renderer, writeBuffer, this.target, 0, false);
	}

	override dispose() {
		this.target.dispose();
	}
}
