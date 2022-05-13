/// <reference types="_build-time-constants" />

import {lowerbound} from '../helpers/algorithms';
import {ensureDefined, ensureNotNull} from '../helpers/assertions';
import {isString} from '../helpers/strict-type-checks';

import {Series, SeriesUpdateInfo} from '../model/series';
import {SeriesPlotRow} from '../model/series-data';
import {SeriesType} from '../model/series-options';
import {
	BusinessDay,
	OriginalTime,
	Time,
	TimePoint,
	TimePointIndex,
	TimeScalePoint,
	UTCTimestamp,
} from '../model/time-data';

import {
	isBusinessDay,
	isUTCTimestamp,
	SeriesDataItemTypeMap,
} from './data-consumer';
import {getSeriesPlotRowCreator, isSeriesPlotRow, WhitespacePlotRow} from './get-series-plot-row-creator';
import {fillWeightsForPoints} from './time-scale-point-weight-generator';

type TimedData = Pick<SeriesDataItemTypeMap[SeriesType], 'time'>;
type TimeConverter = (time: Time) => TimePoint;

function businessDayConverter(time: Time): TimePoint {
	/**
	 * 將type Time = UTCTimestamp | BusinessDay | string
	 * 轉換為TimePoint
	 */
	if (!isBusinessDay(time)) {
		throw new Error('time must be of type BusinessDay');
	}

	const date = new Date(Date.UTC(time.year, time.month - 1, time.day, 0, 0, 0, 0));

	return {
		timestamp: Math.round(date.getTime() / 1000) as UTCTimestamp,
		businessDay: time,
	};
}

function timestampConverter(time: Time): TimePoint {
	if (!isUTCTimestamp(time)) {
		throw new Error('time must be of type isUTCTimestamp');
	}
	return {
		timestamp: time,
	};
}

function selectTimeConverter(data: TimedData[]): TimeConverter | null {
	if (data.length === 0) {
		return null;
	}
	// time欄位為business day格式
	if (isBusinessDay(data[0].time)) {
		return businessDayConverter;
	}
	// time欄位為time stamp格式
	return timestampConverter;
}

export function convertTime(time: Time): TimePoint {
	if (isUTCTimestamp(time)) {
		return timestampConverter(time);
	}

	if (!isBusinessDay(time)) {
		return businessDayConverter(stringToBusinessDay(time));
	}

	return businessDayConverter(time);
}

const validDateRegex = /^\d\d\d\d-\d\d-\d\d$/;

export function stringToBusinessDay(value: string): BusinessDay {
	if (process.env.NODE_ENV === 'development') {
		// in some browsers (I look at your Chrome) the Date constructor may accept invalid date string
		// but parses them in "implementation specific" way
		// for example 2019-1-1 isn't the same as 2019-01-01 (for Chrome both are "valid" date strings)
		// see https://bugs.chromium.org/p/chromium/issues/detail?id=968939
		// so, we need to be sure that date has valid format to avoid strange behavior and hours of debugging
		// but let's do this in development build only because of perf
		if (!validDateRegex.test(value)) {
			throw new Error(`Invalid date string=${value}, expected format=yyyy-mm-dd`);
		}
	}

	const d = new Date(value);
	if (isNaN(d.getTime())) {
		throw new Error(`Invalid date string=${value}, expected format=yyyy-mm-dd`);
	}

	return {
		day: d.getUTCDate(),
		month: d.getUTCMonth() + 1,
		year: d.getUTCFullYear(),
	};
}

function convertStringToBusinessDay(value: TimedData): void {
	if (isString(value.time)) {
		value.time = stringToBusinessDay(value.time);
	}
}

function convertStringsToBusinessDays(data: TimedData[]): void {
	return data.forEach(convertStringToBusinessDay);
}

export interface TimeScaleChanges {
	/**
	 * An index of the first changed time scale point by any type of change (time, weight, etc)
	 */
	firstChangedPointIndex?: TimePointIndex;

