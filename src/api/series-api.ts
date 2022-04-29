import { IPriceFormatter } from '../formatters/iprice-formatter';

import { ensureNotNull } from '../helpers/assertions';
import { clone, merge } from '../helpers/strict-type-checks';

import { BarPrice } from '../model/bar';
import { Coordinate } from '../model/coordinate';
import { MismatchDirection } from '../model/plot-list';
import { PriceLineOptions } from '../model/price-line-options';
import { RangeImpl } from '../model/range-impl';
import { Series } from '../model/series';
import { SeriesMarker } from '../model/series-markers';
import {
	SeriesOptionsMap,
	SeriesPartialOptionsMap,
	SeriesType,
} from '../model/series-options';
import { Logical, OriginalTime, Range, Time, TimePoint, TimePointIndex } from '../model/time-data';
import { TimeScaleVisibleRange } from '../model/time-scale-visible-range';

import { IPriceScaleApiProvider } from './chart-api';
import { DataUpdatesConsumer, SeriesDataItemTypeMap } from './data-consumer';
import { convertTime } from './data-layer';
import { checkItemsAreOrdered, checkPriceLineOptions, checkSeriesValuesType } from './data-validators';
import { getSeriesDataCreator } from './get-series-data-creator';
import { IPriceLine } from './iprice-line';
import { IPriceScaleApi } from './iprice-scale-api';
import { BarsInfo, ISeriesApi } from './iseries-api';
import { priceLineOptionsDefaults } from './options/price-line-options-defaults';
import { PriceLine } from './price-line-api';

export class SeriesApi<TSeriesType extends SeriesType> implements ISeriesApi<TSeriesType> {
	/*
	 *  圖表已經立，準備加入資料的API
	 *  TSeriesType為所要建立的圖表類型
	 */
	protected _series: Series<TSeriesType>;	// 對應的series, 在ctor中對映
	protected _dataUpdatesConsumer: DataUpdatesConsumer<TSeriesType>;	// ctor中指向ChartApi實例

	private readonly _priceScaleApiProvider: IPriceScaleApiProvider; // ctor中指向ChartApi實例

	public constructor(series: Series<TSeriesType>, dataUpdatesConsumer: DataUpdatesConsumer<TSeriesType>, priceScaleApiProvider: IPriceScaleApiProvider) {
		/**
		 *  在ChartApi中的addAreaSeries等方法中被呼叫,
		 *  series為已經建立的資料實例，
		 *  dataUpdatesConsumer, priceScaleApiProvider為ChartApi的實例(有實作界面)
		 */
		this._series = series;	// 指向ChartApi中的seriesMap的某一個序列, Series class的實例
		this._dataUpdatesConsumer = dataUpdatesConsumer;	    // 指向ChartApi實例
		this._priceScaleApiProvider = priceScaleApiProvider;	// 指向ChartApi實例
	}

	public priceFormatter(): IPriceFormatter {
		/* series formatter getter */
		return this._series.formatter();
	}

	public priceToCoordinate(price: number): Coordinate | null {
		const firstValue = this._series.firstValue();
		if (firstValue === null) {
			return null;
		}

		return this._series.priceScale().priceToCoordinate(price, firstValue.value);
	}

	public coordinateToPrice(coordinate: number): BarPrice | null {
		const firstValue = this._series.firstValue();
		if (firstValue === null) {
			return null;
		}
		return this._series.priceScale().coordinateToPrice(coordinate as Coordinate, firstValue.value);
	}

