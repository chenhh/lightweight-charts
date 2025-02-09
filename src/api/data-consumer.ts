import { isNumber, isString } from '../helpers/strict-type-checks';

import { Series } from '../model/series';
import { SeriesType } from '../model/series-options';
import { BusinessDay, Time, UTCTimestamp } from '../model/time-data';

/**
 * Check if a time value is a business day object.
 *
 * @param time - The time to check.
 * @returns `true` if `time` is a {@link BusinessDay} object, false otherwise.
 */
export function isBusinessDay(time: Time): time is BusinessDay {
	return !isNumber(time) && !isString(time);
}

/**
 * Check if a time value is a UTC timestamp number.
 *
 * @param time - The time to check.
 * @returns `true` if `time` is a {@link UTCTimestamp} number, false otherwise.
 */
export function isUTCTimestamp(time: Time): time is UTCTimestamp {
	return isNumber(time);
}

/**
 * Represents a whitespace data item, which is a data point without a value.
 * 只有時間，沒有數值的資料介面
 *
 * @example
 * ```js
 * const data = [
 *     { time: '2018-12-03', value: 27.02 },
 *     { time: '2018-12-04' }, // whitespace
 *     { time: '2018-12-05' }, // whitespace
 *     { time: '2018-12-06' }, // whitespace
 *     { time: '2018-12-07' }, // whitespace
 *     { time: '2018-12-08', value: 23.92 },
 *     { time: '2018-12-13', value: 30.74 },
 * ];
 * ```
 */
export interface WhitespaceData {
	/**
	 * The time of the data.
	 */
	time: Time;
}

/**
 * A base interface for a data point of single-value series.
 * 只有日期與純量值的資料介面
 */
export interface SingleValueData {
	/**
	 * The time of the data.
	 */
	time: Time;

	/**
	 * Price value of the data.
	 */
	value: number;
}

/**
 * Structure describing a single item of data for line series
 * LineData只有日期與純量值, 以及可選顏色的資料介面
 */
export interface LineData extends SingleValueData {
	/**
	 * Optional color value for certain data item. If missed, color from options is used
	 */
	color?: string;
}

/**
 * Structure describing a single item of data for histogram series
 * HistogramData只有日期與純量值, 以及可選顏色的資料介面
 */
export interface HistogramData extends SingleValueData {
	/**
	 * Optional color value for certain data item. If missed, color from options is used
	 */
	color?: string;
}

/**
 * Represents a bar with a {@link Time} and open, high, low, and close prices.
 * OHLC有時間、開盤、最高、最低以及收盤價5個值
 */
export interface OhlcData {
	/**
	 * The bar time.
	 */
	time: Time;

	/**
	 * The open price.
	 */
	open: number;
	/**
	 * The high price.
	 */
	high: number;
	/**
	 * The low price.
	 */
	low: number;
	/**
	 * The close price.
	 */
	close: number;
}

/**
 * Structure describing a single item of data for bar series
 * barData資了OHLC資料外，還有可選的顏色屬性
 */
export interface BarData extends OhlcData {
	/**
	 * Optional color value for certain data item. If missed, color from options is used
	 */
	color?: string;
}

/**
 * Structure describing a single item of data for candlestick series
 * 蠟蠋資料除了OHLC資料外，還有可選的顏色、邊界顏色以及燭芯(wick color)的顏色
 */
export interface CandlestickData extends OhlcData {
	/**
	 * Optional color value for certain data item. If missed, color from options is used
	 */
	color?: string;
	/**
	 * Optional border color value for certain data item. If missed, color from options is used
	 */
	borderColor?: string;
	/**
	 * Optional wick color value for certain data item. If missed, color from options is used
	 */
	wickColor?: string;
}

export function isWhitespaceData(data: SeriesDataItemTypeMap[SeriesType]): data is WhitespaceData {
	return (data as Partial<BarData>).open === undefined && (data as Partial<LineData>).value === undefined;
}

export function isFulfilledData(data: SeriesDataItemTypeMap[SeriesType]): data is (BarData | LineData | HistogramData) {
	return (data as Partial<BarData>).open !== undefined || (data as Partial<LineData>).value !== undefined;
}

/**
 * Represents the type of data that a series contains.
 * 表示一个合法序列所包含的資料類型
 *
 * For example a bar series contains {@link BarData} or {@link WhitespaceData}.
 */
export interface SeriesDataItemTypeMap {
	/**
	 * The types of bar series data.
	 */
	Bar: BarData | WhitespaceData;
	/**
	 * The types of candlestick series data.
	 */
	Candlestick: CandlestickData | WhitespaceData;
	/**
	 * The types of area series data.
	 */
	Area: SingleValueData | WhitespaceData;
	/**
	 * The types of baseline series data.
	 */
	Baseline: SingleValueData | WhitespaceData;
	/**
	 * The types of line series data.
	 */
	Line: LineData | WhitespaceData;
	/**
	 * The types of histogram series data.
	 */
	Histogram: HistogramData | WhitespaceData;
}

export interface DataUpdatesConsumer<TSeriesType extends SeriesType> {
	/**
	 * 資料更新的主要介面, TSeriesType為支援的圖表類型
	 * applyNewData: 新增資料的函數
	 * updateData: 更新資料的函數
	 */
	applyNewData(series: Series<TSeriesType>, data: SeriesDataItemTypeMap[TSeriesType][]): void;

	updateData(series: Series<TSeriesType>, data: SeriesDataItemTypeMap[TSeriesType]): void;
}