	/**
	 * An array of the new time scale points
	 */
	points?: readonly TimeScalePoint[];

	/**
	 * In terms of time scale "base index" means the latest time scale point with data (there might be whitespaces)
	 */
	baseIndex: TimePointIndex | null;
}

export interface SeriesChanges {
	/**
	 * Data to be merged into series' plot list
	 */
	data: readonly SeriesPlotRow[];
	/**
	 * Additional info about this change
	 */
	info?: SeriesUpdateInfo;
}

export interface DataUpdateResponse {
	/**
	 * Contains updates for all _changed_ series (if series data doesn't changed then it will not be here)
	 */
	series: Map<Series, SeriesChanges>;

	/**
	 * Contains optional time scale points
	 */
	timeScale: TimeScaleChanges;
}

interface TimePointData {
	index: TimePointIndex;	// 型別為TimePointIndex的number
	timePoint: TimePoint;	// UTCTimestamp + BusinessDay?

	// actually the type of the value should be related to the series' type (generic type)
	// here, in data layer all data for us is "mutable" by default, but to the chart we provide "readonly" data, to avoid modifying it
	// key為series type, value為去除掉readonly關鍵字的指定類型
	mapping: Map<Series, Mutable<SeriesPlotRow | WhitespacePlotRow>>;
}

interface InternalTimeScalePoint extends Mutable<TimeScalePoint> {
	pointData: TimePointData;
}

function createEmptyTimePointData(timePoint: TimePoint): TimePointData {
	return {index: 0 as TimePointIndex, mapping: new Map(), timePoint};
}

interface SeriesRowsFirstAndLastTime {
	firstTime: UTCTimestamp;
	lastTime: UTCTimestamp;
}

function seriesRowsFirsAndLastTime(seriesRows: SeriesPlotRow[] | undefined): SeriesRowsFirstAndLastTime | undefined {
	if (seriesRows === undefined || seriesRows.length === 0) {
		return undefined;
	}

	return {
		firstTime: seriesRows[0].time.timestamp,
		lastTime: seriesRows[seriesRows.length - 1].time.timestamp,
	};
}

function seriesUpdateInfo(seriesRows: SeriesPlotRow[] | undefined, prevSeriesRows: SeriesPlotRow[] | undefined): SeriesUpdateInfo | undefined {
	/**
	 * 在setSeriesData()最後回傳時被呼叫, 判斷lastBarUpdatedOrNewBarsAddedToTheRight
	 * 即新的最後一筆資料是單純更新資料，還是新增資料在尾部
	 */
	const firstAndLastTime = seriesRowsFirsAndLastTime(seriesRows);
	const prevFirstAndLastTime = seriesRowsFirsAndLastTime(prevSeriesRows);
	if (firstAndLastTime !== undefined && prevFirstAndLastTime !== undefined) {
		return {
			lastBarUpdatedOrNewBarsAddedToTheRight:
				firstAndLastTime.lastTime >= prevFirstAndLastTime.lastTime &&
				firstAndLastTime.firstTime >= prevFirstAndLastTime.firstTime,
		};
	}

	return undefined;
}

function timeScalePointTime(mergedPointData: Map<Series, SeriesPlotRow | WhitespacePlotRow>): OriginalTime {
	let result: OriginalTime | undefined;
	mergedPointData.forEach((v: SeriesPlotRow | WhitespacePlotRow) => {
		if (result === undefined) {
			result = v.originalTime;
		}
	});

	return ensureDefined(result);
}

function saveOriginalTime<TSeriesType extends SeriesType>(data: SeriesDataItemWithOriginalTime<TSeriesType>): void {
	// eslint-disable-next-line @typescript-eslint/tslint/config
	if (data.originalTime === undefined) {
		data.originalTime = data.time as unknown as OriginalTime;
	}
}

type SeriesDataItemWithOriginalTime<TSeriesType extends SeriesType> = SeriesDataItemTypeMap[TSeriesType] & {
	originalTime: OriginalTime;
};

