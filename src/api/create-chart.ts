import { assert } from '../helpers/assertions';
import { DeepPartial, isString } from '../helpers/strict-type-checks';

import { ChartOptions } from '../model/chart-model';

import { ChartApi } from './chart-api';
import { IChartApi } from './ichart-api';

/**
 * This function is the main entry point of the Lightweight Charting Library.
 * 此函數是Lightweight繪圖函式庫的主要進入點
 * 使用id或是document.getElementById確定div容器後，回傳Chart物件，
 * 再選用chart的種類與繪圖選項
 *
 * @param container - ID of HTML element or element itself
 * @param options - Any subset of options to be applied at start.
 * @returns An interface to the created chart
 *
 * 回傳的ChartApi物件有實作IChartApi
 */
export function createChart(container: string | HTMLElement, options?: DeepPartial<ChartOptions>): IChartApi {
	let htmlElement: HTMLElement;
	if (isString(container)) {
		const element = document.getElementById(container);
		assert(element !== null, `Cannot find element in DOM with id=${container}`);
		htmlElement = element;
	} else {
		htmlElement = container;
	}

	return new ChartApi(htmlElement, options);
}
