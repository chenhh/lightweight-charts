import { IPaneRenderer } from './ipane-renderer';

export abstract class ScaledRenderer implements IPaneRenderer {
	public draw(ctx: CanvasRenderingContext2D, pixelRatio: number, isHovered: boolean, hitTestData?: unknown): void {
		ctx.save();
		// actually we must be sure that this scaling applied only once at the same time
		// currently ScaledRenderer could be only nodes renderer (not top-level renderers like CompositeRenderer or something)
		// so this "constraint" is fulfilled for now
		ctx.scale(pixelRatio, pixelRatio);	// scale(x,y), x,y為縮放比例，負值表示反向, 大小為比例，此處為長寬等比例縮放
		this._drawImpl(ctx, isHovered, hitTestData);	// 前景繪圖，待實作
		ctx.restore();
	}

	public drawBackground(ctx: CanvasRenderingContext2D, pixelRatio: number, isHovered: boolean, hitTestData?: unknown): void {
		ctx.save();
		// actually we must be sure that this scaling applied only once at the same time
		// currently ScaledRenderer could be only nodes renderer (not top-level renderers like CompositeRenderer or something)
		// so this "constraint" is fulfilled for now
		ctx.scale(pixelRatio, pixelRatio);	// 長寬等比例縮放
		this._drawBackgroundImpl(ctx, isHovered, hitTestData); // 背景繪圖，預設沒有實作
		ctx.restore();
	}

	protected abstract _drawImpl(ctx: CanvasRenderingContext2D, isHovered: boolean, hitTestData?: unknown): void;

	protected _drawBackgroundImpl(ctx: CanvasRenderingContext2D, isHovered: boolean, hitTestData?: unknown): void {}
}