export class DataLayer {
	/**
	 *  在ChartApi中初始化時就建立，而在applyNewData()中使用dataLayer的setSeriesData()加入資料
	 *  沒有constructor，處理的都是在圖表中關於資料的方法
	 *  series指的是特定的圖形與其屬性，而data才是真正的資料, 要將data與series關聯才能開始繪圖
	 */
		// note that _pointDataByTimePoint and _seriesRowsBySeries shares THE SAME objects in their values between each other
		// it's just different kind of maps to make usages/perf better
		// UTCTimestamp為名稱為UTCTimestamp的數值名目類型
	private _pointDataByTimePoint: Map<UTCTimestamp, TimePointData> = new Map();
	// 將series object與series plot row資料關聯
	// 單筆row的格式為row為{ index, time, value: [val(open), val(high), val(low), val(close)], originalTime }
	private _seriesRowsBySeries: Map<Series, SeriesPlotRow[]> = new Map();
	// 記錄(快取)series所對應到的plot row中最新(後)的一筆time: TimePoint
	// 在_replaceTimeScalePoints時更新
	private _seriesLastTimePoint: Map<Series, TimePoint> = new Map();

	// this is kind of "dest" values (in opposite to "source" ones) - we don't need to modify it manually,
	// the only by calling _updateTimeScalePoints or updateSeriesData methods
	//  {timeWeight: TickMarkWeight, readonly time: TimePoint,
	//  readonly originalTime: OriginalTime, pointData: TimePointData}
	// _sortedTimePoints為目前series plot已經依時間排序好的資料，如果有新的資料進來時，
	// newTimePoints可與sortedTimePoints比較是否需要更新time scale以及first change index
	private _sortedTimePoints: readonly InternalTimeScalePoint[] = [];

	public destroy(): void {
		this._pointDataByTimePoint.clear();
		this._seriesRowsBySeries.clear();
		this._seriesLastTimePoint.clear();
		this._sortedTimePoints = [];
	}

