import { ensureNotNull } from '../helpers/assertions';

import { PriceMark } from '../model/price-scale';

import { LineStyle, setLineStyle, strokeInPixel } from './draw-line';
import { IPaneRenderer } from './ipane-renderer';

export interface GridMarks {
	coord: number;
}
export interface GridRendererData {
	vertLinesVisible: boolean;	// 垂直線是否可見
	vertLinesColor: string;		// 垂直線的顏色
	vertLineStyle: LineStyle;	// 垂直線的格式
	timeMarks: GridMarks[];

	horzLinesVisible: boolean;	// 水平線是否可見
	horzLinesColor: string;		// 水平線的顏色
	horzLineStyle: LineStyle;	// 水平線的格式
	priceMarks: PriceMark[];

	h: number;
	w: number;
}

export class GridRenderer implements IPaneRenderer {
	private _data: GridRendererData | null = null;

	public setData(data: GridRendererData | null): void {
		this._data = data;
	}

	public draw(ctx: CanvasRenderingContext2D, pixelRatio: number, isHovered: boolean, hitTestData?: unknown): void {
		if (this._data === null) {
			return;
		}

		const lineWidth = Math.max(1, Math.floor(pixelRatio));
		ctx.lineWidth = lineWidth;

		const height = Math.ceil(this._data.h * pixelRatio);
		const width = Math.ceil(this._data.w * pixelRatio);

		strokeInPixel(ctx, () => {
			const data = ensureNotNull(this._data);
			if (data.vertLinesVisible) {
				ctx.strokeStyle = data.vertLinesColor;
				setLineStyle(ctx, data.vertLineStyle);
				ctx.beginPath();
				for (const timeMark of data.timeMarks) {
					const x = Math.round(timeMark.coord * pixelRatio);
					ctx.moveTo(x, -lineWidth);
					ctx.lineTo(x, height + lineWidth);
				}
				ctx.stroke();
			}
			if (data.horzLinesVisible) {
				ctx.strokeStyle = data.horzLinesColor;
				setLineStyle(ctx, data.horzLineStyle);
				ctx.beginPath();
				for (const priceMark of data.priceMarks) {
					const y = Math.round(priceMark.coord * pixelRatio);
					ctx.moveTo(-lineWidth, y);
					ctx.lineTo(width + lineWidth, y);
				}
				ctx.stroke();
			}
		});
	}
}
