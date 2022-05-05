import {
	ChartWidget,
	MouseEventParamsImpl,
	MouseEventParamsImplSupplier,
} from '../gui/chart-widget';

import {assert, ensureDefined} from '../helpers/assertions';
import {Delegate} from '../helpers/delegate';
import {
	clone,
	DeepPartial,
	isBoolean,
	merge,
} from '../helpers/strict-type-checks';

import {ChartOptions, ChartOptionsInternal} from '../model/chart-model';
import {Series} from '../model/series';
import {SeriesPlotRow} from '../model/series-data';
import {
	AreaSeriesOptions,
	AreaSeriesPartialOptions,
	BarSeriesOptions,
	BarSeriesPartialOptions,
	BaselineSeriesOptions,
	BaselineSeriesPartialOptions,
	CandlestickSeriesOptions,
	CandlestickSeriesPartialOptions,
	fillUpDownCandlesticksColors,
	HistogramSeriesOptions,
	HistogramSeriesPartialOptions,
	LineSeriesOptions,
	LineSeriesPartialOptions,
	precisionByMinMove,
	PriceFormat,
	PriceFormatBuiltIn,
	SeriesType,
} from '../model/series-options';
import {Logical, Time} from '../model/time-data';

import {CandlestickSeriesApi} from './candlestick-series-api';
import {
	DataUpdatesConsumer,
	isFulfilledData,
	SeriesDataItemTypeMap,
} from './data-consumer';
import {DataLayer, DataUpdateResponse, SeriesChanges} from './data-layer';
import {getSeriesDataCreator} from './get-series-data-creator';
import {IChartApi, MouseEventHandler, MouseEventParams} from './ichart-api';
import {IPriceScaleApi} from './iprice-scale-api';
import {ISeriesApi} from './iseries-api';
import {ITimeScaleApi} from './itime-scale-api';
import {chartOptionsDefaults} from './options/chart-options-defaults';
import {
	areaStyleDefaults,
	barStyleDefaults,
	baselineStyleDefaults,
	candlestickStyleDefaults,
	histogramStyleDefaults,
	lineStyleDefaults,
	seriesOptionsDefaults,
} from './options/series-options-defaults';
import {PriceScaleApi} from './price-scale-api';
import {SeriesApi} from './series-api';
import {TimeScaleApi} from './time-scale-api';

function patchPriceFormat(priceFormat?: DeepPartial<PriceFormat>): void {
	/** 修正price format的minMove */
	// 沒有定義或是自定義的price format時直接返回
	if (priceFormat === undefined || priceFormat.type === 'custom') {
		return;
	}
	// 當有定義minMove時且precision沒有定義時，進行修正
	const priceFormatBuiltIn = priceFormat as DeepPartial<PriceFormatBuiltIn>;
	if (priceFormatBuiltIn.minMove !== undefined && priceFormatBuiltIn.precision === undefined) {
		priceFormatBuiltIn.precision = precisionByMinMove(priceFormatBuiltIn.minMove);
	}
}

function migrateHandleScaleScrollOptions(options: DeepPartial<ChartOptions>): void {
	if (isBoolean(options.handleScale)) {
		const handleScale = options.handleScale;
		options.handleScale = {
			axisDoubleClickReset: handleScale,
			axisPressedMouseMove: {
				time: handleScale,
				price: handleScale,
			},
			mouseWheel: handleScale,
			pinch: handleScale,
		};
	} else if (options.handleScale !== undefined && isBoolean(options.handleScale.axisPressedMouseMove)) {
		const axisPressedMouseMove = options.handleScale.axisPressedMouseMove;
		options.handleScale.axisPressedMouseMove = {
			time: axisPressedMouseMove,
			price: axisPressedMouseMove,
		};
	}

	const handleScroll = options.handleScroll;
	if (isBoolean(handleScroll)) {
		options.handleScroll = {
			horzTouchDrag: handleScroll,
			vertTouchDrag: handleScroll,
			mouseWheel: handleScroll,
			pressedMouseMove: handleScroll,
		};
	}
}

function toInternalOptions(options: DeepPartial<ChartOptions>): DeepPartial<ChartOptionsInternal> {
	migrateHandleScaleScrollOptions(options);

	return options as DeepPartial<ChartOptionsInternal>;
}

export type IPriceScaleApiProvider = Pick<IChartApi, 'priceScale'>;

export class ChartApi implements IChartApi, DataUpdatesConsumer<SeriesType> {
	/** 實現了IchartAPI介面，內容為圖表的主要行為, 此為Chart的最頂層物件
	 * 實現了DataUpdatesConsumer<SeriesType>介面，內容為資料更新的主要行為
	 * SeriesType限定義Bar, Candlestick, Area, Baseline, Line, Histogram
	 *
	 * ChartApi object -> ChartWidget object(chart model,time axis, pane objects)...
	 * CharetApi可透過chartwidget object間接操作更底層的object
	 */
	private _chartWidget: ChartWidget;	// 圖表組件, 處理html，內嵌chart model處理繪圖邏輯

