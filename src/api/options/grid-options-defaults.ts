import { GridOptions } from '../../model/grid';
import { LineStyle } from '../../renderers/draw-line';

// 圖表中網格線
export const gridOptionsDefaults: GridOptions = {
	vertLines: {
		color: '#D6DCDE',	// 淺灰色
		style: LineStyle.Solid,	// 實線
		visible: true,	// 預設可見
	},
	horzLines: {
		color: '#D6DCDE',	// 淺灰色
		style: LineStyle.Solid, // 實線
		visible: true, // 預設可見
	},
};
