import {
	HalfFloatType,
	WebGLRenderTarget,
	type WebGLRenderer,
	type Scene,
	type Camera,
	type RenderTargetOptions
} from 'three';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';

/** Multisample geometry once, rather than every fullscreen postprocessing pass. */
export class AntialiasedRenderPass extends RenderPass {
	private target: WebGLRenderTarget;

	constructor(
		scene: Scene,
		camera: Camera,
		samples = 4,
		color: RenderTargetOptions = { type: HalfFloatType }
	) {
		super(scene, camera);
		this.target = new WebGLRenderTarget(1, 1, { ...color, samples });
	}
	get texture() {
		return this.target.texture;
	}

	/** Compile the same HDR material variants used by the real geometry pass. */
	compileAsync(renderer: WebGLRenderer) {
		const target = renderer.getRenderTarget();
		const face = renderer.getActiveCubeFace();
		const mip = renderer.getActiveMipmapLevel();
		renderer.setRenderTarget(this.target);
		try {
			return renderer.compileAsync(this.scene, this.camera);
		} finally {
			renderer.setRenderTarget(target, face, mip);
		}
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