	// 資料可以有多層, 建立Chart object後, 使用addXXXSeries在model中加入圖形的選項, 回傳SeriesApi object後，
	// 再使用SeriesApi的setData()新增資料後，再用Chart object的applyNewData()加入真正的資料
	// 會再呼叫this._sendUpdateToChart()後，更新model中所有Pane的繪圖
	private _dataLayer: DataLayer = new DataLayer();

	// 正向與反向記錄Series class與對應的SeriesApi class, 可做快速查詢與反查詢
	// SeriesApi與Series同一類型，在addAreaSeries中被呼叫加入
	private readonly _seriesMap: Map<SeriesApi<SeriesType>, Series> = new Map();
	private readonly _seriesMapReversed: Map<Series, SeriesApi<SeriesType>> = new Map();

	// 滑鼠點擊事件處理, Delegate生成callback functions list, 即點擊後會依序呼叫list中的functions.
	private readonly _clickedDelegate: Delegate<MouseEventParams> = new Delegate();
	// 滑鼠十字線移動事件處理
	private readonly _crosshairMovedDelegate: Delegate<MouseEventParams> = new Delegate();

	// 為何timescale是在chartapi而不是chart widget中處理?,
	// note: 在time widget中的model也有time scale
	// guess: 因為chart model與chart widget中的time axis widget均有time scale, 因此在chart api層一起處理
	private readonly _timeScaleApi: TimeScaleApi;

	public constructor(container: HTMLElement, options?: DeepPartial<ChartOptions>) {
		/** ChartApi的建構函數
		 *
		 * @param container - 建構圖表的html元素
		 * @param options - 圖表的選項
		 */
			// 是否有定義圖表的選項，沒有時使用預設值，有定義時，將自定選項和預設選項合併, 最後的合併選項為internalOptions
		const internalOptions = (options === undefined) ?
			clone(chartOptionsDefaults) :
			merge(clone(chartOptionsDefaults), toInternalOptions(options)) as ChartOptionsInternal;

		// 使用指定的html元素和選項建立圖表組件
		this._chartWidget = new ChartWidget(container, internalOptions);

		// 圖表上按下滑鼠的事件, 實作ISubscription的方法
		this._chartWidget.clicked().subscribe(
			/* 當chart widget上按下滑鼠，且chartapi的click listeners list不為空，
			   則將chart widget上的滑鼠事件轉發給chartapi click listeners list對應的callback functions
			 */
			(paramSupplier: MouseEventParamsImplSupplier) => {
				if (this._clickedDelegate.hasListeners()) {
					this._clickedDelegate.fire(this._convertMouseParams(paramSupplier()));
				}
			},
			this	// linked object
		);
		// 圖表上十字線移動的事件
		this._chartWidget.crosshairMoved().subscribe(
			/* 當chart widget上滑鼠十字線移動，且chartapi的moved listeners list不為空，
			   則將chart widget上的滑鼠事件轉發給chartapi moved listeners list對應的callback functions
			 */
			(paramSupplier: MouseEventParamsImplSupplier) => {
				if (this._crosshairMovedDelegate.hasListeners()) {
					this._crosshairMovedDelegate.fire(this._convertMouseParams(paramSupplier()));
				}
			},
			this	// linked object
		);
		// 取得圖表組件中的model，有left and right price axis, time axis與chart
		const model = this._chartWidget.model();
		// time axis scale的API, 使用chart widget中的time axis widget object建構
		// note: 在time widget中的model也有time scale
		this._timeScaleApi = new TimeScaleApi(model, this._chartWidget.timeAxisWidget());
	} // end of constructor

	public remove(): void {
		/**
		 * 清除圖表所有元素，實現IChartApi的方法
		 */
		// 圖形組件的滑鼠事件
		this._chartWidget.clicked().unsubscribeAll(this);
		this._chartWidget.crosshairMoved().unsubscribeAll(this);

		// 時間軸與圖形組件
		this._timeScaleApi.destroy();
		this._chartWidget.destroy();

		// 資料序列
		this._seriesMap.clear();
		this._seriesMapReversed.clear();

		// api的滑鼠事件
		this._clickedDelegate.destroy();
		this._crosshairMovedDelegate.destroy();
		this._dataLayer.destroy();
	}

	public resize(width: number, height: number, forceRepaint?: boolean): void {
		/**
		 * 改變圖表的大小, 實現IChartApi的方法
		 */
		this._chartWidget.resize(width, height, forceRepaint);
	}

