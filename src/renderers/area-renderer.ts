import {Coordinate} from '../model/coordinate';
import {SeriesItemsIndexesRange} from '../model/time-data';

import {LineStyle, LineType, LineWidth, setLineStyle} from './draw-line';
import {LineItem} from './line-renderer';
import {ScaledRenderer} from './scaled-renderer';
import {walkLine} from './walk-line';

/**
 * LineItem = TimedValue & PricedValue & LinePoint & { color?: string };
 * interface TimedValue {
 * 	time: TimePointIndex; // 名稱為TimePointIndex的名目number類型
 * 	x: Coordinate;
 * }
 * interface PricedValue {
 * 	price: BarPrice;  // 名稱為BarPrice的名目number類型
 * 	y: Coordinate;	  // 名稱為Coordinate的名目number類型
 * }
 * interface LinePoint {
 *	x: Coordinate;
 *  y: Coordinate;
 * }
 */

export interface PaneRendererAreaDataBase {
	items: LineItem[];
	// 線條的格式
	lineType: LineType;
	lineWidth: LineWidth;
	lineStyle: LineStyle;

	bottom: Coordinate;	// 名稱為Coordinate的number
	baseLevelCoordinate: Coordinate;	// price(y軸)的起始座標

	barWidth: number;

	visibleRange: SeriesItemsIndexesRange | null;
}

export abstract class PaneRendererAreaBase<TData extends PaneRendererAreaDataBase> extends ScaledRenderer {
	/***
	 * area plot的abstract base class, 沒有完全實作
	 * draw(), drawBackground(), _drawBackgroundImpl()實作繼承自ScaledRenderer
	 * 限定TData必須有PaneRendererAreaDataBase的所有屬性
	 */

	protected _data: TData | null = null;

	public setData(data: TData): void {
		this._data = data;
	}

	protected _drawImpl(ctx: CanvasRenderingContext2D): void {
		// 前景繪圖，由ScaledRenderer子類別實作
		if (this._data === null || this._data.items.length === 0 || this._data.visibleRange === null) {
			return;
		}
		// 指定如何繪制每一條線段末端的屬性。
		// 有3個可能的值，分別是：butt(方形), round(圓形) and
		// square(線段末端以方形結束，但是增加了一個寬度和線段相同，高度是線段厚度一半的矩形區域。)。默認值是 butt。
		// https://developer.mozilla.org/zh-CN/docs/Web/API/CanvasRenderingContext2D/lineCap
		ctx.lineCap = 'butt';
		// Canvas 2D API 用來設置2個長度不為0的相連部分（線段，圓弧，曲線）如何連接在一起的屬性。
		// 此屬性有3個值： round, bevel and miter。默認值是 miter。
		// https://developer.mozilla.org/zh-CN/docs/Web/API/CanvasRenderingContext2D/lineJoin
		ctx.lineJoin = 'round';
		ctx.lineWidth = this._data.lineWidth;
		setLineStyle(ctx, this._data.lineStyle);

		// walk lines with width=1 to have more accurate gradient's filling
		// lineWidth 是 Canvas 2D API 設置線段厚度的屬性（即線段的寬度）
		// https://developer.mozilla.org/zh-CN/docs/Web/API/CanvasRenderingContext2D/lineWidth
		ctx.lineWidth = 1;

		// 是 Canvas 2D API 通過清空子路徑列表開始一個新路徑的方法。 當你想創建一個新的路徑時，調用此方法。
		// https://developer.mozilla.org/zh-CN/docs/Web/API/CanvasRenderingContext2D/beginPath
		ctx.beginPath();

		if (this._data.items.length === 1) {
			// 只有一筆資料時
			const point = this._data.items[0];
			const halfBarWidth = this._data.barWidth / 2;
			// 將一個新的子路徑的起始點移動到(x，y)坐標的方法。類似將筆抬起來放到(x,y)，不會畫線
			ctx.moveTo(point.x - halfBarWidth, this._data.baseLevelCoordinate);
			// 由moveTo設定的位置或是上一個lineTo為起點，畫直線到lineTo指定的座標
			ctx.lineTo(point.x - halfBarWidth, point.y);
			ctx.lineTo(point.x + halfBarWidth, point.y);
			ctx.lineTo(point.x + halfBarWidth, this._data.baseLevelCoordinate);
		} else {
			// 有多筆資料時
			// 將一個新的子路徑的起始點移動到(x，y)坐標的方法。類似將筆抬起來放到(x,y)，不會畫線
			ctx.moveTo(this._data.items[this._data.visibleRange.from].x, this._data.baseLevelCoordinate);
			ctx.lineTo(this._data.items[this._data.visibleRange.from].x, this._data.items[this._data.visibleRange.from].y);

			walkLine(ctx, this._data.items, this._data.lineType, this._data.visibleRange);

			if (this._data.visibleRange.to > this._data.visibleRange.from) {
				ctx.lineTo(this._data.items[this._data.visibleRange.to - 1].x, this._data.baseLevelCoordinate);
				ctx.lineTo(this._data.items[this._data.visibleRange.from].x, this._data.baseLevelCoordinate);
			}
		}
		// 是 Canvas 2D API 將筆點返回到當前子路徑起始點的方法。它嘗試從當前點到起始點繪制一條直線。
		// 如果圖形已經是封閉的或者只有一個點，那麼此方法不會做任何操作。
		// https://developer.mozilla.org/zh-CN/docs/Web/API/CanvasRenderingContext2D/closePath
		ctx.closePath();

		// fillstyle由子類別實作, 設定填滿圖形時用的顏色.
		// https://developer.mozilla.org/zh-TW/docs/Web/API/Canvas_API/Tutorial/Applying_styles_and_colors
		ctx.fillStyle = this._fillStyle(ctx);

		// 填充當前或已存在的路徑的方法。採取非零環繞("nonzero", 預設)或者奇偶環繞("evenodd")規則。
		// https://developer.mozilla.org/zh-CN/docs/Web/API/CanvasRenderingContext2D/fill
		ctx.fill();
	}

	protected abstract _fillStyle(ctx: CanvasRenderingContext2D): CanvasRenderingContext2D['fillStyle'];
}

export interface PaneRendererAreaData extends PaneRendererAreaDataBase {
	topColor: string;	 // gradient的起始顏色
	bottomColor: string; // gradient的終止顏色
}

export class PaneRendererArea extends PaneRendererAreaBase<PaneRendererAreaData> {
	protected override _fillStyle(ctx: CanvasRenderingContext2D): CanvasRenderingContext2D['fillStyle'] {
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		const data = this._data!;

		// 創建一個沿參數坐標指定的直線的漸變。
		// https://developer.mozilla.org/zh-CN/docs/Web/API/CanvasRenderingContext2D/createLinearGradient
		const gradient = ctx.createLinearGradient(0, 0, 0, data.bottom);

		// https://developer.mozilla.org/zh-CN/docs/Web/API/CanvasGradient
		// 新增一個由偏移(offset)和顏色(color)定義的斷點到漸變中。
		// 如果偏移值不在0到1之間，將拋出INDEX_SIZE_ERR錯誤，
		// 如果顏色值不能被解析為有效的CSS顏色值 <color>，將拋出SYNTAX_ERR錯誤。
		gradient.addColorStop(0, data.topColor);
		gradient.addColorStop(1, data.bottomColor);
		return gradient;
	}
}
