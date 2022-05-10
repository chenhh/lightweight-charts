import { ensureDefined, ensureNotNull } from '../helpers/assertions';
import { drawScaled } from '../helpers/canvas-helpers';
import { Delegate } from '../helpers/delegate';
import { IDestroyable } from '../helpers/idestroyable';
import { ISubscription } from '../helpers/isubscription';
import { DeepPartial } from '../helpers/strict-type-checks';

import { ChartModel, ChartOptionsInternal } from '../model/chart-model';
import { Coordinate } from '../model/coordinate';
import { DefaultPriceScaleId } from '../model/default-price-scale';
import {
	InvalidateMask,
	InvalidationLevel,
	TimeScaleInvalidation,
	TimeScaleInvalidationType,
} from '../model/invalidate-mask';
import { Point } from '../model/point';
import { Series } from '../model/series';
import { SeriesPlotRow } from '../model/series-data';
import { OriginalTime, TimePointIndex } from '../model/time-data';

import { createPreconfiguredCanvas, getCanvasDevicePixelRatio, getContext2D, Size } from './canvas-utils';
// import { PaneSeparator, SEPARATOR_HEIGHT } from './pane-separator';
import { PaneWidget } from './pane-widget';
import { TimeAxisWidget } from './time-axis-widget';

export interface MouseEventParamsImpl {
	time?: OriginalTime;
	index?: TimePointIndex;
	point?: Point;
	seriesData: Map<Series, SeriesPlotRow>;
	hoveredSeries?: Series;
	hoveredObject?: string;
}

export type MouseEventParamsImplSupplier = () => MouseEventParamsImpl;

export class ChartWidget implements IDestroyable {
	/**
	 * 主要的圖表組件, 包含了:
	 * 	- 主要圖表(ChartModel)，
	 *  - 左(右)側的y軸
	 *  - 時間軸(TimeAxisWidget)
	 *  的組件們, 負責外層的html排版
	 *
	 *  只有在網頁的script上建構圖表，之後圖表的行為都是依使用者操作的事件驅動

	 */
	private readonly _options: ChartOptionsInternal; // 繪圖選項, 由chart-api物件傳入
	private _paneWidgets: PaneWidget[] = [];	// pane widgets array, 排版的組件
	// private _paneSeparators: PaneSeparator[] = [];
	private readonly _model: ChartModel;	// 主要的繪圖模型
	private _drawRafId: number = 0;
	private _height: number = 0;	// chart組件的高度
	private _width: number = 0;		// chart組件的寬度
	private _leftPriceAxisWidth: number = 0;	// 左側y軸的寬度
	private _rightPriceAxisWidth: number = 0;	// 右側y軸的寬度
	private _element: HTMLElement;	// chart組件的根元素
	private readonly _tableElement: HTMLElement; // tableElement是element中的排版方法
	private _timeAxisWidget: TimeAxisWidget;	// 時間軸組件
	private _invalidateMask: InvalidateMask | null = null;	// 指定失效的組件，只更新失效部份的內容
	private _drawPlanned: boolean = false;
	private _clicked: Delegate<MouseEventParamsImplSupplier> = new Delegate();	// 滑鼠點擊事件處理
	private _crosshairMoved: Delegate<MouseEventParamsImplSupplier> = new Delegate();	// 滑鼠在圖上的十字線事件
	private _onWheelBound: (event: WheelEvent) => void;	// 滑鼠滾輪的事件函數指標