	public setSeriesData<TSeriesType extends SeriesType>(series: Series<TSeriesType>,
														 data: SeriesDataItemTypeMap[TSeriesType][]):
		DataUpdateResponse {
		/**
		 * 在series-api使用setData(series, data)後，回到chart-api的applyNewData(series, data)，
		 * 在time-data中，有支援三種日期格式：
		 * Time = UTCTimestamp | BusinessDay | string;
		 *
		 * 再呼叫chart-api中的datalayer實例的setSeriesData(series, data)將資料裝入series中
		 * OHLC資料與string日期
		 * candleSeries.setData([
		 * 		{time: '2018-10-19', open: 180.34, high: 180.99, low: 178.57, close: 179.85},
		 * 		...
		 * 	])
		 * 	單筆資料與日期
		 * 	let dayData = [
		 * 		{time: '2018-10-19', value: 26.19},
		 * 		{time: '2018-10-22', value: 25.87},
		 * 		...
		 * 	];
		 * 	chart.setData(dayData);
		 * 日期的格式為business day
		 * let data = [{
		 * 		time: {year: 2018, month: 9, day: 22},
		 * 		open: 29.630237296336794,
		 * 		high: 35.36950035097501,
		 * 		low: 26.21522501353531,
		 * 		close: 30.734997177569916
		 * 	},...]
		 * 	or
		 * 	let data = [{time: {year: 2018, month: 9, day: 22}, value: 25.531816900940186},...]
		 * 	日內資料, 日期格式為UTCTimeStamp
		 * 	let data = [ { time: 1556877600, value: 230.12 },...]
		 *
		 */
		let needCleanupPoints = this._pointDataByTimePoint.size !== 0;

		// 只有在series plot row不存在，且series不影響到time point時才為false
		let isTimeScaleAffected = false;

		// save previous series rows data before it's replaced inside this._setRowsToSeries
		const prevSeriesRows = this._seriesRowsBySeries.get(series);	// 取得series plot row, 初始使用時不存在
		if (prevSeriesRows !== undefined) {
			// plot row 存在時
			if (this._seriesRowsBySeries.size === 1) {
				needCleanupPoints = false;
				isTimeScaleAffected = true;

				// perf optimization - if there is only 1 series, then we can just clear and fill everything from scratch
				this._pointDataByTimePoint.clear();
			} else {
				// plot row 不存在時
				// perf optimization - actually we have to use this._pointDataByTimePoint for going through here
				// but as soon as this._sortedTimePoints is just a different form of _pointDataByTimePoint we can use it as well
				// this._sortedTimePoints在資料第一次加入時為empty list
				for (const point of this._sortedTimePoints) {
					if (point.pointData.mapping.delete(series)) {
						isTimeScaleAffected = true;
					}
				}
			}
		}

		let seriesRows: (SeriesPlotRow | WhitespacePlotRow)[] = [];

		// 輸入的資料不為空
		if (data.length !== 0) {
			// 將原始資料增加originalTime屬性
			const extendedData = data as SeriesDataItemWithOriginalTime<TSeriesType>[];
			// 將原始資料的time複製到originalTime屬性
			extendedData.forEach((i: SeriesDataItemWithOriginalTime<TSeriesType>) => saveOriginalTime(i));

			// 將時間改成{year, month, day} businessDay object
			convertStringsToBusinessDays(data);

			// 將時間包裝成{UTC, businessDay} 或 {UTC} 的function pointer
			const timeConverter = ensureNotNull(selectTimeConverter(data));
			// 兩層的function pointer
			const createPlotRow = getSeriesPlotRowCreator(series.seriesType());

			//  extendedData的屬性為{time, originalTime, value}或{time, originalTime, open, high, low, close}
			// 單筆row的格式為row為{ index, time, value: [val(open), val(high), val(low), val(close)], originalTime }
			seriesRows = extendedData.map((item: SeriesDataItemWithOriginalTime<TSeriesType>) => {
				// 將時間包裝成{UTC, businessDay} 或 {UTC}
				const time = timeConverter(item.time);

				// _pointDataByTimePoint: Map<UTCTimestamp, TimePointData>
				// timePointData的key為 {index, timePoint, map: Map<Series, Mutable<SeriesPlotRow | WhitespacePlotRow>>;}
				let timePointData = this._pointDataByTimePoint.get(time.timestamp);
				if (timePointData === undefined) {
					// 建立index為0的time point data並插入pointDataByTimePoint
					// the indexes will be sync later
					timePointData = createEmptyTimePointData(time);	// empty map object
					this._pointDataByTimePoint.set(time.timestamp, timePointData);
					isTimeScaleAffected = true;
				}
				// row為{ index, time, value: [val, val, val, val], originalTime } 或
				//{ index, time, value: [item.open, item.high, item.low, item.close], originalTime }格式
				// 其中第三個value:[]稱為bar
				const row = createPlotRow(time, timePointData.index, item, item.originalTime);
				// 設定time point data的mapping
				timePointData.mapping.set(series, row);
				return row;
			});	// end of map
		}

		if (needCleanupPoints) {
			// we deleted the old data from mapping and added the new ones
			// so there might be empty points now, let's remove them first
			// 由存在於this._sortedTimePoints的point中，清除
			// this._pointDataByTimePoint.delete(point.time.timestamp);
			this._cleanupPointsData();
		}

		// 將series row與series做map關聯，以及記錄series對應的最後一筆row的時間
		this._setRowsToSeries(series, seriesRows);

		let firstChangedPointIndex = -1;
		if (isTimeScaleAffected) {
			// then generate the time scale points
			// timeWeight will be updates in _updateTimeScalePoints later
			//{timeWeight: TickMarkWeight, readonly time: TimePoint, readonly originalTime: OriginalTime,
			// pointData: TimePointData {index: TimePointIndex, timePoint: TimePoint,
			// 							 mapping: Map<Series, Mutable<SeriesPlotRow | WhitespacePlotRow>>};
			// }
			const newTimeScalePoints: InternalTimeScalePoint[] = [];
			// _pointDataByTimePoint: Map<UTCTimestamp, TimePointData>
			// map的foreach callback fn三個參數為value, key, map
			// 將pointData的值，依序轉換後存入newTimeScalePoints
			this._pointDataByTimePoint.forEach((pointData: TimePointData) => {
				newTimeScalePoints.push({
					timeWeight: 0,	// 之後更新
					time: pointData.timePoint, // copy from point data
					pointData,	// copy from point data
					originalTime: timeScalePointTime(pointData.mapping),	// copy from point data
				});
			});
			// 依據timestamp排序
			newTimeScalePoints.sort((t1: InternalTimeScalePoint, t2: InternalTimeScalePoint) => t1.time.timestamp - t2.time.timestamp);

			// 計算firstChangedPointIndex與更新this._sortedTimePoints為newTimeScalePoints
			firstChangedPointIndex = this._replaceTimeScalePoints(newTimeScalePoints);
		}	// end of isTimeScaleAffected

		// return DataUpdateResponse object
		return this._getUpdateResponse(
			series,
			firstChangedPointIndex,
			seriesUpdateInfo(this._seriesRowsBySeries.get(series), prevSeriesRows)	//  判斷是更新還是新增資料
		);
	}

