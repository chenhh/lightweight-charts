import { makeFont } from '../../helpers/make-font';

import { Watermark } from '../../model/watermark';
import { IPaneRenderer } from '../../renderers/ipane-renderer';
import { WatermarkRenderer, WatermarkRendererData } from '../../renderers/watermark-renderer';

import { IUpdatablePaneView } from './iupdatable-pane-view';

export class WatermarkPaneView implements IUpdatablePaneView {
	/**
	 *  watermark的繪圖的部份, 在Watermark class建立時同時建立
	 */
	private _source: Watermark;
	private _invalidated: boolean = true;

	// render的預設值
	private readonly _rendererData: WatermarkRendererData = {
		visible: false,
		color: '',
		height: 0,
		width: 0,
		lines: [],
		vertAlign: 'center',
		horzAlign: 'center',
	};
	// 實際的watermark繪圖物件
	private readonly _renderer: WatermarkRenderer = new WatermarkRenderer(this._rendererData);

	public constructor(source: Watermark) {
		this._source = source;	// 指向建構的watermark實例
	}

	public update(): void {
		// 在watermark呼叫updateAllViews()時，才會呼叫update
		// 因為所有的View都更新，watermark view也須更新，因此invalidate為true
		this._invalidated = true;
	}

	public renderer(height: number, width: number): IPaneRenderer {
		// 只有在invalidated為true更才需要重新繪製
		if (this._invalidated) {
			this._updateImpl(height, width);
			this._invalidated = false;
		}

		return this._renderer;
	}

	private _updateImpl(height: number, width: number): void {
		const options = this._source.options();
		const data = this._rendererData;
		data.visible = options.visible;

		if (!data.visible) {
			return;
		}

		// render data由options更新
		data.color = options.color;
		data.width = width;
		data.height = height;
		data.horzAlign = options.horzAlign;
		data.vertAlign = options.vertAlign;

		data.lines = [
			{
				text: options.text,
				font: makeFont(options.fontSize, options.fontFamily, options.fontStyle),
				lineHeight: options.fontSize * 1.2,
				vertOffset: 0,
				zoom: 0,
			},
		];
	}
}