	public addAreaSeries(options: AreaSeriesPartialOptions = {}): ISeriesApi<'Area'> {
		/**
		 * 實現IChart-api介面定義的圖表, 為IseriesApi的泛型
		 * 此處只有建立圖表，尚未加入資料
		 * 回傳SeriesApi的實體(有實現ISeriesApi介面)，才可用setData()加入資料
		 */
		patchPriceFormat(options.priceFormat);

		const strictOptions = merge(clone(seriesOptionsDefaults), areaStyleDefaults, options) as AreaSeriesOptions;
		const series = this._chartWidget.model().createSeries('Area', strictOptions);

		const res = new SeriesApi<'Area'>(series, this, this);
		this._seriesMap.set(res, series);
		this._seriesMapReversed.set(series, res);

		return res;
	}

	public addBaselineSeries(options: BaselineSeriesPartialOptions = {}): ISeriesApi<'Baseline'> {
		/**
		 * 實現IChart-api介面定義的圖表, 為IseriesApi的泛型
		 * 此處只有建立圖表，尚未加入資料
		 * 回傳SeriesApi的實體(有實現ISeriesApi介面)，才可用setData()加入資料
		 */
		patchPriceFormat(options.priceFormat);

		// to avoid assigning fields to defaults we have to clone them
		const strictOptions = merge(clone(seriesOptionsDefaults), clone(baselineStyleDefaults), options) as BaselineSeriesOptions;
		// 在chart model中，會將series記錄起來
		const series = this._chartWidget.model().createSeries('Baseline', strictOptions);

		const res = new SeriesApi<'Baseline'>(series, this, this);
		this._seriesMap.set(res, series);
		this._seriesMapReversed.set(series, res);

		return res;
	}

	public addBarSeries(options: BarSeriesPartialOptions = {}): ISeriesApi<'Bar'> {
		/**
		 * 實現IChart-api介面定義的圖表, 為IseriesApi的泛型
		 * 此處只有建立圖表，尚未加入資料
		 * 回傳SeriesApi的實體(有實現ISeriesApi介面)，才可用setData()加入資料
		 */
		patchPriceFormat(options.priceFormat);

		const strictOptions = merge(clone(seriesOptionsDefaults), barStyleDefaults, options) as BarSeriesOptions;
		const series = this._chartWidget.model().createSeries('Bar', strictOptions);

		const res = new SeriesApi<'Bar'>(series, this, this);
		this._seriesMap.set(res, series);
		this._seriesMapReversed.set(series, res);

		return res;
	}

	public addCandlestickSeries(options: CandlestickSeriesPartialOptions = {}): ISeriesApi<'Candlestick'> {
		/**
		 * 實現IChart-api介面定義的圖表, 為IseriesApi的泛型
		 * 此處只有建立圖表，尚未加入資料
		 * 回傳SeriesApi的實體(有實現ISeriesApi介面)，才可用setData()加入資料
		 */
		fillUpDownCandlesticksColors(options);
		patchPriceFormat(options.priceFormat);

		const strictOptions = merge(clone(seriesOptionsDefaults), candlestickStyleDefaults, options) as CandlestickSeriesOptions;
		const series = this._chartWidget.model().createSeries('Candlestick', strictOptions);

		const res = new CandlestickSeriesApi(series, this, this);
		this._seriesMap.set(res, series);
		this._seriesMapReversed.set(series, res);

		return res;
	}

	public addHistogramSeries(options: HistogramSeriesPartialOptions = {}): ISeriesApi<'Histogram'> {
		/**
		 * 實現IChart-api介面定義的圖表, 為IseriesApi的泛型
		 * 此處只有建立圖表，尚未加入資料
		 * 回傳SeriesApi的實體(有實現ISeriesApi介面)，才可用setData()加入資料
		 */
		patchPriceFormat(options.priceFormat);

		const strictOptions = merge(clone(seriesOptionsDefaults), histogramStyleDefaults, options) as HistogramSeriesOptions;
		const series = this._chartWidget.model().createSeries('Histogram', strictOptions);

		const res = new SeriesApi<'Histogram'>(series, this, this);
		this._seriesMap.set(res, series);
		this._seriesMapReversed.set(series, res);

		return res;
	}

	public addLineSeries(options: LineSeriesPartialOptions = {}): ISeriesApi<'Line'> {
		/**
		 * 實現IChart-api介面定義的圖表, 為IseriesApi的泛型
		 * 此處只有建立圖表，尚未加入資料
		 * 回傳SeriesApi的實體(有實現ISeriesApi介面)，才可用setData()加入資料
		 */
		patchPriceFormat(options.priceFormat);

		// 將line options的預設值和自訂值合併
		const strictOptions = merge(clone(seriesOptionsDefaults), lineStyleDefaults, options) as LineSeriesOptions;
		const series = this._chartWidget.model().createSeries('Line', strictOptions);

		const res = new SeriesApi<'Line'>(series, this, this);
		this._seriesMap.set(res, series);
		this._seriesMapReversed.set(series, res);

		return res;	// SeriesApi object
	}