	public removeSeries(series: Series): DataUpdateResponse {
		return this.setSeriesData(series, []);
	}

	public updateSeriesData<TSeriesType extends SeriesType>(series: Series<TSeriesType>, data: SeriesDataItemTypeMap[TSeriesType]): DataUpdateResponse {
		const extendedData = data as SeriesDataItemWithOriginalTime<TSeriesType>;
		saveOriginalTime(extendedData);
		convertStringToBusinessDay(data);

		const time = ensureNotNull(selectTimeConverter([data]))(data.time);

		const lastSeriesTime = this._seriesLastTimePoint.get(series);
		if (lastSeriesTime !== undefined && time.timestamp < lastSeriesTime.timestamp) {
			throw new Error(`Cannot update oldest data, last time=${lastSeriesTime.timestamp}, new time=${time.timestamp}`);
		}

		let pointDataAtTime = this._pointDataByTimePoint.get(time.timestamp);

		// if no point data found for the new data item
		// that means that we need to update scale
		const affectsTimeScale = pointDataAtTime === undefined;

		if (pointDataAtTime === undefined) {
			// the indexes will be sync later
			pointDataAtTime = createEmptyTimePointData(time);
			this._pointDataByTimePoint.set(time.timestamp, pointDataAtTime);
		}

		const createPlotRow = getSeriesPlotRowCreator(series.seriesType());
		const plotRow = createPlotRow(time, pointDataAtTime.index, data, extendedData.originalTime);
		pointDataAtTime.mapping.set(series, plotRow);

		this._updateLastSeriesRow(series, plotRow);

		const info: SeriesUpdateInfo = {lastBarUpdatedOrNewBarsAddedToTheRight: isSeriesPlotRow(plotRow)};

		// if point already exist on the time scale - we don't need to make a full update and just make an incremental one
		if (!affectsTimeScale) {
			return this._getUpdateResponse(series, -1, info);
		}

		const newPoint: InternalTimeScalePoint = {
			timeWeight: 0,
			time: pointDataAtTime.timePoint,
			pointData: pointDataAtTime,
			originalTime: timeScalePointTime(pointDataAtTime.mapping),
		};

		const insertIndex = lowerbound(this._sortedTimePoints, newPoint.time.timestamp, (a: InternalTimeScalePoint, b: number) => a.time.timestamp < b);

		// yes, I know that this array is readonly and this change is intended to make it performative
		// we marked _sortedTimePoints array as readonly to avoid modifying this array anywhere else
		// but this place is exceptional case due performance reasons, sorry
		(this._sortedTimePoints as InternalTimeScalePoint[]).splice(insertIndex, 0, newPoint);

		for (let index = insertIndex; index < this._sortedTimePoints.length; ++index) {
			assignIndexToPointData(this._sortedTimePoints[index].pointData, index as TimePointIndex);
		}

		fillWeightsForPoints(this._sortedTimePoints, insertIndex);

		return this._getUpdateResponse(series, insertIndex, info);
	}

