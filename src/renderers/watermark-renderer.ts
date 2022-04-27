import { ScaledRenderer } from './scaled-renderer';

export interface WatermarkRendererLineData {
	text: string;
	font: string;
	lineHeight: number;
	vertOffset: number;
	zoom: number;
}

/**
 * Represents a horizontal alignment.
 */
export type HorzAlign = 'left' | 'center' | 'right';
/**
 * Represents a vertical alignment.
 */
export type VertAlign = 'top' | 'center' | 'bottom';

// options中，watermark的可自定義的部份選項，實際選項為options/watermark-options-defaults.ts中
export interface WatermarkRendererData {
	lines: WatermarkRendererLineData[];
	color: string;
	height: number;
	width: number;
	visible: boolean;
	horzAlign: HorzAlign;
	vertAlign: VertAlign;
}

export class WatermarkRenderer extends ScaledRenderer {
	/**
	 *  draw, drawBackground使用繼承自scaledRender的方法
	 */
	private readonly _data: WatermarkRendererData;	// 由ctor設值
	//  (font, font_cache(text, ctx.width))
	private _metricsCache: Map<string, Map<string, number>> = new Map();

	public constructor(data: WatermarkRendererData) {
		/**
		 * WatermarkPaneView建構時呼叫, data為預設值，可由使用者自訂的options更新
		 */
		super();
		this._data = data;
	}

	// 前景繪圖，不動作
	protected _drawImpl(ctx: CanvasRenderingContext2D): void {}

	// 背景繪圖，覆蓋行為
	protected override _drawBackgroundImpl(ctx: CanvasRenderingContext2D): void {
		// 浮水印不可見時直接返回
		if (!this._data.visible) {
			return;
		}
		// 儲存 canvas 全部狀態
		ctx.save();

		let textHeight = 0;
		for (const line of this._data.lines) {
			// text為watermark的內容，如果沒有文字時直接結束
			if (line.text.length === 0) {
				continue;
			}

			ctx.font = line.font;	// 設定字型
			const textWidth = this._metrics(ctx, line.text); // ctx text width
			// 調節縮放比例，由text width與data width決定
			if (textWidth > this._data.width) {
				line.zoom = this._data.width / textWidth;
			} else {
				line.zoom = 1;
			}

			textHeight += line.lineHeight * line.zoom;
		}

		// 垂直位置計算，由上方計算offset
		let vertOffset = 0;
		switch (this._data.vertAlign) {
			case 'top':
				// top時的offset為0
				vertOffset = 0;
				break;

			case 'center':
				vertOffset = Math.max((this._data.height - textHeight) / 2, 0);
				break;

			case 'bottom':
				vertOffset = Math.max((this._data.height - textHeight), 0);
				break;
		}

		ctx.fillStyle = this._data.color;
		// 水平位置計算
		for (const line of this._data.lines) {
			ctx.save();

			let horzOffset = 0;
			switch (this._data.horzAlign) {
				case 'left':
					ctx.textAlign = 'left';
					horzOffset = line.lineHeight / 2;
					break;

				case 'center':
					ctx.textAlign = 'center';
					horzOffset = this._data.width / 2;
					break;

				case 'right':
					ctx.textAlign = 'right';
					horzOffset = this._data.width - 1 - line.lineHeight / 2;
					break;
			}

			// 對當前網格新增平移變換的方法(決定新的座標0點)
			// https://developer.mozilla.org/zh-CN/docs/Web/API/CanvasRenderingContext2D/translate
			ctx.translate(horzOffset, vertOffset);
			// Canvas 2D API 描述繪制文字時，當前文字基線的屬性。top是文字基線在文字塊的頂部。
			// https://developer.mozilla.org/zh-CN/docs/Web/API/CanvasRenderingContext2D/textBaseline
			ctx.textBaseline = 'top';
			// 字型
			// https://developer.mozilla.org/zh-CN/docs/Web/API/CanvasRenderingContext2D/font
			ctx.font = line.font;
			//  Canvas 2D API 根據 x 水平方向和 y 垂直方向，為canvas 單位新增縮放變換的方法。
			// https://developer.mozilla.org/zh-CN/docs/Web/API/CanvasRenderingContext2D/scale
			ctx.scale(line.zoom, line.zoom);
			// Canvas 2D API 在 (x, y)位置填充文字的方法。如果選項的第四個參數提供了最大寬度，文字會進行縮放以適應最大寬度。
			// https://developer.mozilla.org/zh-CN/docs/Web/API/CanvasRenderingContext2D/fillText
			ctx.fillText(line.text, 0, line.vertOffset);
			ctx.restore();
			vertOffset += line.lineHeight * line.zoom;
		}

		ctx.restore();
	}

	private _metrics(ctx: CanvasRenderingContext2D, text: string): number {
		/* text為watermark要顯示的文字 */
		const fontCache = this._fontCache(ctx.font);
		let result = fontCache.get(text);
		if (result === undefined) {
			// 返回一個關於被測量文字TextMetrics 對象包含的資訊（例如它的寬度）
			// https://developer.mozilla.org/zh-CN/docs/Web/API/CanvasRenderingContext2D/measureText
			result = ctx.measureText(text).width;
			fontCache.set(text, result);	// 文字，寬度
		}

		return result;
	}

	private _fontCache(font: string): Map<string, number> {
		let fontCache = this._metricsCache.get(font);
		if (fontCache === undefined) {
			fontCache = new Map();
			this._metricsCache.set(font, fontCache);
		}

		return fontCache;
	}
}
