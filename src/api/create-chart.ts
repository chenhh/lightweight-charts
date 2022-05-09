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
 * options可在 ChartOptionsInternal中看到完整的預設屬性，可分為兩層，
 * 第一層chart的屬性有width與height,
 * 第二層為底下組件的屬性，可再分為layout, crosshair, grid, overlayPriceScales,
 * leftPriceScale, rightPriceScale, timeScale, watermark, localization, handleScroll,
 * handleScale, kineticScroll, trackingMode, 每個組件有自已的屬性與子組件的屬性
 *
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