	private _updateLastSeriesRow(series: Series, plotRow: SeriesPlotRow | WhitespacePlotRow): void {
		let seriesData = this._seriesRowsBySeries.get(series);
		if (seriesData === undefined) {
			seriesData = [];
			this._seriesRowsBySeries.set(series, seriesData);
		}

		const lastSeriesRow = seriesData.length !== 0 ? seriesData[seriesData.length - 1] : null;

		if (lastSeriesRow === null || plotRow.time.timestamp > lastSeriesRow.time.timestamp) {
			if (isSeriesPlotRow(plotRow)) {
				seriesData.push(plotRow);
			}
		} else {
			if (isSeriesPlotRow(plotRow)) {
				seriesData[seriesData.length - 1] = plotRow;
			} else {
				seriesData.splice(-1, 1);
			}
		}

		this._seriesLastTimePoint.set(series, plotRow.time);
	}

	private _setRowsToSeries(series: Series, seriesRows: (SeriesPlotRow | WhitespacePlotRow)[]): void {
		/**
		 * series為chart api傳入的已建立的object
		 * series rows為多筆已轉換的資料
		 * { index, time, value: [val(open), val(high), val(low), val(close)], originalTime }
		 */
		if (seriesRows.length !== 0) {
			// 去除掉null的row後，將series與series rows object關聯
			this._seriesRowsBySeries.set(series, seriesRows.filter(isSeriesPlotRow));
			// 記錄series對應的series row最後一筆資料的時間
			this._seriesLastTimePoint.set(series, seriesRows[seriesRows.length - 1].time);
		} else {
			this._seriesRowsBySeries.delete(series);
			this._seriesLastTimePoint.delete(series);
		}
	}

	private _cleanupPointsData(): void {
		// let's treat all current points as "potentially removed"
		// we could create an array with actually potentially removed points
		// but most likely this array will be similar to _sortedTimePoints so let's avoid using additional memory
		// note that we can use _sortedTimePoints here since a point might be removed only it was here previously
		for (const point of this._sortedTimePoints) {
			if (point.pointData.mapping.size === 0) {
				this._pointDataByTimePoint.delete(point.time.timestamp);
			}
		}
	}

	/**
	 * Sets new time scale and make indexes valid for all series
	 * 更新time scale至所有的series plot
	 * InternalTimeScalePoint: {timeWeight, time, pointData, originalTime}
	 * @returns The index of the first changed point or `-1` if there is no change.
	 */
	private _replaceTimeScalePoints(newTimePoints: InternalTimeScalePoint[]): number {
		// newTimePoints在setSeriesData()中呼叫此函數前已依時間排序完成
		let firstChangedPointIndex = -1;

		// search the first different point and "syncing" time weight by the way
		// 如果是第一次建構時，this._sortedTimePoints應該為[], 因此不會進入for loop
		// 迴圈是更新資料時，this._sortedTimePoints已經有資料時才會進入
		for (let index = 0; index < this._sortedTimePoints.length && index < newTimePoints.length; ++index) {
			const oldPoint = this._sortedTimePoints[index];
			const newPoint = newTimePoints[index];
			if (oldPoint.time.timestamp !== newPoint.time.timestamp) {
				firstChangedPointIndex = index;
				break;
			}

			// re-assign point's time weight for points if time is the same (and all prior times was the same)
			newPoint.timeWeight = oldPoint.timeWeight;

			assignIndexToPointData(newPoint.pointData, index as TimePointIndex);
		}

		// for loop找不到change point index時，但sorted time points與new  time points長度不一致
		// 第一次資料建構時會進入此區塊，firstChangePointIndex = 0
		if (firstChangedPointIndex === -1 && this._sortedTimePoints.length !== newTimePoints.length) {
			// the common part of the prev and the new points are the same
			// so the first changed point is the next after the common part
			firstChangedPointIndex = Math.min(this._sortedTimePoints.length, newTimePoints.length);
		}

		// 還是找不到change point index, 表示資料沒變，update時才會進入此區塊，直接回傳
		if (firstChangedPointIndex === -1) {
			// if no time scale changed, then do nothing
			return -1;
		}

		// if time scale points are changed that means that we need to make full update to all series (with clearing points)
		// but first we need to synchronize indexes and re-fill time weights
		for (let index = firstChangedPointIndex; index < newTimePoints.length; ++index) {
			// 更新newTimePoints內的index與map中series row的index
			assignIndexToPointData(newTimePoints[index].pointData, index as TimePointIndex);
		}

		// re-fill time weights for point after the first changed one
		// 計算newTimePoints的time weight
		fillWeightsForPoints(newTimePoints, firstChangedPointIndex);

		this._sortedTimePoints = newTimePoints;

		return firstChangedPointIndex;
	}