	public removeSeries(seriesApi: SeriesApi<SeriesType>): void {
		/**
		 * 實現IChart-api介面定義的圖表, 為IseriesApi的泛型
		 */
		const series = ensureDefined(this._seriesMap.get(seriesApi));

		const update = this._dataLayer.removeSeries(series);
		const model = this._chartWidget.model();
		model.removeSeries(series);

		this._sendUpdateToChart(update);

		this._seriesMap.delete(seriesApi);
		this._seriesMapReversed.delete(series);
	}

	public applyNewData<TSeriesType extends SeriesType>(series: Series<TSeriesType>, data: SeriesDataItemTypeMap[TSeriesType][]): void {
		/**
		 * 實現了DataUpdatesConsumer<SeriesType>介面的方法
		 * series中的物件，只有包含繪圖的屬性與圖形，而資料要在series-api中以setData新增到series中
		 * data才是真正的資料
		 * this._dataLayer是DataLayer實例
		 * 在series-api中，將data放入series中
		 */
		this._sendUpdateToChart(this._dataLayer.setSeriesData(series, data));
	}

	public updateData<TSeriesType extends SeriesType>(series: Series<TSeriesType>, data: SeriesDataItemTypeMap[TSeriesType]): void {
		/**
		 * 實現了DataUpdatesConsumer<SeriesType>介面的方法
		 */
		this._sendUpdateToChart(this._dataLayer.updateSeriesData(series, data));
	}

	public subscribeClick(handler: MouseEventHandler): void {
		/**
		 * 實現了IChartApi的方法
		 */
		this._clickedDelegate.subscribe(handler);
	}

	public unsubscribeClick(handler: MouseEventHandler): void {
		/**
		 * 實現了IChartApi的方法
		 */
		this._clickedDelegate.unsubscribe(handler);
	}

	public subscribeCrosshairMove(handler: MouseEventHandler): void {
		/**
		 * 實現了IChartApi的方法
		 */
		this._crosshairMovedDelegate.subscribe(handler);
	}

	public unsubscribeCrosshairMove(handler: MouseEventHandler): void {
		/**
		 * 實現了IChartApi的方法
		 */
		this._crosshairMovedDelegate.unsubscribe(handler);
	}

	public priceScale(priceScaleId: string): IPriceScaleApi {
		/**
		 * 實現了IChartApi的方法
		 */
		return new PriceScaleApi(this._chartWidget, priceScaleId);
	}

	public timeScale(): ITimeScaleApi {
		/**
		 * 實現了IChartApi的方法
		 */
		return this._timeScaleApi;
	}

	public applyOptions(options: DeepPartial<ChartOptions>): void {
		/**
		 * 實現了IChartApi的方法
		 */
		this._chartWidget.applyOptions(toInternalOptions(options));
	}

	public options(): Readonly<ChartOptions> {
		/**
		 * 實現了IChartApi的方法
		 */
		return this._chartWidget.options() as Readonly<ChartOptions>;
	}

	public takeScreenshot(): HTMLCanvasElement {
		/**
		 * 實現了IChartApi的方法
		 */
		return this._chartWidget.takeScreenshot();
	}

	private _sendUpdateToChart(update: DataUpdateResponse): void {
		/**
		 * 使用applyNewData()加入資料到DataLayer後，回傳的物件再傳入此方法
		 */
		const model = this._chartWidget.model();

		// 更新time scale
		model.updateTimeScale(update.timeScale.baseIndex, update.timeScale.points, update.timeScale.firstChangedPointIndex);
		// 更新data對應的series
		update.series.forEach((value: SeriesChanges, series: Series) => series.setData(value.data, value.info));

		model.recalculateAllPanes();
	}

	private _mapSeriesToApi(series: Series): ISeriesApi<SeriesType> {
		return ensureDefined(this._seriesMapReversed.get(series));
	}

	private _convertMouseParams(param: MouseEventParamsImpl): MouseEventParams {
		const seriesData: MouseEventParams['seriesData'] = new Map();
		param.seriesData.forEach((plotRow: SeriesPlotRow, series: Series) => {
			const data = getSeriesDataCreator(series.seriesType())(plotRow);
			assert(isFulfilledData(data));
			seriesData.set(this._mapSeriesToApi(series), data);
		});

		const hoveredSeries = param.hoveredSeries === undefined ? undefined : this._mapSeriesToApi(param.hoveredSeries);

		return {
			time: param.time as Time | undefined,
			logical: param.index as Logical | undefined,
			point: param.point,
			hoveredSeries,
			hoveredMarkerId: param.hoveredObject,
			seriesData,
		};
	}
}