	public constructor(container: HTMLElement, options: ChartOptionsInternal) {
		/*
		 * 組件的建構函數
		 * 最外層是使用者自訂的container，通常是div, overflow:hidden; 自動隱藏超出的文字或圖片。
		 * 第二層是此處建立的div, class為tv-lightweight-charts
		 * 第三層是table，cellspacing為0
		 * table內有兩列, padding均為0px
		 * 	第一列是left price axis, main chart(內有一層div中與多層canvas), right price axis
		 * 	第二列是空白, time axis (canvas), 空白
		 *
		 * widget處理外層的html tag
		 * chartWidget處理最外層的div與table的css屬性和event handing。
		 * 如Pane widget[]處理第一列的left price axis, chart, right price axis的html與css屬性和event handing。
		 * 而TimeAxisWidget處理第二列的time axis的html與css屬性和event handing。
		 *    - 時間內容由model->time-scale處理。
		 *
		 *    *---------------------------------------------------*
		 *    | div, class=tv-lightweight-charts                  |
		 *    *---------------------------------------------------*
		 *    | table                                             |
		 *    *---------------------------------------------------*
		 * 	  |<tr> pane widgets (由ChartModel生成至Pane widget[]) |
		 *	  *---------------------------------------------------*
		 *	  |<tr> time-axis-widget                              |
		 *    *---------------------------------------------------*
		 */
		// 圖表的設定值, 預設值為ChartOptionsInternal
		this._options = options;
		console.log("create chart widget div");
		// container通常是(outer) div，而此處的div是container內再一層(inner)div
		// 設定圖表的html element為div, 且指定div的class與css屬性
		this._element = document.createElement('div');
		this._element.classList.add('tv-lightweight-charts');
		this._element.style.overflow = 'hidden';	// overflow: hidden, 自動隱藏超出的文字或圖片
		this._element.style.width = '100%';
		this._element.style.height = '100%';
		// 禁止element被反白選中
		disableSelection(this._element);	// user-select: none

		// 設定表格的html element與css屬性
		console.log("create chart widget table");
		this._tableElement = document.createElement('table');
		// 表格欄位間用cellspacing 屬性(px)指定距離
		this._tableElement.setAttribute('cellspacing', '0');
		// 在top inner div後增加table
		this._element.appendChild(this._tableElement);

		// 設定滑鼠滾輪的事件處理函數，從class method變為function
		this._onWheelBound = this._onMousewheel.bind(this);
		// option passive,用途是告訴瀏覽器，這個事件 handler function 會不會呼叫event.preventDefault來停止瀏覽器的原生行為
		// 就是如果你是 scroll event，以前會因為瀏覽器要判斷會不會被preventDefault，所以讓 scroll 的效能變差，
		// 加上這個選項可以直接告訴瀏覽器說沒有要 preventDefault 後，原生的事件行為就可以不管 event handler 直接處理了
		this._element.addEventListener('wheel', this._onWheelBound, {passive: false});

		// chart model物件, 主要的繪圖內容, 放在table的第一列
		// model先建立panes[]後，再synGuiWithModel再用panes[]建立paneWidgets[]
		this._model = new ChartModel(
			this._invalidateHandler.bind(this),
			this._options
		);
		// Chart model的crosshairMoved的事件處理綁定到chart widget與method
		this.model().crosshairMoved().subscribe(this._onPaneWidgetCrosshairMoved.bind(this), this);

		// 圖表的時間軸(x軸)組件
		this._timeAxisWidget = new TimeAxisWidget(this);
		// 將timeAxis置於table中的第二列
		const taElement = this._timeAxisWidget.getElement()
		taElement.setAttribute("id", "timeAxisWidget");
		this._tableElement.appendChild(taElement);
		// this._tableElement.appendChild(this._timeAxisWidget.getElement());

		// 從options中讀取圖表的寬度與高度
		let width = this._options.width;
		let height = this._options.height;

		if (width === 0 || height === 0) {
			// https://developer.mozilla.org/zh-CN/docs/Web/API/Element/getBoundingClientRect
			// 方法返回元素的大小及其相對於視口的位置, 返回值是一個 DOMRect 物件
			const containerRect = container.getBoundingClientRect();
			// TODO: Fix it better
			// on Hi-DPI CSS size * Device Pixel Ratio should be integer to avoid smoothing
			// For chart widget we decreases because we must be inside container.
			// For time axis this is not important, since it just affects space for pane widgets
			if (width === 0) {
				width = Math.floor(containerRect.width);
				width -= width % 2;
			}

			if (height === 0) {
				height = Math.floor(containerRect.height);
				height -= height % 2;
			}
		}

		// BEWARE: resize must be called BEFORE _syncGuiWithModel (in constructor only)
		// or after but with adjustSize to properly update time scale
		// 設定table的大小, 且重新繪圖
		this.resize(width, height);

		// 在此處才插入table第一列的pane widget
		this._syncGuiWithModel();

		// 將建立好的圖表放入使用者指定的container內
		container.appendChild(this._element);
		// 由option中讀取時間是否可見, 預設只能看到日期
		this._updateTimeAxisVisibility();
		// 綁定事件處理, chart model的time scale optionapplied事件綁定model的full update與chart widget物件
		this._model.timeScale().optionsApplied().subscribe(this._model.fullUpdate.bind(this._model), this);
		// 綁定事件處理, chart model的price scale option changed事件綁定model的full update與chart widget物件
		this._model.priceScalesOptionsChanged().subscribe(this._model.fullUpdate.bind(this._model), this);
	}	// end of constructor

