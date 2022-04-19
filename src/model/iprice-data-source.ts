import { IPriceFormatter } from '../formatters/iprice-formatter';

import { AutoscaleInfoImpl } from './autoscale-info-impl';
import { ChartModel } from './chart-model';
import { IDataSource } from './idata-source';
import { TimePoint, TimePointIndex } from './time-data';

export interface FirstValue {
	value: number;
	timePoint: TimePoint;
}

export interface IPriceDataSource extends IDataSource {
	firstValue(): FirstValue | null;	// 第一筆資料的時間
	formatter(): IPriceFormatter;

	priceLineColor(lastBarColor: string): string;

	model(): ChartModel;				// 指向root model
	minMove(): number;

	autoscaleInfo(startTimePoint: TimePointIndex, endTimePoint: TimePointIndex): AutoscaleInfoImpl | null;
}