	// eslint-disable-next-line complexity
	public barsInLogicalRange(range: Range<number> | null): BarsInfo | null {
		if (range === null) {
			return null;
		}

		// we use TimeScaleVisibleRange here to convert LogicalRange to strict range properly
		const correctedRange = new TimeScaleVisibleRange(
			new RangeImpl(range.from as Logical, range.to as Logical)
		).strictRange() as RangeImpl<TimePointIndex>;

		const bars = this._series.bars();
		if (bars.isEmpty()) {
			return null;
		}

		const dataFirstBarInRange = bars.search(correctedRange.left(), MismatchDirection.NearestRight);
		const dataLastBarInRange = bars.search(correctedRange.right(), MismatchDirection.NearestLeft);

		const dataFirstIndex = ensureNotNull(bars.firstIndex());
		const dataLastIndex = ensureNotNull(bars.lastIndex());

		// this means that we request data in the data gap
		// e.g. let's say we have series with data [0..10, 30..60]
		// and we request bars info in range [15, 25]
		// thus, dataFirstBarInRange will be with index 30 and dataLastBarInRange with 10
		if (dataFirstBarInRange !== null && dataLastBarInRange !== null && dataFirstBarInRange.index > dataLastBarInRange.index) {
			return {
				barsBefore: range.from - dataFirstIndex,
				barsAfter: dataLastIndex - range.to,
			};
		}

		const barsBefore = (dataFirstBarInRange === null || dataFirstBarInRange.index === dataFirstIndex)
			? range.from - dataFirstIndex
			: dataFirstBarInRange.index - dataFirstIndex;

		const barsAfter = (dataLastBarInRange === null || dataLastBarInRange.index === dataLastIndex)
			? dataLastIndex - range.to
			: dataLastIndex - dataLastBarInRange.index;

		const result: BarsInfo = { barsBefore, barsAfter };

		// actually they can't exist separately
		if (dataFirstBarInRange !== null && dataLastBarInRange !== null) {
			result.from = dataFirstBarInRange.time.businessDay || dataFirstBarInRange.time.timestamp;
			result.to = dataLastBarInRange.time.businessDay || dataLastBarInRange.time.timestamp;
		}

		return result;
	}

	public setData(data: SeriesDataItemTypeMap[TSeriesType][]): void {
		/**
		 * 新增資料進入圖表
		 * data是新增的資料
		 * */
		checkItemsAreOrdered(data);	// 檢查資料是否以時間排序完成
		checkSeriesValuesType(this._series.seriesType(), data);	//檢查資料是否合法

		// ChartApi的method, 將data放入series中
		this._dataUpdatesConsumer.applyNewData(this._series, data);
	}

	public update(bar: SeriesDataItemTypeMap[TSeriesType]): void {
		// 更新資料至圖表
		checkSeriesValuesType(this._series.seriesType(), [bar]);

		this._dataUpdatesConsumer.updateData(this._series, bar);
	}

	public dataByIndex(logicalIndex: number, mismatchDirection?: MismatchDirection): SeriesDataItemTypeMap[TSeriesType] | null {
		const data = this._series.bars().search(logicalIndex as unknown as TimePointIndex, mismatchDirection);
		if (data === null) {
			// actually it can be a whitespace
			return null;
		}

		return getSeriesDataCreator(this.seriesType())(data);
	}

	public setMarkers(data: SeriesMarker<Time>[]): void {
		checkItemsAreOrdered(data, true);

		const convertedMarkers = data.map<SeriesMarker<TimePoint>>((marker: SeriesMarker<Time>) => ({
			...marker,
			originalTime: marker.time as unknown as OriginalTime,
			time: convertTime(marker.time),
		}));
		this._series.setMarkers(convertedMarkers);
	}

	public markers(): SeriesMarker<Time>[] {
		return this._series.markers().map<SeriesMarker<Time>>((internalItem: SeriesMarker<TimePoint>) => {
			const { originalTime, time, ...item } = internalItem;
			return {
				time: originalTime as unknown as Time,
				...item as Omit<SeriesMarker<TimePoint>, 'time' | 'originalTIme'>,
			};
		});
	}

	public applyOptions(options: SeriesPartialOptionsMap[TSeriesType]): void {
		this._series.applyOptions(options);
	}

	public options(): Readonly<SeriesOptionsMap[TSeriesType]> {
		// 讀取序列的選項
		return clone(this._series.options());
	}

	public priceScale(): IPriceScaleApi {
		return this._priceScaleApiProvider.priceScale(this._series.priceScale().id());
	}

	public createPriceLine(options: PriceLineOptions): IPriceLine {
		checkPriceLineOptions(options);

		const strictOptions = merge(clone(priceLineOptionsDefaults), options) as PriceLineOptions;
		const priceLine = this._series.createPriceLine(strictOptions);
		return new PriceLine(priceLine);
	}

	public removePriceLine(line: IPriceLine): void {
		this._series.removePriceLine((line as PriceLine).priceLine());
	}

	public seriesType(): TSeriesType {
		// 回傳目前的圖表類別
		return this._series.seriesType();
	}
}