	public model(): ChartModel {
		/* model getter，可用於做chain method call */
		return this._model;
	}

	public options(): Readonly<ChartOptionsInternal> {
		/* options getter，可用於做chain method call */
		return this._options;
	}

	public paneWidgets(): PaneWidget[] {
		/* panel widget getter */
		return this._paneWidgets;
	}

	public timeAxisWidget(): TimeAxisWidget {
		/* time axis widget getter */
		return this._timeAxisWidget;
	}

	public destroy(): void {
		/* 清除所有的繪圖元件與event listener */
		// 取消滑鼠滾輪事件
		this._element.removeEventListener('wheel', this._onWheelBound);
		// 取消動畫事件
		if (this._drawRafId !== 0) {
			window.cancelAnimationFrame(this._drawRafId);
		}
		// 取消滑鼠十字線事件
		this._model.crosshairMoved().unsubscribeAll(this);
		// 取消時間軸(x軸)事件
		this._model.timeScale().optionsApplied().unsubscribeAll(this);
		// 取消價格軸(y軸, 左或右方)事件
		this._model.priceScalesOptionsChanged().unsubscribeAll(this);
		// 清除model
		this._model.destroy();

		// pane widget是table element中的widget
		for (const paneWidget of this._paneWidgets) {
			this._tableElement.removeChild(paneWidget.getElement());
			paneWidget.clicked().unsubscribeAll(this);
			paneWidget.destroy();
		}
		this._paneWidgets = [];

		// for (const paneSeparator of this._paneSeparators) {
		// 	this._destroySeparator(paneSeparator);
		// }
		// this._paneSeparators = [];

		// 清除time axis widget
		ensureNotNull(this._timeAxisWidget).destroy();

		if (this._element.parentElement !== null) {
			this._element.parentElement.removeChild(this._element);
		}
		// 滑鼠十字線
		this._crosshairMoved.destroy();
		this._clicked.destroy();
	}

	public resize(width: number, height: number, forceRepaint: boolean = false): void {
		/**
		 * 圖表大小有變動時，重新繪圖
		 */
		if (this._height === height && this._width === width) {
			return;
		}

		this._height = height;
		this._width = width;

		const heightStr = height + 'px';
		const widthStr = width + 'px';

		ensureNotNull(this._element).style.height = heightStr;
		ensureNotNull(this._element).style.width = widthStr;

		this._tableElement.style.height = heightStr;
		this._tableElement.style.width = widthStr;

		if (forceRepaint) {
			// 強制重新繪圖, 因為要全部重繪，所以InvalidateMask的level為full
			this._drawImpl(new InvalidateMask(InvalidationLevel.Full));
		} else {
			// 單純更新模型內容
			this._model.fullUpdate();
		}
	}

	public paint(invalidateMask?: InvalidateMask): void {
		/** 繪制chart widget中的組件
		 * 需要繪制的部份為PaneWidget與timeAxisWidget
		 */
		// 預設invalidate Mask level為full
		if (invalidateMask === undefined) {
			invalidateMask = new InvalidateMask(InvalidationLevel.Full);
		}

		// for all pane widgets in the array, 依level繪制組件
		for (let i = 0; i < this._paneWidgets.length; i++) {
			this._paneWidgets[i].paint(invalidateMask.invalidateForPane(i).level);
		}

		// 只有在時間選項為可見時才繪製時間軸
		if (this._options.timeScale.visible) {
			this._timeAxisWidget.paint(invalidateMask.fullInvalidation());
		}
	}

	public applyOptions(options: DeepPartial<ChartOptionsInternal>): void {
		// we don't need to merge options here because it's done in chart model
		// and since both model and widget share the same object it will be done automatically for widget as well
		// not ideal solution for sure, but it work's for now ¯\_(ツ)_/¯
		this._model.applyOptions(options);
		this._updateTimeAxisVisibility();

		const width = options.width || this._width;
		const height = options.height || this._height;

		this.resize(width, height);
	}

