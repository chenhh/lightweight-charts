import { isRunningOnClientSide } from '../../helpers/is-running-on-client-side';

import { ChartOptionsInternal, TrackingModeExitMode } from '../../model/chart-model';

import { crosshairOptionsDefaults } from './crosshair-options-defaults';
import { gridOptionsDefaults } from './grid-options-defaults';
import { layoutOptionsDefaults } from './layout-options-defaults';
import { priceScaleOptionsDefaults } from './price-scale-options-defaults';
import { timeScaleOptionsDefaults } from './time-scale-options-defaults';
import { watermarkOptionsDefaults } from './watermark-options-defaults';

// 繪圖的預設選項
export const chartOptionsDefaults: ChartOptionsInternal = {
	width: 0,
	height: 0,
	layout: layoutOptionsDefaults,
	crosshair: crosshairOptionsDefaults,
	grid: gridOptionsDefaults,
	overlayPriceScales: {
		...priceScaleOptionsDefaults,
	},
	leftPriceScale: {
		...priceScaleOptionsDefaults,
		visible: false,
	},
	rightPriceScale: {
		...priceScaleOptionsDefaults,
		visible: true,
	},
	timeScale: timeScaleOptionsDefaults,
	watermark: watermarkOptionsDefaults,
	localization: {
		//判斷是否執行在browser中, 在bom中，可用navigator.language得到語系
		locale: isRunningOnClientSide ? navigator.language : '',
		dateFormat: 'dd MMM \'yy',
	},
	handleScroll: {
		mouseWheel: true,
		pressedMouseMove: true,
		horzTouchDrag: true,
		vertTouchDrag: true,
	},
	handleScale: {
		axisPressedMouseMove: {
			time: true,
			price: true,
		},
		axisDoubleClickReset: true,
		mouseWheel: true,
		pinch: true,
	},
	kineticScroll: {
		mouse: false,
		touch: true,
	},
	trackingMode: {
		exitMode: TrackingModeExitMode.OnNextTap,
	},
};
