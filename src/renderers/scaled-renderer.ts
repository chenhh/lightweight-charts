import { IPaneRenderer } from './ipane-renderer';

export abstract class ScaledRenderer implements IPaneRenderer {
	/**
	 * ScaledRender實作了部份IPaneRender的函數，且為一些class的抽象類，
	 * 已經實作的部份被繼承後可共用。
	 */
	public draw(ctx: CanvasRenderingContext2D, pixelRatio: number, isHovered: boolean, hitTestData?: unknown): void {
		// 儲存 canvas 全部狀態, 當前的變換矩陣，當前的剪下區域，當前的虛線列表.
		// https://developer.mozilla.org/zh-CN/docs/Web/API/CanvasRenderingContext2D/save
		ctx.save();
		// actually we must be sure that this scaling applied only once at the same time
		// currently ScaledRenderer could be only nodes renderer (not top-level renderers like CompositeRenderer or something)
		// so this "constraint" is fulfilled for now
		ctx.scale(pixelRatio, pixelRatio);	// scale(x,y), x,y為縮放比例，負值表示反向, 大小為比例，此處為長寬等比例縮放
		this._drawImpl(ctx, isHovered, hitTestData);	// 前景繪圖，待實作
		// 恢復到上次儲存前的狀態
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

	// 前景繪圖，等待子類別實作
	protected abstract _drawImpl(ctx: CanvasRenderingContext2D, isHovered: boolean, hitTestData?: unknown): void;

	// 背景繪圖，預設為不動作，或者子類別可覆蓋行為
	protected _drawBackgroundImpl(ctx: CanvasRenderingContext2D, isHovered: boolean, hitTestData?: unknown): void {}
}