	public clicked(): ISubscription<MouseEventParamsImplSupplier> {
		// 回傳Delegate<MouseEventParamsImplSupplier>物件，由chart api中的ctor對應callback function
		return this._clicked;
	}

	public crosshairMoved(): ISubscription<MouseEventParamsImplSupplier> {
		// 回傳Delegate<MouseEventParamsImplSupplier>物件，由chart api中的ctor對應callback function
		return this._crosshairMoved;
	}

	public takeScreenshot(): HTMLCanvasElement {
		if (this._invalidateMask !== null) {
			this._drawImpl(this._invalidateMask);
			this._invalidateMask = null;
		}
		// calculate target size
		const firstPane = this._paneWidgets[0];
		const targetCanvas = createPreconfiguredCanvas(document, new Size(this._width, this._height));
		const ctx = getContext2D(targetCanvas);
		const pixelRatio = getCanvasDevicePixelRatio(targetCanvas);
		drawScaled(ctx, pixelRatio, () => {
			let targetX = 0;
			let targetY = 0;

			const drawPriceAxises = (position: 'left' | 'right') => {
				for (let paneIndex = 0; paneIndex < this._paneWidgets.length; paneIndex++) {
					const paneWidget = this._paneWidgets[paneIndex];
					const paneWidgetHeight = paneWidget.getSize().h;
					const priceAxisWidget = ensureNotNull(position === 'left' ? paneWidget.leftPriceAxisWidget() : paneWidget.rightPriceAxisWidget());
					const image = priceAxisWidget.getImage();
					ctx.drawImage(image, targetX, targetY, priceAxisWidget.getWidth(), paneWidgetHeight);
					targetY += paneWidgetHeight;
					// if (paneIndex < this._paneWidgets.length - 1) {
					// 	const separator = this._paneSeparators[paneIndex];
					// 	const separatorSize = separator.getSize();
					// 	const separatorImage = separator.getImage();
					// 	ctx.drawImage(separatorImage, targetX, targetY, separatorSize.w, separatorSize.h);
					// 	targetY += separatorSize.h;
					// }
				}
			};
			// draw left price scale if exists
			if (this._isLeftAxisVisible()) {
				drawPriceAxises('left');
				targetX = ensureNotNull(firstPane.leftPriceAxisWidget()).getWidth();
			}
			targetY = 0;
			for (let paneIndex = 0; paneIndex < this._paneWidgets.length; paneIndex++) {
				const paneWidget = this._paneWidgets[paneIndex];
				const paneWidgetSize = paneWidget.getSize();
				const image = paneWidget.getImage();
				ctx.drawImage(image, targetX, targetY, paneWidgetSize.w, paneWidgetSize.h);
				targetY += paneWidgetSize.h;
				// if (paneIndex < this._paneWidgets.length - 1) {
				// 	const separator = this._paneSeparators[paneIndex];
				// 	const separatorSize = separator.getSize();
				// 	const separatorImage = separator.getImage();
				// 	ctx.drawImage(separatorImage, targetX, targetY, separatorSize.w, separatorSize.h);
				// 	targetY += separatorSize.h;
				// }
			}
			targetX += firstPane.getSize().w;
			if (this._isRightAxisVisible()) {
				targetY = 0;
				drawPriceAxises('right');
			}
			const drawStub = (position: 'left' | 'right') => {
				const stub = ensureNotNull(position === 'left' ? this._timeAxisWidget.leftStub() : this._timeAxisWidget.rightStub());
				const size = stub.getSize();
				const image = stub.getImage();
				ctx.drawImage(image, targetX, targetY, size.w, size.h);
			};
			// draw time scale
			if (this._options.timeScale.visible) {
				targetX = 0;
				if (this._isLeftAxisVisible()) {
					drawStub('left');
					targetX = ensureNotNull(firstPane.leftPriceAxisWidget()).getWidth();
				}
				const size = this._timeAxisWidget.getSize();
				const image = this._timeAxisWidget.getImage();
				ctx.drawImage(image, targetX, targetY, size.w, size.h);
				if (this._isRightAxisVisible()) {
					targetX += firstPane.getSize().w;
					drawStub('right');
					ctx.restore();
				}
			}
		});
		return targetCanvas;
	}

