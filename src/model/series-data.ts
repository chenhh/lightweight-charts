import { PlotRow } from './plot-data';
import { PlotList } from './plot-list';
import { SeriesType } from './series-options';

export interface LinePlotRow extends PlotRow {
	readonly color?: string;
}

export interface HistogramPlotRow extends PlotRow {
	readonly color?: string;
}

export interface BarPlotRow extends PlotRow {
	readonly color?: string;
}

export interface CandlestickPlotRow extends PlotRow {
	readonly color?: string;
	readonly borderColor?: string;
	readonly wickColor?: string;
}

export interface SeriesPlotRowTypeAtTypeMap {
	Bar: BarPlotRow;
	Candlestick: CandlestickPlotRow;
	Area: PlotRow;
	Baseline: PlotRow;
	Line: LinePlotRow;
	Histogram: HistogramPlotRow;
}

// SeriesPlotRow為單筆轉換過的資料，包含
// PlotRow{time, index: TimePointIndex; readonly time: TimePoint; readonly value: PlotRowValue;
// 	readonly originalTime: OriginalTime;}
// 與各類圖形的延伸屬性, 多筆plot row為array
export type SeriesPlotRow<T extends SeriesType = SeriesType> = SeriesPlotRowTypeAtTypeMap[T];
export type SeriesPlotList<T extends SeriesType = SeriesType> = PlotList<SeriesPlotRow<T>>;

export function createSeriesPlotList<T extends SeriesType = SeriesType>(): SeriesPlotList<T> {
	return new PlotList<SeriesPlotRow<T>>();
}