	private _getBaseIndex(): TimePointIndex | null {
		if (this._seriesRowsBySeries.size === 0) {
			// if we have no data then 'reset' the base index to null
			return null;
		}

		let baseIndex = 0 as TimePointIndex;

		this._seriesRowsBySeries.forEach((data: SeriesPlotRow[]) => {
			if (data.length !== 0) {
				baseIndex = Math.max(baseIndex, data[data.length - 1].index) as TimePointIndex;
			}
		});

		return baseIndex;
	}

	private _getUpdateResponse(updatedSeries: Series, firstChangedPointIndex: number, info?: SeriesUpdateInfo): DataUpdateResponse {
		/**
		 * setSeriesData()最後回資料時呼叫,
		 * updatedSeries是新的series,
		 * firstChangedPointIndex是更新的資料起始點
		 * info是單純資料更新還是新增資料
		 */
		const dataUpdateResponse: DataUpdateResponse = {
			series: new Map(),	// Map<Series, SeriesChanges>
			timeScale: {
				baseIndex: this._getBaseIndex(),
			},
		};

		// time scale沒變
		if (firstChangedPointIndex !== -1) {
			// TODO: it's possible to make perf improvements by checking what series has data after firstChangedPointIndex
			// but let's skip for now
			this._seriesRowsBySeries.forEach((data: SeriesPlotRow[], s: Series) => {
				dataUpdateResponse.series.set(
					s,	// series
					// seriesChanges
					{
						data,
						info: s === updatedSeries ? info : undefined,
					}
				);
			});

			// if the series data was set to [] it will have already been removed from _seriesRowBySeries
			// meaning the forEach above won't add the series to the data update response
			// so we handle that case here
			if (!this._seriesRowsBySeries.has(updatedSeries)) {
				dataUpdateResponse.series.set(updatedSeries, {data: [], info});
			}

			dataUpdateResponse.timeScale.points = this._sortedTimePoints;
			dataUpdateResponse.timeScale.firstChangedPointIndex = firstChangedPointIndex as TimePointIndex;
		} else {
			// time scale changed
			const seriesData = this._seriesRowsBySeries.get(updatedSeries);
			// if no seriesData found that means that we just removed the series
			dataUpdateResponse.series.set(updatedSeries, {data: seriesData || [], info});
		}

		return dataUpdateResponse;
	}
}

function assignIndexToPointData(pointData: TimePointData, index: TimePointIndex): void {
	// index為_replaceTimeScalePoints()，第一次有變更的index, 之後的index全部用for loop更新
	// first, nevertheless update index of point data ("make it valid")
	pointData.index = index;

	// and then we need to sync indexes for all series
	pointData.mapping.forEach((seriesRow: Mutable<SeriesPlotRow | WhitespacePlotRow>) => {
		seriesRow.index = index;
	});
}