	public getPriceAxisWidth(position: DefaultPriceScaleId): number {
		if (position === 'left' && !this._isLeftAxisVisible()) {
			return 0;
		}

		if (position === 'right' && !this._isRightAxisVisible()) {
			return 0;
		}

		if (this._paneWidgets.length === 0) {
			return 0;
		}

		// we don't need to worry about exactly pane widget here
		// because all pane widgets have the same width of price axis widget
		// see _adjustSizeImpl
		const priceAxisWidget = position === 'left'
			? this._paneWidgets[0].leftPriceAxisWidget()
			: this._paneWidgets[0].rightPriceAxisWidget();
		return ensureNotNull(priceAxisWidget).getWidth();
	}

	// eslint-disable-next-line complexity
	private _adjustSizeImpl(): void {
		/**
		 * 在sycGuiWithModel()最後呼叫此函數
		 * 調整所有可視元件的尺寸
		 */
		let totalStretch = 0;
		let leftPriceAxisWidth = 0;
		let rightPriceAxisWidth = 0;

		for (const paneWidget of this._paneWidgets) {
			if (this._isLeftAxisVisible()) {
				leftPriceAxisWidth = Math.max(leftPriceAxisWidth, ensureNotNull(paneWidget.leftPriceAxisWidget()).optimalWidth());
			}
			if (this._isRightAxisVisible()) {
				rightPriceAxisWidth = Math.max(rightPriceAxisWidth, ensureNotNull(paneWidget.rightPriceAxisWidget()).optimalWidth());
			}

			totalStretch += paneWidget.stretchFactor();
		}

		const width = this._width;
		const height = this._height;

		const paneWidth = Math.max(width - leftPriceAxisWidth - rightPriceAxisWidth, 0);

		// const separatorCount = this._paneSeparators.length;
		// const separatorHeight = SEPARATOR_HEIGHT;
		const separatorsHeight = 0; // separatorHeight * separatorCount;
		const timeAxisVisible = this._options.timeScale.visible;
		let timeAxisHeight = timeAxisVisible ? this._timeAxisWidget.optimalHeight() : 0;
		// TODO: Fix it better
		// on Hi-DPI CSS size * Device Pixel Ratio should be integer to avoid smoothing
		if (timeAxisHeight % 2) {
			timeAxisHeight += 1;
		}
		const otherWidgetHeight = separatorsHeight + timeAxisHeight;
		const totalPaneHeight = height < otherWidgetHeight ? 0 : height - otherWidgetHeight;
		const stretchPixels = totalPaneHeight / totalStretch;

		let accumulatedHeight = 0;
		for (let paneIndex = 0; paneIndex < this._paneWidgets.length; ++paneIndex) {
			const paneWidget = this._paneWidgets[paneIndex];
			paneWidget.setState(this._model.panes()[paneIndex]);

			let paneHeight = 0;
			let calculatePaneHeight = 0;

			if (paneIndex === this._paneWidgets.length - 1) {
				calculatePaneHeight = totalPaneHeight - accumulatedHeight;
			} else {
				calculatePaneHeight = Math.round(paneWidget.stretchFactor() * stretchPixels);
			}

			paneHeight = Math.max(calculatePaneHeight, 2);

			accumulatedHeight += paneHeight;

			paneWidget.setSize(new Size(paneWidth, paneHeight));
			if (this._isLeftAxisVisible()) {
				paneWidget.setPriceAxisSize(leftPriceAxisWidth, 'left');
			}
			if (this._isRightAxisVisible()) {
				paneWidget.setPriceAxisSize(rightPriceAxisWidth, 'right');
			}

			if (paneWidget.state()) {
				this._model.setPaneHeight(paneWidget.state(), paneHeight);
			}
		}

		this._timeAxisWidget.setSizes(
			new Size(timeAxisVisible ? paneWidth : 0, timeAxisHeight),
			timeAxisVisible ? leftPriceAxisWidth : 0,
			timeAxisVisible ? rightPriceAxisWidth : 0
		);

		this._model.setWidth(paneWidth);
		if (this._leftPriceAxisWidth !== leftPriceAxisWidth) {
			this._leftPriceAxisWidth = leftPriceAxisWidth;
		}
		if (this._rightPriceAxisWidth !== rightPriceAxisWidth) {
			this._rightPriceAxisWidth = rightPriceAxisWidth;
		}
	}

