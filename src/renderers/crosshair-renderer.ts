import { drawHorizontalLine, drawVerticalLine, LineStyle, LineWidth, setLineStyle } from './draw-line';
import { IPaneRenderer } from './ipane-renderer';

export interface CrosshairLineStyle {
	lineStyle: LineStyle;	// 直線格式
	lineWidth: LineWidth;	// 直線寬度
	color: string;			// 線條顏色
	visible: boolean;		// 是否可見
}

export interface CrosshairRendererData {
	vertLine: CrosshairLineStyle;	// 垂直線的格式
	horzLine: CrosshairLineStyle;	// 水平線的格式
	x: number;	// x軸座標
	y: number;	// x軸座標
	w: number;
	h: number;
}

export class CrosshairRenderer implements IPaneRenderer {
	private readonly _data: CrosshairRendererData | null;

	public constructor(data: CrosshairRendererData | null) {
		this._data = data;
	}

	public draw(ctx: CanvasRenderingContext2D, pixelRatio: number, isHovered: boolean, hitTestData?: unknown): void {
		if (this._data === null) {
			return;
		}

		const vertLinesVisible = this._data.vertLine.visible;
		const horzLinesVisible = this._data.horzLine.visible;

		if (!vertLinesVisible && !horzLinesVisible) {
			return;
		}

		ctx.save();

		const x = Math.round(this._data.x * pixelRatio);
		const y = Math.round(this._data.y * pixelRatio);
		const w = Math.ceil(this._data.w * pixelRatio);
		const h = Math.ceil(this._data.h * pixelRatio);

		ctx.lineCap = 'butt';

		if (vertLinesVisible && x >= 0) {
			ctx.lineWidth = Math.floor(this._data.vertLine.lineWidth * pixelRatio);
			ctx.strokeStyle = this._data.vertLine.color;
			ctx.fillStyle = this._data.vertLine.color;
			setLineStyle(ctx, this._data.vertLine.lineStyle);
			drawVerticalLine(ctx, x, 0, h);
		}

		if (horzLinesVisible && y >= 0) {
			ctx.lineWidth = Math.floor(this._data.horzLine.lineWidth * pixelRatio);
			ctx.strokeStyle = this._data.horzLine.color;
			ctx.fillStyle = this._data.horzLine.color;
			setLineStyle(ctx, this._data.horzLine.lineStyle);
			drawHorizontalLine(ctx, y, 0, w);
		}

		ctx.restore();
	}
}
