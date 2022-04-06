import { CrosshairMode, CrosshairOptions } from '../../model/crosshair';
import { LineStyle } from '../../renderers/draw-line';

// 圖中十字線的選項
export const crosshairOptionsDefaults: CrosshairOptions = {
	vertLine: {
		color: '#758696',
		width: 1,
		style: LineStyle.LargeDashed,
		visible: true,
		labelVisible: true,
		labelBackgroundColor: '#4c525e',
	},
	horzLine: {
		color: '#758696',
		width: 1,
		style: LineStyle.LargeDashed,
		visible: true,
		labelVisible: true,
		labelBackgroundColor: '#4c525e',
	},
	mode: CrosshairMode.Magnet,
};