	private _onMousewheel(event: WheelEvent): void {
		/**
		 * 滑鼠滾輪事件的處理函數, 在ctor中綁定wheel事件處理
		 */
		let deltaX = event.deltaX / 100;
		let deltaY = -(event.deltaY / 100);

		if ((deltaX === 0 || !this._options.handleScroll.mouseWheel) &&
			(deltaY === 0 || !this._options.handleScale.mouseWheel)) {
			return;
		}

		if (event.cancelable) {
			event.preventDefault();
		}

		switch (event.deltaMode) {
			case event.DOM_DELTA_PAGE:
				// one screen at time scroll mode
				deltaX *= 120;
				deltaY *= 120;
				break;

			case event.DOM_DELTA_LINE:
				// one line at time scroll mode
				deltaX *= 32;
				deltaY *= 32;
				break;
		}

		if (deltaY !== 0 && this._options.handleScale.mouseWheel) {
			const zoomScale = Math.sign(deltaY) * Math.min(1, Math.abs(deltaY));
			const scrollPosition = event.clientX - this._element.getBoundingClientRect().left;
			this.model().zoomTime(scrollPosition as Coordinate, zoomScale);
		}

		if (deltaX !== 0 && this._options.handleScroll.mouseWheel) {
			this.model().scrollChart(deltaX * -80 as Coordinate); // 80 is a made up coefficient, and minus is for the "natural" scroll
		}
	}

	private _drawImpl(invalidateMask: InvalidateMask): void {
		/**
		 * 由chart model的createPane() -> this._invalidateHandler() -> _drawImpl()
		 * 重新繪製圖形, 依指定的invalidateMask決定須要繪製的組件
		 * 在createPane()中設定mask的level為full, pane的level為none, autoscale=true
		 * 有四個Level None = 0, Cursor = 1, Light = 2, Full = 3,
		 */
			// 取mask的global invalidationLevel之值
		const invalidationType = invalidateMask.fullInvalidation();

		// actions for full invalidation ONLY (not shared with light)
		// full時，更新整個gui
		if (invalidationType === InvalidationLevel.Full) {
			this._updateGui();
		}

		// light or full invalidate actions
		// full或light時要執行的操作
		if (
			invalidationType === InvalidationLevel.Full ||
			invalidationType === InvalidationLevel.Light
		) {
			this._applyMomentaryAutoScale(invalidateMask);
			this._applyTimeScaleInvalidations(invalidateMask);

			this._timeAxisWidget.update();
			this._paneWidgets.forEach((pane: PaneWidget) => {
				pane.updatePriceAxisWidgets();
			});

			// In the case a full invalidation has been postponed during the draw, reapply
			// the timescale invalidations. A full invalidation would mean there is a change
			// in the timescale width (caused by price scale changes) that needs to be drawn
			// right away to avoid flickering.
			if (this._invalidateMask?.fullInvalidation() === InvalidationLevel.Full) {
				this._invalidateMask.merge(invalidateMask);

				this._updateGui();

				this._applyMomentaryAutoScale(this._invalidateMask);
				this._applyTimeScaleInvalidations(this._invalidateMask);

				invalidateMask = this._invalidateMask;
				this._invalidateMask = null;
			}
		}	// end of full or light level

		// invalid level為none或cursor時，只會呼叫此部份, 而其它level都會呼叫此部份
		this.paint(invalidateMask);
	}

	private _applyTimeScaleInvalidations(invalidateMask: InvalidateMask): void {
		/**
		 * invalidation level為full or light時，在_drawImpl()會呼叫此函數
		 */
		const timeScaleInvalidations = invalidateMask.timeScaleInvalidations();
		for (const tsInvalidation of timeScaleInvalidations) {
			this._applyTimeScaleInvalidation(tsInvalidation);
		}
	}

