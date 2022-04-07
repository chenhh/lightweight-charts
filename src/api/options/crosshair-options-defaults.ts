import { CrosshairMode, CrosshairOptions } from '../../model/crosshair';
import { LineStyle } from '../../renderers/draw-line';

// 圖中十字線的選項
export const crosshairOptionsDefaults: CrosshairOptions = {
	// 垂直線格式
	vertLine: {
		color: '#758696',
		width: 1,
		style: LineStyle.LargeDashed,
		visible: true,
		labelVisible: true,
		labelBackgroundColor: '#4c525e',
	},
	// 水平線格式
	horzLine: {
		color: '#758696',
		width: 1,
		style: LineStyle.LargeDashed,
		visible: true,
		labelVisible: true,
		labelBackgroundColor: '#4c525e',
	},
	// magnet指十字線會指向圖表的特定值，而normal可在圖表上任意移動
	mode: CrosshairMode.Magnet,
};