	private _applyMomentaryAutoScale(invalidateMask: InvalidateMask): void {
		/**
		 * invalidation level為full or light時，在_drawImpl()會呼叫此函數
		 * 將chart model中panes對應的invalidation中, autoscale=true處理
		 */
		const panes = this._model.panes();
		for (let i = 0; i < panes.length; i++) {
			if (invalidateMask.invalidateForPane(i).autoScale) {
				panes[i].momentaryAutoScale();
			}
		}
	}

	private _applyTimeScaleInvalidation(invalidation: TimeScaleInvalidation): void {
		/**
		 * invalidation level為full or light時，在_drawImpl()會呼叫此函數
		 */
		const timeScale = this._model.timeScale();
		switch (invalidation.type) {
			case TimeScaleInvalidationType.FitContent:
				timeScale.fitContent();
				break;
			case TimeScaleInvalidationType.ApplyRange:
				timeScale.setLogicalRange(invalidation.value);
				break;
			case TimeScaleInvalidationType.ApplyBarSpacing:
				timeScale.setBarSpacing(invalidation.value);
				break;
			case TimeScaleInvalidationType.ApplyRightOffset:
				timeScale.setRightOffset(invalidation.value);
				break;
			case TimeScaleInvalidationType.Reset:
				timeScale.restoreDefault();
				break;
		}
	}

	private _invalidateHandler(invalidateMask: InvalidateMask): void {
		/**
		 * 在ctor中，傳入chart model的event function
		 * 因為是以function pointer方式傳入，因此invalidateMask之值是在chart model中決定
		 * 在chart model中的createPane(), 會設定mask的invalidLevel為full, 而pane的level為none, 但autoscale=true
		 */
		// 合併invalidateMask
		if (this._invalidateMask !== null) {
			this._invalidateMask.merge(invalidateMask);
		} else {
			this._invalidateMask = invalidateMask;
		}

		// 在window.requestAnimationFrame後，drawPlanned為設為false
		if (!this._drawPlanned) {
			this._drawPlanned = true;
			// window.requestAnimationFrame()方法通知瀏覽器我們想要產生動畫，
			// 並且要求瀏覽器在下次重繪畫面前呼叫特定函式更新動畫。
			// requestAnimationFrame解決了瀏覽器不知道javascript動畫什麼時候開始、
			// 不知道最佳迴圈間隔時間的問題。它是跟著瀏覽器的繪製走的，
			// 這樣就不會存在過度繪製的問題，動畫不會丟幀。
			this._drawRafId = window.requestAnimationFrame(() => {
				this._drawPlanned = false;
				this._drawRafId = 0;

				if (this._invalidateMask !== null) {
					// 重新設定invalidateMask
					const mask = this._invalidateMask;
					this._invalidateMask = null;
					// 依mask繪圖
					this._drawImpl(mask);
				}
			});
		}
	}

	private _updateGui(): void {
		/**
		 * full invalidation時，更新所有組件
		 */
		this._syncGuiWithModel();
	}

	// private _destroySeparator(separator: PaneSeparator): void {
	// 	this._tableElement.removeChild(separator.getElement());
	// 	separator.destroy();
	// }

	private _syncGuiWithModel(): void {
		/**
		 * full invalidation時，更新所有組件
		 */
			// 讀取由model建立的panes[]
		const panes = this._model.panes();
		// 何時pane widgets的數量會與panes不一致?, length不代表list元素的數量
		const targetPaneWidgetsCount = panes.length;
		const actualPaneWidgetsCount = this._paneWidgets.length;
		console.log(`target pane widget count: ${targetPaneWidgetsCount}, actual pane widget count ${actualPaneWidgetsCount}`);

		// Remove (if needed) pane widgets and separators
		for (let i = targetPaneWidgetsCount; i < actualPaneWidgetsCount; i++) {
			console.log("remove pane widget");
			const paneWidget = ensureDefined(this._paneWidgets.pop());
			this._tableElement.removeChild(paneWidget.getElement());
			paneWidget.clicked().unsubscribeAll(this);
			paneWidget.destroy();

			// const paneSeparator = this._paneSeparators.pop();
			// if (paneSeparator !== undefined) {
			// 	this._destroySeparator(paneSeparator);
			// }
		}

		// Create (if needed) new pane widgets and separators
		for (let i = actualPaneWidgetsCount; i < targetPaneWidgetsCount; i++) {
			console.log("add pane widget");
			const paneWidget = new PaneWidget(this, panes[i]);
			paneWidget.clicked().subscribe(this._onPaneWidgetClicked.bind(this), this);

			this._paneWidgets.push(paneWidget);

			// create and insert separator
			// if (i > 1) {
			// 	const paneSeparator = new PaneSeparator(this, i - 1, i, true);
			// 	this._paneSeparators.push(paneSeparator);
			// 	this._tableElement.insertBefore(paneSeparator.getElement(), this._timeAxisWidget.getElement());
			// }

			// 在time axis widget前插入pane widget
			this._tableElement.insertBefore(paneWidget.getElement(), this._timeAxisWidget.getElement());
		}

		// 更新price axis widget
		for (let i = 0; i < targetPaneWidgetsCount; i++) {
			// pane widget建構時，使用pane做為其state
			const state = panes[i];
			const paneWidget = this._paneWidgets[i];
			if (paneWidget.state() !== state) {
				paneWidget.setState(state);
			} else {
				// 在setState的最後一步也是updatePriceAxisWidgetsStates()
				paneWidget.updatePriceAxisWidgetsStates();
			}
		}
		// 依time scale option設定axis是否可見
		this._updateTimeAxisVisibility();
		// 調整所有可視組件的尺寸
		this._adjustSizeImpl();
	}

	private _getMouseEventParamsImpl(index: TimePointIndex | null, point: Point | null): MouseEventParamsImpl {
		const seriesData = new Map<Series, SeriesPlotRow>();
		if (index !== null) {
			const serieses = this._model.serieses();
			serieses.forEach((s: Series) => {
				// TODO: replace with search left
				const data = s.bars().search(index);
				if (data !== null) {
					seriesData.set(s, data);
				}
			});
		}
		let clientTime: OriginalTime | undefined;
		if (index !== null) {
			const timePoint = this._model.timeScale().indexToTimeScalePoint(index)?.originalTime;
			if (timePoint !== undefined) {
				clientTime = timePoint;
			}
		}

		const hoveredSource = this.model().hoveredSource();

		const hoveredSeries = hoveredSource !== null && hoveredSource.source instanceof Series
			? hoveredSource.source
			: undefined;

		const hoveredObject = hoveredSource !== null && hoveredSource.object !== undefined
			? hoveredSource.object.externalId
			: undefined;

		return {
			time: clientTime,
			index: index ?? undefined,
			point: point ?? undefined,
			hoveredSeries,
			seriesData,
			hoveredObject,
		};
	}

	private _onPaneWidgetClicked(time: TimePointIndex | null, point: Point): void {
		this._clicked.fire(() => this._getMouseEventParamsImpl(time, point));
	}

	private _onPaneWidgetCrosshairMoved(time: TimePointIndex | null, point: Point | null): void {
		this._crosshairMoved.fire(() => this._getMouseEventParamsImpl(time, point));
	}

	private _updateTimeAxisVisibility(): void {
		/**
		 * 在syncGuiWithModel()最後呼叫此函數
		 */
			// 依據time scale option決定time axis是否可見
		const display = this._options.timeScale.visible ? '' : 'none';
		this._timeAxisWidget.getElement().style.display = display;
	}

	private _isLeftAxisVisible(): boolean {
		return this._paneWidgets[0].state().leftPriceScale().options().visible;
	}

	private _isRightAxisVisible(): boolean {
		return this._paneWidgets[0].state().rightPriceScale().options().visible;
	}
}

function disableSelection(element: HTMLElement): void {
	/* 禁止指定的element被反白選中 */
	element.style.userSelect = 'none';
	// eslint-disable-next-line deprecation/deprecation
	element.style.webkitUserSelect = 'none';
	// eslint-disable-next-line @typescript-eslint/no-explicit-any,@typescript-eslint/no-unsafe-member-access
	(element.style as any).msUserSelect = 'none';
	// eslint-disable-next-line @typescript-eslint/no-explicit-any,@typescript-eslint/no-unsafe-member-access
	(element.style as any).MozUserSelect = 'none';

	// eslint-disable-next-line @typescript-eslint/no-explicit-any,@typescript-eslint/no-unsafe-member-access
	(element.style as any).webkitTapHighlightColor = 'transparent';
}
